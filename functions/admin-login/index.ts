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
    const { username, password } = await req.json();
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return Response.json({ error: "Kullanıcı adı ve şifre zorunludur." }, { status: 400, headers: corsHeaders });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: profile, error: pe } = await admin
      .from("admin_profiles")
      .select("user_id,active,username,display_name")
      .eq("username", username.trim())
      .maybeSingle();
    if (pe || !profile || !profile.active) {
      return Response.json({ error: "Geçersiz kullanıcı adı veya şifre." }, { status: 401, headers: corsHeaders });
    }
    const userRes = await admin.auth.admin.getUserById(profile.user_id);
    const email = userRes.data.user?.email ?? "";
    if (!email) {
      return Response.json({ error: "Geçersiz kullanıcı adı veya şifre." }, { status: 401, headers: corsHeaders });
    }
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return Response.json({ error: "Geçersiz kullanıcı adı veya şifre." }, { status: 401, headers: corsHeaders });
    }
    return Response.json(
      {
        session: data.session,
        user: { id: profile.user_id, username: profile.username, display_name: profile.display_name },
      },
      { headers: corsHeaders }
    );
  } catch (_e) {
    return Response.json({ error: "Giriş işlemi başarısız." }, { status: 500, headers: corsHeaders });
  }
});
