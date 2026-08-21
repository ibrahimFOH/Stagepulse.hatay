import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeadersFor,
  handleOptions,
  getClientIp,
  isRateLimited,
  GENERIC_LOGIN_ERROR,
  jsonError,
} from "../_shared/security.ts";

// DEPRECATED compatibility endpoint.
// Production source of truth for staff authorization is Supabase Auth +
// staff_profiles + staff_permissions, surfaced through staff-session.
// Keep this endpoint while existing portal clients migrate; do not add new
// permission logic here.

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
      .select("user_id,active,username,display_name,role")
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

    // Compatibility response: read permissions only from the live
    // staff_permissions table. Do not fall back to DEFAULT_PERMS or the
    // legacy staff_profiles.permissions JSONB field.
    const { data: permissionRows, error: permissionError } = await admin
      .from("staff_permissions")
      .select("permission_key,enabled")
      .eq("user_id", profile.user_id);

    if (permissionError) {
      return jsonError("Personel yetkileri alınamadı.", 500, corsHeaders);
    }

    const permissions: Record<string, boolean> = {};
    for (const row of permissionRows || []) {
      if (typeof row.permission_key === "string") {
        permissions[row.permission_key] = !!row.enabled;
      }
    }

    return Response.json(
      {
        session: data.session,
        user: {
          id: profile.user_id,
          username: profile.username,
          display_name: profile.display_name,
          role: profile.role,
          permissions,
        },
      },
      { headers: corsHeaders }
    );
  } catch (_e) {
    return jsonError("Giriş işlemi başarısız.", 500, corsHeadersFor(req));
  }
});
