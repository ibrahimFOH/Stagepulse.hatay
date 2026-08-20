import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeadersFor,
  handleOptions,
  getClientIp,
  isRateLimited,
  GENERIC_LOGIN_ERROR,
  jsonError,
} from "../_shared/security.ts";

const DEFAULT_PERMS = {
  jobs: true,
  equipment: true,
  offers: true,
  update_job_status: true,
};

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const corsHeaders = corsHeadersFor(req);

  if (req.method !== "POST") {
    return jsonError("Method Not Allowed", 405, corsHeaders);
  }

  try {
    const ip = getClientIp(req);
    if (isRateLimited(`staff-login:${ip}`)) {
      return jsonError("Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.", 429, corsHeaders);
    }

    const body = await req.json().catch(() => null);
    const username = body?.username;
    const password = body?.password;
    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return jsonError("Kullanıcı adı ve şifre zorunludur.", 400, corsHeaders);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: profile, error: pe } = await admin
      .from("staff_profiles")
      .select("user_id,active,username,display_name,role,permissions")
      .eq("username", username.trim().toLowerCase())
      .maybeSingle();

    if (pe || !profile || !profile.active) {
      return jsonError(GENERIC_LOGIN_ERROR, 401, corsHeaders);
    }

    const userRes = await admin.auth.admin.getUserById(profile.user_id);
    const email = userRes.data.user?.email ?? "";
    if (!email) {
      return jsonError(GENERIC_LOGIN_ERROR, 401, corsHeaders);
    }

    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return jsonError(GENERIC_LOGIN_ERROR, 401, corsHeaders);
    }

    const perms = { ...DEFAULT_PERMS, ...(profile.permissions || {}) };

    return Response.json(
      {
        session: data.session,
        user: {
          id: profile.user_id,
          username: profile.username,
          display_name: profile.display_name,
          role: profile.role,
          permissions: perms,
        },
      },
      { headers: corsHeaders }
    );
  } catch (_e) {
    return jsonError("Giriş işlemi başarısız.", 500, corsHeadersFor(req));
  }
});
