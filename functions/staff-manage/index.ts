import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_PERMS = {
  jobs: true,
  equipment: true,
  offers: true,
  update_job_status: true,
};

function normalizePerms(raw: unknown) {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    jobs: p.jobs !== false,
    equipment: p.equipment !== false,
    offers: p.offers !== false,
    update_job_status: p.update_job_status !== false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Çağıranın admin olduğunu doğrula
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return Response.json({ error: "Oturum gerekli." }, { status: 401, headers: corsHeaders });
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: isAdminRow } = await admin
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .eq("active", true)
      .maybeSingle();
    if (!isAdminRow) {
      return Response.json({ error: "Yetkisiz." }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const action = body.action as string;

    // —— Oluştur ——
    if (action === "create") {
      const username = String(body.username || "").trim().toLowerCase();
      const display_name = String(body.display_name || "").trim();
      const password = String(body.password || "");
      const role = String(body.role || "crew");
      const phone = body.phone ? String(body.phone).trim() : null;
      const email = body.email
        ? String(body.email).trim()
        : `${username}@staff.stagepulse.local`;
      const permissions = normalizePerms(body.permissions ?? DEFAULT_PERMS);

      if (!username || !display_name || password.length < 8) {
        return Response.json(
          { error: "Kullanıcı adı, ad ve en az 8 karakter şifre zorunlu." },
          { status: 400, headers: corsHeaders }
        );
      }

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "staff", username },
      });
      if (cErr || !created?.user) {
        return Response.json(
          { error: cErr?.message || "Kullanıcı oluşturulamadı." },
          { status: 400, headers: corsHeaders }
        );
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
        return Response.json({ error: pErr.message }, { status: 400, headers: corsHeaders });
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
        return Response.json({ error: "user_id gerekli." }, { status: 400, headers: corsHeaders });
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.display_name != null) patch.display_name = String(body.display_name).trim();
      if (body.role != null) patch.role = String(body.role);
      if (body.phone != null) patch.phone = String(body.phone).trim() || null;
      if (body.active != null) patch.active = !!body.active;
      if (body.username != null) patch.username = String(body.username).trim().toLowerCase();
      if (body.permissions != null) patch.permissions = normalizePerms(body.permissions);

      const { error: uErr } = await admin.from("staff_profiles").update(patch).eq("user_id", user_id);
      if (uErr) return Response.json({ error: uErr.message }, { status: 400, headers: corsHeaders });

      if (body.password && String(body.password).length >= 8) {
        const { error: pwErr } = await admin.auth.admin.updateUserById(user_id, {
          password: String(body.password),
        });
        if (pwErr) return Response.json({ error: pwErr.message }, { status: 400, headers: corsHeaders });
      }

      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    // —— Sil ——
    if (action === "delete") {
      const user_id = String(body.user_id || "");
      if (!user_id) {
        return Response.json({ error: "user_id gerekli." }, { status: 400, headers: corsHeaders });
      }
      await admin.from("staff_profiles").delete().eq("user_id", user_id);
      await admin.auth.admin.deleteUser(user_id);
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Geçersiz action." }, { status: 400, headers: corsHeaders });
  } catch (_e) {
    return Response.json({ error: "İşlem başarısız." }, { status: 500, headers: corsHeaders });
  }
});
