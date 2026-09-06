import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://stagepulse.com.tr",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const authorization = req.headers.get("authorization") || "";
    if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "UNAUTHENTICATED" }, 401);
    const accessToken = authorization.slice(7).trim();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user) return json({ error: "UNAUTHENTICATED" }, 401);

    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const requestedVariant = typeof body.app_variant === "string" ? body.app_variant.trim().toLowerCase() : "";
    if (!["admin", "staff"].includes(requestedVariant)) return json({ error: "INVALID_APP_VARIANT" }, 400);
    if (!token || token.length < 20 || token.length > 4096) return json({ error: "INVALID_TOKEN" }, 400);

    const { data: membership, error: membershipError } = await admin
      .from("org_memberships")
      .select("active,role:role_id(code,is_admin_role,active)")
      .eq("user_id", authData.user.id)
      .eq("active", true)
      .maybeSingle();
    if (membershipError) throw membershipError;
    const role = Array.isArray((membership as any)?.role) ? (membership as any).role?.[0] : (membership as any)?.role;
    const isAdmin = membership?.active === true && role?.active !== false && role?.is_admin_role === true;
    if (requestedVariant === "admin" && !isAdmin) return json({ error: "FORBIDDEN_ADMIN_APP" }, 403);
    if (requestedVariant === "staff" && (!membership?.active || role?.active === false)) return json({ error: "FORBIDDEN_STAFF_APP" }, 403);

    const now = new Date().toISOString();
    const { error: staleError } = await admin
      .from("notification_devices")
      .update({ active: false, updated_at: now })
      .eq("token", token)
      .eq("push_type", "fcm")
      .eq("app_variant", requestedVariant)
      .neq("user_id", authData.user.id);
    if (staleError) throw staleError;

    const { data: existing, error: findError } = await admin
      .from("notification_devices")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("push_type", "fcm")
      .eq("app_variant", requestedVariant)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const { error } = await admin.from("notification_devices").update({
        token, platform: "android", active: true, last_seen_at: now,
        updated_at: now, subscription_updated_at: now,
      }).eq("id", existing.id);
      if (error) throw error;
      return json({ ok: true, id: existing.id, action: "updated", app_variant: requestedVariant, platform: "android" });
    }

    const { data, error } = await admin.from("notification_devices").insert({
      user_id: authData.user.id, token, platform: "android", push_type: "fcm",
      app_variant: requestedVariant, active: true, last_seen_at: now,
      updated_at: now, subscription_updated_at: now,
    }).select("id").single();
    if (error) throw error;
    return json({ ok: true, id: data.id, action: "created", app_variant: requestedVariant, platform: "android" });
  } catch (error) {
    console.error("[register-android-device]", error);
    return json({ error: "REGISTER_FAILED" }, 500);
  }
});
