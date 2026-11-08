import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ALLOWED_ORIGINS = new Set([
  "https://stagepulse.com.tr",
  "https://www.stagepulse.com.tr",
  "https://appassets.androidplatform.net",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}
function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function normalize(value: string, mode: "trim_upper" | "alnum_upper") {
  const upper = value.trim().toUpperCase();
  return mode === "alnum_upper" ? upper.replace(/[^A-Z0-9]/g, "") : upper;
}
async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes = 24) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
function makeKey(appId: string) {
  if (appId === "stagepulse") {
    const raw = randomHex(18);
    return "STP-" + raw.match(/.{1,4}/g)!.join("-");
  }
  if (appId.startsWith("ses-merkezi")) {
    return "SP-SM-" + randomHex(20).match(/.{1,5}/g)!.join("-");
  }
  return "JARVIS-" + randomHex(20).match(/.{1,5}/g)!.join("-");
}
async function getUser(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : data.user;
}
async function requireOwner(userId: string) {
  const { data, error } = await db.from("org_memberships")
    .select("role:org_roles!org_memberships_role_id_fkey(code,is_admin_role)")
    .eq("user_id", userId).eq("active", true);
  if (error) throw new Error("OWNER_ROLE_LOOKUP_FAILED");
  return (data ?? []).some((row: any) => {
    const role = Array.isArray(row.role) ? row.role[0] : row.role;
    return role?.code === "owner" && role?.is_admin_role === true;
  });
}
async function rateLimited(key: string, max: number) {
  try {
    const { data, error } = await db.rpc("check_login_rate_limit", { p_key: key, p_max: max });
    return !!error || data !== true;
  } catch {
    return true;
  }
}
async function appFor(appId: string) {
  const { data, error } = await db.from("license_products")
    .select("app_id,product_code,display_name,platform,is_active")
    .eq("app_id", appId).eq("is_active", true).maybeSingle();
  if (error || !data) throw new Error("LICENSE_APP_NOT_FOUND");
  return data;
}
async function findLicense(rawKey: string) {
  const trimHash = await sha256(normalize(rawKey, "trim_upper"));
  const compactHash = await sha256(normalize(rawKey, "alnum_upper"));
  const hashes = [...new Set([trimHash, compactHash])];
  const { data, error } = await db.from("license_core")
    .select("id,product_code,key_hash,key_normalization,legacy_system,legacy_license_id,owner_user_id,customer_name,status,plan_code,bundle_code,max_devices,expires_at,payment_status,metadata")
    .in("key_hash", hashes).limit(2);
  if (error) throw new Error("LICENSE_LOOKUP_FAILED");
  return (data ?? []).find((row: any) => row.key_hash === (row.key_normalization === "alnum_upper" ? compactHash : trimHash)) ?? null;
}
async function getEntitlements(licenseId: string, appId: string) {
  const [base, overrides] = await Promise.all([
    db.from("license_product_entitlements").select("capability,enabled,limits").eq("app_id", appId),
    db.from("license_entitlements").select("capability,enabled,limits").eq("license_id", licenseId).eq("app_id", appId),
  ]);
  if (base.error || overrides.error) throw new Error("LICENSE_ENTITLEMENTS_LOOKUP_FAILED");
  const merged = new Map<string, any>();
  for (const item of base.data ?? []) merged.set(item.capability, item);
  for (const item of overrides.data ?? []) merged.set(item.capability, item);
  return [...merged.values()].map(item => ({
    capability: item.capability, enabled: item.enabled, limits: item.limits ?? {},
  }));
}
async function finishActivation(license: any, user: any, app: any, platform: string, deviceHash: string) {
  const { data, error } = await db.rpc("license_core_activate", {
    p_license_id: license.id,
    p_user_id: user.id,
    p_app_id: app.app_id,
    p_platform: platform,
    p_device_hash: deviceHash,
  });
  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("LICENSE_DEVICE_LIMIT")) throw new Error("LICENSE_DEVICE_LIMIT");
    if (message.includes("DEVICE_BOUND_TO_OTHER_USER")) throw new Error("DEVICE_BOUND_TO_OTHER_USER");
    if (message.includes("LICENSE_INVALID_OR_EXPIRED")) throw new Error("LICENSE_INVALID_OR_EXPIRED");
    throw new Error("LICENSE_ACTIVATION_FAILED");
  }
  return data;
}
async function adminCreate(user: any, body: any, req: Request) {
  if (!(await requireOwner(user.id))) return reply(req, { ok: false, error: "FORBIDDEN_OWNER_ONLY" }, 403);
  const appId = clean(body.app_id, 80);
  const app = await appFor(appId);
  const customer = clean(body.customer_name, 120);
  const maxDevices = Number(body.max_devices ?? 1);
  if (!customer) return reply(req, { ok: false, error: "CUSTOMER_REQUIRED" }, 400);
  if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > (appId === "stagepulse" ? 50 : 100)) {
    return reply(req, { ok: false, error: "DEVICE_LIMIT_INVALID" }, 400);
  }
  const rawKey = makeKey(appId);
  const mode = appId.startsWith("ses-merkezi") ? "alnum_upper" : "trim_upper";
  const keyHash = await sha256(normalize(rawKey, mode));
  const expiresRaw = clean(body.expires_at, 50);
  let expiresAt: string | null = null;
  if (expiresRaw) {
    const parsed = Date.parse(expiresRaw);
    if (!Number.isFinite(parsed) || parsed <= Date.now()) return reply(req, { ok: false, error: "EXPIRY_INVALID" }, 400);
    expiresAt = new Date(parsed).toISOString();
  }
  const paymentStatus = ["paid", "unpaid", "refunded"].includes(String(body.payment_status))
    ? String(body.payment_status) : "unpaid";
  let licenseId: string | null = null;

  if (appId === "stagepulse") {
    const { data, error } = await db.from("stagepulse_licenses").insert({
      license_hash: keyHash,
      license_prefix: rawKey.slice(0, 12),
      customer_name: customer,
      product_code: "stagepulse",
      status: "active",
      max_devices: maxDevices,
      expires_at: expiresAt,
      notes: clean(body.notes, 1000) || null,
    }).select("id").single();
    if (error || !data) throw new Error("LICENSE_CREATE_FAILED");
    const { data: core, error: coreError } = await db.from("license_core")
      .update({ owner_user_id: user.id, payment_status: paymentStatus, updated_at: new Date().toISOString() })
      .eq("legacy_system", "stagepulse").eq("legacy_license_id", data.id)
      .select("id").single();
    if (coreError || !core) throw new Error("LICENSE_CORE_SYNC_FAILED");
    licenseId = core.id;
  } else if (appId.startsWith("ses-merkezi")) {
    const bundle = clean(body.bundle_code, 80) || "start";
    const plan = ["student", "classroom", "lifetime"].includes(String(body.plan_code)) ? String(body.plan_code) : "student";
    const allowedBundles = ["start","live_sound","rf_wireless","pa_system","studio_post","spl_acoustics","digital_console","full_master","institution"];
    if (!allowedBundles.includes(bundle)) return reply(req, { ok: false, error: "BUNDLE_INVALID" }, 400);
    const { data, error } = await db.from("sesm_license_keys").insert({
      key_hash: keyHash, label: clean(body.label, 120) || "Lisans",
      plan_code: plan, bundle_code: bundle, max_activations: maxDevices,
      expires_at: expiresAt, created_by: user.id, notes: clean(body.notes, 500),
      customer_name: customer, customer_email: clean(body.customer_email, 320).toLowerCase(),
      payment_method: ["cash","bank_transfer","card","other"].includes(String(body.payment_method)) ? String(body.payment_method) : "other",
      payment_status: paymentStatus, amount: Number.isFinite(Number(body.amount)) ? Number(body.amount) : 0,
      currency: /^[A-Z]{3}$/.test(String(body.currency ?? "TRY").toUpperCase()) ? String(body.currency ?? "TRY").toUpperCase() : "TRY",
      payment_reference: clean(body.payment_reference, 120),
    }).select("id").single();
    if (error || !data) throw new Error("LICENSE_CREATE_FAILED");
    const { data: core, error: coreError } = await db.from("license_core")
      .select("id").eq("legacy_system", "ses-merkezi").eq("legacy_license_id", data.id).single();
    if (coreError || !core) throw new Error("LICENSE_CORE_SYNC_FAILED");
    licenseId = core.id;
  } else {
    const { data, error } = await db.from("license_core").insert({
      product_code: app.product_code,
      key_hash: keyHash,
      key_normalization: mode,
      owner_user_id: user.id,
      customer_name: customer,
      status: "active",
      plan_code: clean(body.plan_code, 80) || "standard",
      max_devices: maxDevices,
      expires_at: expiresAt,
      payment_status: paymentStatus,
      metadata: { notes: clean(body.notes, 1000), source: "license-core-admin" },
    }).select("id").single();
    if (error || !data) throw new Error("LICENSE_CREATE_FAILED");
    licenseId = data.id;
  }

  const { data: defaults, error: defaultsError } = await db.from("license_product_entitlements")
    .select("capability,enabled,limits").eq("app_id", appId);
  if (defaultsError) throw new Error("LICENSE_ENTITLEMENTS_LOOKUP_FAILED");
  const { error: entitlementError } = await db.from("license_entitlements")
    .insert((defaults ?? []).map((item: any) => ({ license_id: licenseId, app_id: appId, ...item })));
  if (entitlementError) throw new Error("LICENSE_ENTITLEMENTS_CREATE_FAILED");
  await db.from("license_core_audit").insert({
    license_id: licenseId, actor_user_id: user.id, action: "license_created", app_id: appId,
    details: { max_devices: maxDevices, payment_status: paymentStatus },
  });
  return reply(req, { ok: true, license: { id: licenseId, product_code: app.product_code, app_id: appId, customer_name: customer, max_devices: maxDevices, expires_at: expiresAt, payment_status: paymentStatus }, license_key: rawKey }, 201);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return reply(req, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!URL || !SERVICE_KEY) return reply(req, { ok: false, error: "SERVICE_UNAVAILABLE" }, 503);
  const user = await getUser(req);
  if (!user) return reply(req, { ok: false, error: "UNAUTHENTICATED" }, 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return reply(req, { ok: false, error: "INVALID_REQUEST" }, 400);
  const action = clean(body.action, 40);
  const appId = clean(body.app_id, 80);

  try {
    if (action === "admin_create") return await adminCreate(user, body, req);

    if (action === "admin_list") {
      if (!(await requireOwner(user.id))) return reply(req, { ok: false, error: "FORBIDDEN_OWNER_ONLY" }, 403);
      const { data, error } = await db.from("license_core")
        .select("id,product_code,legacy_system,customer_name,status,plan_code,bundle_code,max_devices,expires_at,payment_status,created_at,owner_user_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error("LICENSE_LIST_FAILED");
      const licenses = [];
      for (const item of data ?? []) {
        const { count, error: countError } = await db.from("license_core_devices")
          .select("id", { count: "exact", head: true }).eq("license_id", item.id).eq("is_active", true);
        if (countError) throw new Error("LICENSE_DEVICE_COUNT_FAILED");
        licenses.push({ ...item, active_devices: count ?? 0 });
      }
      return reply(req, { ok: true, licenses });
    }

    if (action === "admin_revoke") {
      if (!(await requireOwner(user.id))) return reply(req, { ok: false, error: "FORBIDDEN_OWNER_ONLY" }, 403);
      const licenseId = clean(body.license_id, 80);
      const { data: lic, error } = await db.from("license_core")
        .select("id,legacy_system,legacy_license_id").eq("id", licenseId).eq("owner_user_id", user.id).maybeSingle();
      if (error || !lic) return reply(req, { ok: false, error: "LICENSE_NOT_FOUND" }, 404);
      if (lic.legacy_system === "stagepulse") {
        const { error: updateError } = await db.from("stagepulse_licenses")
          .update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", lic.legacy_license_id);
        if (updateError) throw new Error("LICENSE_REVOKE_FAILED");
      } else if (lic.legacy_system === "ses-merkezi") {
        const { error: updateError } = await db.from("sesm_license_keys")
          .update({ is_active: false }).eq("id", lic.legacy_license_id);
        if (updateError) throw new Error("LICENSE_REVOKE_FAILED");
        await db.from("sesm_activations").update({ is_active: false }).eq("license_id", lic.legacy_license_id);
        await db.from("sesm_students").update({ is_active: false }).eq("license_id", lic.legacy_license_id);
      } else {
        const { error: updateError } = await db.from("license_core")
          .update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", licenseId);
        if (updateError) throw new Error("LICENSE_REVOKE_FAILED");
        await db.from("license_core_devices").update({ is_active: false })
          .eq("license_id", licenseId);
      }
      await db.from("license_core_audit").insert({ license_id: licenseId, actor_user_id: user.id, action: "license_revoked", app_id: appId || null });
      return reply(req, { ok: true });
    }

    if (action === "status") {
      const app = await appFor(appId);
      const platform = clean(body.platform, 20);
      const deviceHash = clean(body.device_hash, 256);
      if (platform !== app.platform || deviceHash.length < 8) return reply(req, { ok: false, error: "DEVICE_DATA_INVALID" }, 400);
      const { data: device, error } = await db.from("license_core_devices")
        .select("license_id,last_seen_at").eq("user_id", user.id).eq("app_id", appId)
        .eq("device_hash", deviceHash).eq("is_active", true).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error("LICENSE_STATUS_LOOKUP_FAILED");
      if (!device) return reply(req, { ok: true, licensed: false, reason: "not_activated" });
      const { data: lic, error: licenseError } = await db.from("license_core")
        .select("id,product_code,status,plan_code,bundle_code,max_devices,expires_at,payment_status")
        .eq("id", device.license_id).maybeSingle();
      if (licenseError) throw new Error("LICENSE_STATUS_LOOKUP_FAILED");
      const valid = !!lic && lic.product_code === app.product_code && lic.status === "active"
        && lic.payment_status === "paid" && (!lic.expires_at || Date.parse(lic.expires_at) > Date.now());
      if (!valid) return reply(req, { ok: true, licensed: false, reason: "expired_or_disabled" });
      await db.from("license_core_devices").update({ last_seen_at: new Date().toISOString() })
        .eq("license_id", lic.id).eq("app_id", appId).eq("device_hash", deviceHash);
      return reply(req, { ok: true, licensed: true, license: lic, entitlements: await getEntitlements(lic.id, appId) });
    }

    if (action === "activate") {
      const app = await appFor(appId);
      const platform = clean(body.platform, 20);
      const deviceHash = clean(body.device_hash, 256);
      const rawKey = clean(body.license_key, 120);
      if (platform !== app.platform || deviceHash.length < 8 || !rawKey) return reply(req, { ok: false, error: "ACTIVATION_DATA_INVALID" }, 400);
      if (await rateLimited("license-core:activate:" + user.id, 20)) return reply(req, { ok: false, error: "RATE_LIMITED" }, 429);
      const lic = await findLicense(rawKey);
      if (!lic || lic.product_code !== app.product_code || lic.status !== "active"
          || (lic.expires_at && Date.parse(lic.expires_at) <= Date.now())) {
        return reply(req, { ok: false, error: "LICENSE_INVALID_OR_EXPIRED" }, 403);
      }
      if (lic.payment_status !== "paid") {
        return reply(req, { ok: false, error: "LICENSE_PAYMENT_REQUIRED" }, 403);
      }
      if (lic.legacy_system === "stagepulse") {
        const { data: legacyResult, error: legacyError } = await db.rpc("stagepulse_activate_license_device", {
          p_license_id: lic.legacy_license_id, p_device_id: deviceHash,
        });
        if (legacyError || !legacyResult?.ok) return reply(req, { ok: false, error: "LICENSE_DEVICE_LIMIT_OR_INVALID" }, 409);
      } else if (lic.legacy_system === "ses-merkezi") {
        if (!/^[0-9a-f]{64}$/.test(deviceHash)) return reply(req, { ok: false, error: "DEVICE_ID_INVALID" }, 400);
        const { error: legacyError } = await db.rpc("sesm_activate_license", {
          p_key_hash: lic.key_hash, p_user_id: user.id, p_device_hash: deviceHash,
          p_email: user.email ?? "", p_display_name: clean(user.user_metadata?.display_name ?? user.user_metadata?.full_name, 120),
        });
        if (legacyError) {
          const message = String(legacyError.message ?? "");
          if (message.includes("LICENSE_PAYMENT_REQUIRED")) return reply(req, { ok: false, error: "LICENSE_PAYMENT_REQUIRED" }, 403);
          if (message.includes("LICENSE_INVALID_OR_EXPIRED")) return reply(req, { ok: false, error: "LICENSE_INVALID_OR_EXPIRED" }, 403);
          if (message.includes("LICENSE_ACTIVATION_LIMIT")) return reply(req, { ok: false, error: "LICENSE_DEVICE_LIMIT" }, 409);
          if (message.includes("DEVICE_BOUND_TO_OTHER_USER")) return reply(req, { ok: false, error: "DEVICE_BOUND_TO_OTHER_USER" }, 409);
          if (message.includes("STUDENT_ALREADY_LINKED")) return reply(req, { ok: false, error: "STUDENT_ALREADY_LINKED" }, 409);
          return reply(req, { ok: false, error: "LICENSE_ACTIVATION_FAILED" }, 403);
        }
      }
      const result = await finishActivation(lic, user, app, platform, deviceHash);
      return reply(req, { ok: true, licensed: true, activation: result, entitlements: await getEntitlements(lic.id, appId) });
    }

    return reply(req, { ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = String((error as Error)?.message ?? "INTERNAL_ERROR");
    const status = message === "LICENSE_APP_NOT_FOUND" ? 404
      : message === "UNAUTHENTICATED" ? 401
      : message === "OWNER_ROLE_LOOKUP_FAILED" ? 503
      : message === "LICENSE_PAYMENT_REQUIRED" || message === "LICENSE_INVALID_OR_EXPIRED" ? 403
      : message === "LICENSE_DEVICE_LIMIT" || message === "DEVICE_BOUND_TO_OTHER_USER" || message === "STUDENT_ALREADY_LINKED" ? 409
      : message === "LICENSE_ACTIVATION_FAILED" ? 400
      : 500;
    console.error("[license-core]", message);
    return reply(req, { ok: false, error: message }, status);
  }
});
