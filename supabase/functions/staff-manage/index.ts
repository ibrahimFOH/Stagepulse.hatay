import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeadersFor,
  handleOptions,
  isStrongPassword,
  jsonError,
} from "../_shared/security.ts";

// Temel yetkiler varsayılan olarak açık; hassas/mali yetkiler admin
// açıkça işaretlemeden asla açılmaz (varsayılan false).
const DEFAULT_PERMS = {
  jobs: true,
  equipment: true,
  offers: true,
  view_assigned_jobs: true,
  accept_job: true,
  reject_job: true,
  update_job_status: true,
  customers: false,
  finance: false,
  pricing: false,
  financials: false,
};

// Admin panelindeki "Portalda ne görsün?" listesiyle birebir eşleşmeli.
// Buradaki liste tek doğrulama noktasıdır: personel oluşturma/güncelleme
// isteğinde bu listede olmayan hiçbir alan veritabanına yazılmaz.
const PERMISSION_KEYS = Object.keys(DEFAULT_PERMS) as (keyof typeof DEFAULT_PERMS)[];

const PASSWORD_POLICY_MSG =
  "Şifre en az 10 karakter, en az bir harf ve bir rakam içermelidir.";

function normalizePerms(raw: unknown) {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    // Temel (default true) yetkiler: açıkça false verilmediyse açık kalır.
    // Hassas (default false) yetkiler: admin açıkça true vermediyse kapalı kalır.
    out[key] = DEFAULT_PERMS[key]
      ? p[key] !== false
      : p[key] === true;
  }
  return out;
}

// username + rastgele bir token birleştirerek tahmin edilemez ve çakışmayan
// bir yerel (@stagepulse.local) e-posta üretir.
function generateLocalEmail(username: string): string {
  const token = crypto.randomUUID().split("-")[0];
  return `${username}.${token}@staff.stagepulse.local`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const corsHeaders = corsHeadersFor(req);

  if (req.method !== "POST") {
    return jsonError("Method Not Allowed", 405, corsHeaders);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError("Oturum gerekli.", 401, corsHeaders);
    }

    // Çağıranın admin olduğunu doğrula
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonError("Oturum gerekli.", 401, corsHeaders);
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: isAdminRow } = await admin
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .eq("active", true)
      .maybeSingle();
    if (!isAdminRow) {
      return jsonError("Yetkisiz.", 403, corsHeaders);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError("Geçersiz istek.", 400, corsHeaders);
    }
    const action = body.action as string;

    // —— Oluştur ——
    if (action === "create") {
      const username = String(body.username || "").trim().toLowerCase();
      const display_name = String(body.display_name || "").trim();
      const password = String(body.password || "");
      const role = String(body.role || "crew");
      const phone = body.phone ? String(body.phone).trim() : null;
      const rawEmail = body.email ? String(body.email).trim() : "";
      if (rawEmail && !EMAIL_RE.test(rawEmail)) {
        return jsonError("Geçerli bir e-posta adresi girin.", 400, corsHeaders);
      }
      const email = rawEmail || generateLocalEmail(username);
      const permissions = normalizePerms(body.permissions ?? DEFAULT_PERMS);

      if (!username || !display_name || !isStrongPassword(password)) {
        return jsonError(
          `Kullanıcı adı, ad zorunlu. ${PASSWORD_POLICY_MSG}`,
          400,
          corsHeaders
        );
      }

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "staff", username },
      });
      if (cErr || !created?.user) {
        return jsonError(cErr?.message || "Kullanıcı oluşturulamadı.", 400, corsHeaders);
      }

      const { error: pErr } = await admin.from("staff_profiles").insert({
        user_id: created.user.id,
        username,
        display_name,
        role,
        phone,
        active: true,
        permissions,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return jsonError(pErr.message, 400, corsHeaders);
      }

      return Response.json(
        { ok: true, user_id: created.user.id, username, display_name, role, permissions },
        { headers: corsHeaders }
      );
    }

    // —— Güncelle ——
    if (action === "update") {
      const user_id = String(body.user_id || "");
      if (!user_id) {
        return jsonError("user_id gerekli.", 400, corsHeaders);
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.display_name != null) patch.display_name = String(body.display_name).trim();
      if (body.role != null) patch.role = String(body.role);
      if (body.phone != null) patch.phone = String(body.phone).trim() || null;
      if (body.active != null) patch.active = !!body.active;
      if (body.username != null) patch.username = String(body.username).trim().toLowerCase();
      if (body.permissions != null) patch.permissions = normalizePerms(body.permissions);

      const { error: uErr } = await admin.from("staff_profiles").update(patch).eq("user_id", user_id);
      if (uErr) return jsonError(uErr.message, 400, corsHeaders);

      if (body.password) {
        if (!isStrongPassword(String(body.password))) {
          return jsonError(PASSWORD_POLICY_MSG, 400, corsHeaders);
        }
        const { error: pwErr } = await admin.auth.admin.updateUserById(user_id, {
          password: String(body.password),
        });
        if (pwErr) return jsonError(pwErr.message, 400, corsHeaders);
      }

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // —— Sil ——
    if (action === "delete") {
      const user_id = String(body.user_id || "");
      if (!user_id) {
        return jsonError("user_id gerekli.", 400, corsHeaders);
      }
      await admin.from("staff_profiles").delete().eq("user_id", user_id);
      await admin.auth.admin.deleteUser(user_id);
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    return jsonError("Geçersiz action.", 400, corsHeaders);
  } catch (_e) {
    return jsonError("İşlem başarısız.", 500, corsHeadersFor(req));
  }
});
