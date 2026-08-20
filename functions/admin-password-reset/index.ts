import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return Response.json({ error: "Yetkisiz" }, { status: 401, headers: corsHeaders });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: ue } = await admin.auth.getUser(token);
    if (ue || !user) {
      return Response.json({ error: "Yetkisiz" }, { status: 401, headers: corsHeaders });
    }
    const { data: p } = await admin.from("admin_profiles").select("active").eq("user_id", user.id).maybeSingle();
    if (!p?.active) {
      return Response.json({ error: "Yetkisiz" }, { status: 403, headers: corsHeaders });
    }
    const body = await req.json();
    if (body.email) {
      const r = await admin.auth.admin.updateUserById(user.id, { email: String(body.email).trim() });
      if (r.error) throw r.error;
    }
    if (body.username) {
      const r = await admin
        .from("admin_profiles")
        .update({ username: String(body.username).trim(), updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (r.error) throw r.error;
    }
    if (body.new_password) {
      if (String(body.new_password).length < 8) {
        return Response.json({ error: "Şifre en az 8 karakter olmalı." }, { status: 400, headers: corsHeaders });
      }
      const r = await admin.auth.admin.updateUserById(user.id, { password: String(body.new_password) });
      if (r.error) throw r.error;
    }
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (_e) {
    return Response.json({ error: "Ayar güncellenemedi." }, { status: 500, headers: corsHeaders });
  }
});
