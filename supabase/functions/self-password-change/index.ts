import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, handleOptions, isStrongPassword, jsonError } from "../_shared/security.ts";

const PASSWORD_POLICY_MSG = "Şifre en az 10 karakter, en az bir harf ve bir rakam içermelidir.";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const corsHeaders = corsHeadersFor(req);
  if (req.method !== "POST") return jsonError("Method Not Allowed", 405, corsHeaders);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return jsonError("Yetkisiz", 401, corsHeaders);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return jsonError("Kimlik doğrulama servisi yapılandırılmamış.", 503, corsHeaders);

    const token = authHeader.slice(7).trim();
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user?.id || !user.email) return jsonError("Oturum geçersiz.", 401, corsHeaders);

    const body = await req.json().catch(() => null);
    const currentPassword = typeof body?.current_password === "string" ? body.current_password : "";
    const newPassword = typeof body?.new_password === "string" ? body.new_password : "";
    if (!currentPassword || !newPassword) return jsonError("Mevcut ve yeni şifre zorunludur.", 400, corsHeaders);
    if (currentPassword === newPassword) return jsonError("Yeni şifre mevcut şifre ile aynı olamaz.", 400, corsHeaders);
    if (!isStrongPassword(newPassword)) return jsonError(PASSWORD_POLICY_MSG, 400, corsHeaders);

    // Verify the current password without trusting client-side state.
    const verifier = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verifyError) return jsonError("Mevcut şifre hatalı.", 400, corsHeaders);

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updateError) return jsonError("Şifre değiştirilemedi.", 500, corsHeaders);

    return Response.json({ ok: true, message: "Şifreniz değiştirildi." }, { headers: corsHeaders });
  } catch (_) {
    return jsonError("Şifre değiştirilemedi.", 500, corsHeadersFor(req));
  }
});
