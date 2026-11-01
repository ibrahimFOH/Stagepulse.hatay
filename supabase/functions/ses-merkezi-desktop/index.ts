import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODULES = new Set(["frequency", "ear", "calculators", "acoustics", "rta", "mixer", "wav", "lufs", "cues", "checklists", "docs"]);
const APP_URL = "https://stagepulse.com.tr";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

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
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function normalizeKey(value: unknown) { return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function issueLicenseKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const hex = Array.from(bytes).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  const groups = hex.match(/.{1,5}/g) ?? [];
  return "SP-SM-" + groups.join("-");
}
function decodeB64Url(value: string) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base + "=".repeat((4 - base.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function getOwnerUserId(): Promise<string | null> {
  const { data: memberships, error } = await admin.from("org_memberships")
    .select("user_id, role:org_roles!org_memberships_role_id_fkey(code,is_admin_role,active)")
    .eq("active", true);
  if (error) return null;
  const ownerIds = [...new Set((memberships ?? []).filter((member: any) => {
    const raw = member.role;
    const role = Array.isArray(raw) ? raw[0] : raw;
    return !!member.user_id && role?.code === "owner" && role?.is_admin_role === true && role?.active === true;
  }).map((member: any) => String(member.user_id)))];
  return ownerIds.length === 1 ? ownerIds[0] : null;
}
async function verifyLicenseAdminToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const { data: cfg, error } = await admin.from("stagepulse_license_admin_config")
    .select("username,token_secret").eq("singleton", true).maybeSingle();
  if (error || !cfg?.username || !cfg?.token_secret || String(cfg.token_secret).length < 32) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(cfg.token_secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, decodeB64Url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(decodeB64Url(parts[1])));
    return payload.role === "license_admin" && payload.sub === cfg.username && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
async function requireUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("UNAUTHENTICATED");
  const { data, error } = await admin.auth.getUser(token);
  if (!error && data?.user) return { user: data.user, token };
  if (await verifyLicenseAdminToken(token)) {
    const { data: cfg } = await admin.from("stagepulse_license_admin_config")
      .select("owner_user_id").eq("singleton", true).maybeSingle();
    const ownerId = String(cfg?.owner_user_id ?? "");
    if (ownerId) {
      const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(ownerId);
      if (!ownerError && owner?.user) return { user: owner.user, token };
    }
  }
  throw new Error("UNAUTHENTICATED");
}
async function getRole(userId: string) {
  // Tek ve etkin Stagepulse sahibi, veritabanındaki rol kaydından çözülür; belirsizlikte yetki verilmez.
  const ownerId = await getOwnerUserId();
  if (ownerId && ownerId === userId) return "owner";
  // Student access requires an active enrollment AND a paid, active, unexpired license.
  // A refunded/unpaid license must not retain cloud progress privileges from an old enrollment.
  const { data: student } = await admin.from("sesm_students").select("user_id, license_id, is_active")
    .eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (!student) return "guest";
  const { data: lic } = await admin.from("sesm_license_keys")
    .select("is_active, payment_status, expires_at").eq("id", student.license_id).maybeSingle();
  const paidAndValid = !!lic?.is_active && lic.payment_status === "paid" && (!lic.expires_at || Date.parse(lic.expires_at) > Date.now());
  return paidAndValid ? "student" : "guest";
}
async function audit(actor: string, action: string, subject?: string | null, licenseId?: string | null, details: Record<string, unknown> = {}) {
  await admin.from("sesm_audit_events").insert({ actor_user_id: actor, action, subject_user_id: subject ?? null, license_id: licenseId ?? null, details });
}
const DEMO_FEATURES = new Set(["home", "frequency", "calculators", "ear_basic", "docs", "checklists", "curriculum", "account", "settings"]);
async function trialContext(userId: string, deviceHash: string, platformValue: unknown) {
  if (!/^[0-9a-f]{64}$/.test(deviceHash)) return { active: false, reason: "device_id_invalid" };
  const platform = ["windows", "android"].includes(String(platformValue)) ? String(platformValue) : "unknown";
  const { data: existing, error: lookupError } = await admin.from("sesm_trials").select("user_id,device_hash,platform,started_at,expires_at,last_seen_at,revoked").eq("user_id", userId).maybeSingle();
  if (lookupError) return { active: false, reason: "trial_service_unavailable" };
  if (existing) {
    const expires = Date.parse(existing.expires_at);
    const sameDevice = existing.device_hash === deviceHash;
    const active = sameDevice && !existing.revoked && Number.isFinite(expires) && expires > Date.now();
    if (active) await admin.from("sesm_trials").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId).eq("device_hash", deviceHash).eq("revoked", false);
    const reason = active ? null : (!sameDevice ? "trial_device_mismatch" : (existing.revoked ? "trial_revoked" : "trial_expired"));
    return { active, started_at: existing.started_at, expires_at: existing.expires_at, remaining_seconds: active ? Math.max(0, Math.floor((expires - Date.now()) / 1000)) : 0, reason, platform: existing.platform };
  }
  const { data: deviceTrial, error: deviceLookupError } = await admin.from("sesm_trials").select("user_id").eq("device_hash", deviceHash).maybeSingle();
  if (deviceLookupError) return { active: false, reason: "trial_service_unavailable" };
  if (deviceTrial) return { active: false, reason: "device_trial_already_used" };
  const { data: created, error: createError } = await admin.from("sesm_trials").insert({ user_id: userId, device_hash: deviceHash, platform }).select("started_at,expires_at,platform").single();
  if (createError || !created) {
    const { data: raced } = await admin.from("sesm_trials").select("user_id,device_hash,platform,started_at,expires_at,revoked").eq("user_id", userId).maybeSingle();
    if (raced) {
      const expires = Date.parse(raced.expires_at);
      const sameDevice = raced.device_hash === deviceHash;
      const active = sameDevice && !raced.revoked && Number.isFinite(expires) && expires > Date.now();
      const reason = active ? null : (!sameDevice ? "trial_device_mismatch" : (raced.revoked ? "trial_revoked" : "trial_expired"));
      return { active, started_at: raced.started_at, expires_at: raced.expires_at, remaining_seconds: active ? Math.max(0, Math.floor((expires - Date.now()) / 1000)) : 0, reason, platform: raced.platform };
    }
    const { data: deviceRaced } = await admin.from("sesm_trials").select("user_id").eq("device_hash", deviceHash).maybeSingle();
    if (deviceRaced) return { active: false, reason: "device_trial_already_used" };
    return { active: false, reason: "trial_start_failed" };
  }
  const expires = Date.parse(created.expires_at);
  return { active: true, started_at: created.started_at, expires_at: created.expires_at, remaining_seconds: Math.max(0, Math.floor((expires - Date.now()) / 1000)), reason: null, platform: created.platform };
}

