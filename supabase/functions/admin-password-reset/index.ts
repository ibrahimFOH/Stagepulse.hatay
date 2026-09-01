import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, handleOptions, isStrongPassword, jsonError } from "../_shared/security.ts";
const PASSWORD_POLICY_MSG = "Şifre en az 10 karakter, en az bir harf ve bir rakam içermelidir.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
Deno.serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  const corsHeaders = corsHeadersFor(req);
  if (req.method !== "POST") return jsonError("Method Not Allowed", 405, corsHeaders);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return jsonError("Yetkisiz", 401, corsHeaders);
    const url = Deno.env.get("SUPABASE_URL")!; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: ue } = await admin.auth.getUser(token);
    if (ue || !user) return jsonError("Yetkisiz", 401, corsHeaders);
    const { data: p } = await admin.from("admin_profiles").select("active").eq("user_id", user.id).maybeSingle();
    if (!p?.active) return jsonError("Yetkisiz", 403, corsHeaders);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("Geçersiz istek.", 400, corsHeaders);
    if (body.email) { const email = String(body.email).trim(); if (!EMAIL_RE.test(email)) return jsonError("Geçerli bir e-posta adresi girin.", 400, corsHeaders); const r = await admin.auth.admin.updateUserById(user.id, { email }); if (r.error) throw r.error; }
    if (body.username) { const r = await admin.from("admin_profiles").update({ username: String(body.username).trim(), updated_at: new Date().toISOString() }).eq("user_id", user.id); if (r.error) throw r.error; }
    if (body.new_password) { if (!isStrongPassword(String(body.new_password))) return jsonError(PASSWORD_POLICY_MSG, 400, corsHeaders); const r = await admin.auth.admin.updateUserById(user.id, { password: String(body.new_password) }); if (r.error) throw r.error; }
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (_e) { return jsonError("Ayar güncellenemedi.", 500, corsHeadersFor(req)); }
});