async function entitlementContext(userId: string, deviceHash: string, role: string, platform: unknown, requestedAppId = "") {
  const licensed = await licensedContext(userId, deviceHash, role, requestedAppId);
  const trial = role === "owner" || licensed.active
    ? { active: false, reason: role === "owner" ? "owner_account" : "paid_license_active", remaining_seconds: 0 }
    : await trialContext(userId, deviceHash, platform);
  return { licensed, trial, paid: role === "owner" || licensed.active };
}

async function licensedContext(userId: string, deviceHash: string, role: string, requestedAppId = "") {
  if (role === "owner") return { active: true, plan_code: "owner", bundle_code: "full_master", expires_at: null };
  if (!/^[0-9a-f]{64}$/.test(deviceHash)) return { active: false, reason: "device_id_invalid" };
  const appIds = requestedAppId === "ses-merkezi-android"
    ? ["ses-merkezi-android"] : requestedAppId === "ses-merkezi" ? ["ses-merkezi"] : ["ses-merkezi", "ses-merkezi-android"];
  const { data: activation, error: activationError } = await admin.from("license_core_devices")
    .select("license_id, app_id, last_seen_at").eq("user_id", userId).eq("device_hash", deviceHash)
    .eq("is_active", true).in("app_id", appIds).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  if (activationError) return { active: false, reason: "license_core_unavailable" };
  if (!activation) return { active: false, reason: "not_activated" };
  const { data: lic, error: licenseError } = await admin.from("license_core")
    .select("product_code, status, plan_code, bundle_code, expires_at, payment_status")
    .eq("id", activation.license_id).maybeSingle();
  if (licenseError) return { active: false, reason: "license_core_unavailable" };
  const valid = lic?.product_code === "ses-merkezi" && lic.status === "active"
    && lic.payment_status === "paid" && (!lic.expires_at || Date.parse(lic.expires_at) > Date.now());
  if (valid) {
    await admin.from("license_core_devices").update({ last_seen_at: new Date().toISOString() })
      .eq("license_id", activation.license_id).eq("app_id", activation.app_id)
      .eq("device_hash", deviceHash).eq("user_id", userId);
    const { data: core } = await admin.from("license_core")
      .select("legacy_license_id").eq("id", activation.license_id).maybeSingle();
    if (core?.legacy_license_id) {
      await admin.from("sesm_activations").update({ last_seen_at: new Date().toISOString() })
        .eq("license_id", core.legacy_license_id).eq("user_id", userId).eq("device_hash", deviceHash);
    }
  }
  return {
    active: valid,
    plan_code: valid ? lic!.plan_code : null,
    bundle_code: valid ? (lic!.bundle_code ?? "start") : null,
    expires_at: lic?.expires_at ?? null,
    reason: valid ? null : (lic?.payment_status !== "paid" ? "payment_required" : "expired_or_disabled"),
  };
}
async function requireOwner(userId: string) {
  const role = await getRole(userId);
  if (role !== "owner") throw new Error("FORBIDDEN_OWNER_ONLY");
  return role;
}

Deno.serve(async (req: Request) => {
  const responseHeaders = corsHeaders(req);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: responseHeaders });
  const fail = (code: string, status = 400) => reply({ ok: false, error: code }, status);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders });
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", 405);
  try {
    const { user, token } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const role = await getRole(user.id);
    if (action === "context") {
      const deviceHash = String(body.device_hash ?? "");
      const entitlement = await entitlementContext(user.id, deviceHash, role, body.platform, String(body.app_id ?? ""));
      const { data: ownStudent } = await admin.from("sesm_students").select("display_name, email, teacher_user_id")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      return reply({ ok: true, user: { id: user.id, email: user.email, name: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "" }, role, licensed: entitlement.licensed, trial: entitlement.trial, entitlements: { paid: entitlement.paid, demo: entitlement.trial.active, demo_days: 7 }, student: ownStudent ?? null, app: "Stagepulse Ses Mühendisliği Merkezi" });
    }
    if (action === "license_status") {
      const entitlement = await entitlementContext(user.id, String(body.device_hash ?? ""), role, body.platform, String(body.app_id ?? ""));
      return reply({ ok: true, licensed: entitlement.licensed, trial: entitlement.trial, entitlements: { paid: entitlement.paid, demo: entitlement.trial.active, demo_days: 7 }, role });
    }
    if (action === "feature_access" || action === "pdf_access") {
      const entitlement = await entitlementContext(user.id, String(body.device_hash ?? ""), role, body.platform, String(body.app_id ?? ""));
      const feature = action === "pdf_access" ? "pdf_library" : String(body.feature ?? "");
      const allowed = entitlement.paid || (entitlement.trial.active && DEMO_FEATURES.has(feature));
      return reply({ ok: true, feature, allowed, paid: entitlement.paid, trial: entitlement.trial, reason: allowed ? null : (!entitlement.trial.active ? "trial_required_or_expired" : "license_required") });
    }
    if (action === "license_list") {
      await requireOwner(user.id);
      const { data: licenses, error } = await admin.from("sesm_license_keys")
        .select("id,label,plan_code,bundle_code,max_activations,expires_at,is_active,created_at,notes,customer_name,customer_email,payment_method,payment_status,amount,currency,payment_reference")
        .eq("created_by", user.id).order("created_at", { ascending: false }).limit(500);
      if (error) return fail("LICENSE_LIST_FAILED", 500);
      const ids = (licenses ?? []).map((lic: any) => lic.id);
      const activations = ids.length
        ? await admin.from("sesm_activations").select("license_id,device_hash,is_active").in("license_id", ids)
        : { data: [], error: null };
      if (activations.error) return fail("LICENSE_ACTIVATION_LIST_FAILED", 500);
      const counts = new Map<string, Set<string>>();
      for (const item of activations.data ?? []) {
        if (item.is_active) {
          if (!counts.has(item.license_id)) counts.set(item.license_id, new Set<string>());
          counts.get(item.license_id)!.add(item.device_hash);
        }
      }
      return reply({ ok: true, licenses: (licenses ?? []).map((lic: any) => ({
        ...lic, active_activations: counts.get(lic.id)?.size ?? 0,
      })) });
    }
    if (action === "license_activations") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      if (!licenseId) return fail("LICENSE_NOT_FOUND", 404);
      const { data: ownedLicense, error: ownedError } = await admin.from("sesm_license_keys")
        .select("id").eq("id", licenseId).eq("created_by", user.id).maybeSingle();
      if (ownedError || !ownedLicense) return fail("LICENSE_NOT_FOUND", 404);
      const { data: rows, error } = await admin.from("sesm_activations")
        .select("id,device_hash,activated_at,last_seen_at,is_active")
        .eq("license_id", licenseId).order("activated_at", { ascending: false }).limit(100);
      if (error) return fail("LICENSE_ACTIVATION_LIST_FAILED", 500);
      return reply({ ok: true, activations: (rows ?? []).map((row: any) => ({
        id: row.id, device_hint: String(row.device_hash ?? "").slice(0, 8).toUpperCase(),
        activated_at: row.activated_at, last_seen_at: row.last_seen_at, is_active: !!row.is_active,
      })) });
    }
    if (action === "activation_revoke") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      const activationId = String(body.activation_id ?? "").trim();
      if (!licenseId || !activationId) return fail("ACTIVATION_NOT_FOUND", 404);
      const { data: ownedLicense, error: ownedError } = await admin.from("sesm_license_keys")
        .select("id").eq("id", licenseId).eq("created_by", user.id).maybeSingle();
      if (ownedError || !ownedLicense) return fail("LICENSE_NOT_FOUND", 404);
      const { data: activation, error } = await admin.from("sesm_activations")
        .update({ is_active: false }).eq("id", activationId).eq("license_id", licenseId)
        .select("id,device_hash").maybeSingle();
      if (error || !activation) return fail("ACTIVATION_REVOKE_FAILED", 500);
      await audit(user.id, "activation_revoked", null, licenseId, { device_hint: String(activation.device_hash ?? "").slice(0, 8).toUpperCase() });
      return reply({ ok: true });
    }
    if (action === "license_extend") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      const daysToAdd = Number(body.days_to_add);
      if (!licenseId || !Number.isInteger(daysToAdd) || daysToAdd < 1 || daysToAdd > 3650) return fail("LICENSE_EXTENSION_INVALID", 400);
      const { data: lic, error: lookupError } = await admin.from("sesm_license_keys")
        .select("id,expires_at,is_active,plan_code,payment_status").eq("id", licenseId).eq("created_by", user.id).maybeSingle();
      if (lookupError || !lic) return fail("LICENSE_NOT_FOUND", 404);
      if (!lic.is_active) return fail("LICENSE_DISABLED", 409);
      if (lic.payment_status !== "paid") return fail("LICENSE_PAYMENT_REQUIRED", 403);
      if (!lic.expires_at) return fail("LICENSE_LIFETIME_CANNOT_EXTEND", 400);
      const oldExpiry = Date.parse(lic.expires_at);
      const base = Number.isFinite(oldExpiry) && oldExpiry > Date.now() ? oldExpiry : Date.now();
      const nextExpiry = new Date(base + daysToAdd * 86400000).toISOString();
      const { error } = await admin.from("sesm_license_keys").update({ expires_at: nextExpiry })
        .eq("id", licenseId).eq("created_by", user.id);
      if (error) return fail("LICENSE_EXTEND_FAILED", 500);
      await audit(user.id, "license_extended", null, licenseId, { days_added: daysToAdd, expires_at: nextExpiry });
      return reply({ ok: true, expires_at: nextExpiry });
    }
    if (action === "audit_list") {
      await requireOwner(user.id);
      const { data: events, error } = await admin.from("sesm_audit_events")
        .select("id,action,license_id,details,created_at").eq("actor_user_id", user.id)
        .order("created_at", { ascending: false }).limit(100);
      if (error) return fail("AUDIT_LIST_FAILED", 500);
      return reply({ ok: true, events: events ?? [] });
    }
    if (action === "license_create") {
      await requireOwner(user.id);
      const rawKey = issueLicenseKey();
      const hash = await sha256Hex(normalizeKey(rawKey));
      const label = String(body.label ?? "Öğrenci lisansı").trim().slice(0, 120) || "Öğrenci lisansı";
      const plan = ["student", "classroom", "lifetime"].includes(String(body.plan_code)) ? String(body.plan_code) : "student";
      const allowedBundles = ["start", "live_sound", "rf_wireless", "pa_system", "studio_post", "spl_acoustics", "digital_console", "full_master", "institution"];
      const bundle = allowedBundles.includes(String(body.bundle_code)) ? String(body.bundle_code) : "start";
      const maxActivations = Math.max(1, Math.min(100, Math.trunc(Number(body.max_activations) || 1)));
      const days = Math.max(0, Math.min(3650, Math.trunc(Number(body.expires_days) || 0)));
      const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      const customerName = String(body.customer_name ?? "").trim().slice(0, 120);
      const customerEmail = String(body.customer_email ?? "").trim().toLowerCase().slice(0, 320);
      const paymentMethod = ["cash", "bank_transfer", "card", "other"].includes(String(body.payment_method)) ? String(body.payment_method) : "cash";
      const paymentStatus = ["paid", "unpaid"].includes(String(body.payment_status)) ? String(body.payment_status) : "unpaid";
      const amount = Number(body.amount ?? 0);
      const currency = String(body.currency ?? "TRY").trim().toUpperCase();
      const paymentReference = String(body.payment_reference ?? "").trim().slice(0, 120);
      if (customerEmail && (!customerEmail.includes("@") || customerEmail.length > 320)) return fail("LICENSE_CUSTOMER_EMAIL_INVALID", 400);
      if (!Number.isFinite(amount) || amount < 0 || amount > 999999999 || !/^[A-Z]{3}$/.test(currency)) return fail("LICENSE_PAYMENT_DATA_INVALID", 400);
      const { data: lic, error } = await admin.from("sesm_license_keys").insert({
        key_hash: hash, label, plan_code: plan, bundle_code: bundle, max_activations: maxActivations, expires_at: expiresAt,
        created_by: user.id, notes: String(body.notes ?? "").slice(0, 500), customer_name: customerName,
        customer_email: customerEmail, payment_method: paymentMethod, payment_status: paymentStatus,
        amount, currency, payment_reference: paymentReference,
      }).select("id,label,plan_code,bundle_code,max_activations,expires_at,created_at,customer_name,customer_email,payment_method,payment_status,amount,currency,payment_reference").single();
      if (error || !lic) return fail("LICENSE_CREATE_FAILED", 500);
      await audit(user.id, "license_created", null, lic.id, { label, customer_name: customerName, plan_code: plan, bundle_code: bundle, max_activations: maxActivations, expires_at: expiresAt, payment_status: paymentStatus, payment_method: paymentMethod, amount, currency, payment_reference: paymentReference });
      // Raw key is returned once. Only SHA-256 hash is stored in the database.
      return reply({ ok: true, license: lic, key: rawKey });
    }
    if (action === "license_payment_update") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      const paymentStatus = String(body.payment_status ?? "");
      if (!licenseId || !["paid", "unpaid", "refunded"].includes(paymentStatus)) return fail("LICENSE_PAYMENT_DATA_INVALID", 400);
      const { data: lic, error } = await admin.from("sesm_license_keys")
        .update({ payment_status: paymentStatus }).eq("id", licenseId).eq("created_by", user.id)
        .select("id,payment_status,customer_name").maybeSingle();
      if (error || !lic) return fail("LICENSE_NOT_FOUND", 404);
      if (paymentStatus !== "paid") {
        await admin.from("sesm_activations").update({ is_active: false }).eq("license_id", licenseId);
        await admin.from("sesm_students").update({ is_active: false }).eq("license_id", licenseId).eq("teacher_user_id", user.id);
      }
      await audit(user.id, "license_payment_updated", null, licenseId, { payment_status: paymentStatus });
      return reply({ ok: true, license: lic });
    }
    if (action === "license_activate") {
      // The shared license-core service is the only public activation authority.
      // The legacy Ses Merkezi RPC remains behind that service to preserve student enrolment.
      const key = normalizeKey(body.key);
      const deviceHash = String(body.device_hash ?? "");
      const appId = body.app_id === "ses-merkezi-android" ? "ses-merkezi-android" : "ses-merkezi";
      const platform = appId === "ses-merkezi-android" ? "android" : "windows";
      if (key.length < 30 || key.length > 64 || !/^[A-Z0-9]+$/.test(key)) return fail("LICENSE_FORMAT_INVALID", 400);
      if (!/^[0-9a-f]{64}$/.test(deviceHash)) return fail("DEVICE_ID_INVALID", 400);
      const activationResponse = await fetch(`${supabaseUrl}/functions/v1/license-core`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "activate",
          app_id: appId,
          platform,
          device_hash: deviceHash,
          license_key: key,
        }),
      });
      const activation = await activationResponse.json().catch(() => ({}));
      if (!activationResponse.ok || activation?.ok !== true) {
        const raw = String(activation?.error ?? "LICENSE_ACTIVATION_FAILED");
        if (raw.includes("LICENSE_PAYMENT_REQUIRED")) return fail("LICENSE_PAYMENT_REQUIRED", 403);
        if (raw.includes("LICENSE_INVALID_OR_EXPIRED")) return fail("LICENSE_INVALID_OR_EXPIRED", 403);
        if (raw.includes("LICENSE_DEVICE_LIMIT")) return fail("LICENSE_ACTIVATION_LIMIT", 409);
        if (raw.includes("DEVICE_BOUND_TO_OTHER_USER")) return fail("DEVICE_BOUND_TO_OTHER_USER", 409);
        if (raw.includes("STUDENT_ALREADY_LINKED")) return fail("STUDENT_ALREADY_LINKED", 409);
        if (raw.includes("UNAUTHENTICATED")) return fail("UNAUTHENTICATED", 401);
        return fail("LICENSE_ACTIVATION_FAILED", activationResponse.status >= 400 ? activationResponse.status : 400);
      }
      const licenseId = activation?.activation?.license_id ?? null;
      await audit(user.id, "license_activated", user.id, licenseId, {
        app_id: appId,
        device_hash_prefix: deviceHash.slice(0, 8),
      });
      return reply({
        ok: true,
        result: activation.activation ?? {},
        entitlements: activation.entitlements ?? [],
        role: "student",
      });
    }
    if (action === "teacher_students") {
      await requireOwner(user.id);
      const { data: students, error } = await admin.from("sesm_students").select("user_id,license_id,email,display_name,is_active,created_at,updated_at").eq("teacher_user_id", user.id).order("created_at", { ascending: false });
      if (error) return fail("STUDENTS_READ_FAILED", 500);
      const ids = (students ?? []).map((s: any) => s.user_id);
      const progress = ids.length ? await admin.from("sesm_progress").select("student_user_id,module_id,completed,marked_at,teacher_note,updated_at").in("student_user_id", ids) : { data: [], error: null };
      return reply({ ok: true, students: students ?? [], progress: progress.data ?? [] });
    }
    if (action === "progress_get") {
      let target = user.id;
      if (role === "owner") target = String(body.student_user_id ?? user.id);
      else if (role !== "student") return fail("LICENSE_REQUIRED", 403);
      if (target !== user.id && role !== "owner") return fail("FORBIDDEN", 403);
      if (role === "owner" && target !== user.id) {
        const { data: student } = await admin.from("sesm_students").select("user_id").eq("user_id", target).eq("teacher_user_id", user.id).maybeSingle();
        if (!student) return fail("STUDENT_NOT_FOUND", 404);
      }
      const { data, error } = await admin.from("sesm_progress").select("module_id,completed,marked_by,marked_at,teacher_note,updated_at").eq("student_user_id", target);
      if (error) return fail("PROGRESS_READ_FAILED", 500);
      return reply({ ok: true, student_user_id: target, progress: data ?? [], editable: role === "owner" && target !== user.id });
    }
    if (action === "progress_mark") {
      await requireOwner(user.id);
      const target = String(body.student_user_id ?? "");
      const moduleId = String(body.module_id ?? "");
      const completed = body.completed === true;
      const note = String(body.teacher_note ?? "").trim().slice(0, 1000);
      if (!target || !MODULES.has(moduleId)) return fail("PROGRESS_INPUT_INVALID", 400);
      const { data: student } = await admin.from("sesm_students").select("user_id,license_id").eq("user_id", target).eq("teacher_user_id", user.id).eq("is_active", true).maybeSingle();
      if (!student) return fail("STUDENT_NOT_FOUND", 404);
      const row = { student_user_id: target, module_id: moduleId, completed, marked_by: completed ? user.id : null, marked_at: completed ? new Date().toISOString() : null, teacher_note: note, updated_at: new Date().toISOString() };
      const { data, error } = await admin.from("sesm_progress").upsert(row, { onConflict: "student_user_id,module_id" }).select().single();
      if (error || !data) return fail("PROGRESS_SAVE_FAILED", 500);
      await audit(user.id, completed ? "progress_marked_complete" : "progress_marked_incomplete", target, student.license_id, { module_id: moduleId });
      return reply({ ok: true, progress: data });
    }
    if (action === "license_revoke") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "");
      const { data, error } = await admin.from("sesm_license_keys").update({ is_active: false }).eq("id", licenseId).eq("created_by", user.id).select("id").maybeSingle();
      if (error || !data) return fail("LICENSE_NOT_FOUND", 404);
      await admin.from("sesm_activations").update({ is_active: false }).eq("license_id", licenseId);
      await admin.from("sesm_students").update({ is_active: false }).eq("license_id", licenseId).eq("teacher_user_id", user.id);
      await audit(user.id, "license_revoked", null, licenseId);
      return reply({ ok: true });
    }
    return fail("UNKNOWN_ACTION", 400);
  } catch (err) {
    const message = String((err as Error)?.message ?? "INTERNAL_ERROR");
    if (message === "UNAUTHENTICATED") return fail("UNAUTHENTICATED", 401);
    if (message === "FORBIDDEN_OWNER_ONLY") return fail("FORBIDDEN_OWNER_ONLY", 403);
    return fail("INTERNAL_ERROR", 500);
  }
});
