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
async function requireUser(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("UNAUTHENTICATED");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new Error("UNAUTHENTICATED");
  return { user: data.user, token };
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
function trialStatus(row: any, now = Date.now()) {
  if (row.revoked) return { active: false, reason: "trial_revoked", remaining_seconds: 0, started_at: row.started_at, expires_at: row.expires_at };
  const expires = Date.parse(String(row.expires_at ?? ""));
  if (!Number.isFinite(expires)) return { active: false, reason: "trial_service_unavailable", remaining_seconds: 0 };
  if (expires <= now) return { active: false, reason: "trial_expired", remaining_seconds: 0, started_at: row.started_at, expires_at: row.expires_at };
  return { active: true, reason: null, started_at: row.started_at, expires_at: row.expires_at, remaining_seconds: Math.max(0, Math.ceil((expires - now) / 1000)) };
}

async function trialContext(userId: string, deviceHash: string, platform: unknown, requestedAppId: string, licensed: any) {
  if (licensed.active) return { active: false, reason: "paid_license_active", remaining_seconds: 0 };
  if (!["ses-merkezi", "ses-merkezi-android"].includes(requestedAppId)) return { active: false, reason: "trial_start_failed", remaining_seconds: 0 };
  if (!/^[0-9a-f]{64}$/.test(deviceHash)) return { active: false, reason: "device_id_invalid", remaining_seconds: 0 };
  const expectedPlatform = requestedAppId === "ses-merkezi-android" ? "android" : "windows";
  if (platform !== expectedPlatform) return { active: false, reason: "device_id_invalid", remaining_seconds: 0 };

  const { data: activeDevices, error: devicesError } = await admin.from("license_core_devices")
    .select("license_id").eq("user_id", userId).eq("app_id", requestedAppId).eq("is_active", true);
  if (devicesError) return { active: false, reason: "trial_service_unavailable", remaining_seconds: 0 };
  const assignedIds = [...new Set((activeDevices ?? []).map((item: any) => item.license_id).filter(Boolean))];
  if (assignedIds.length) {
    const { data: assignedLicenses, error: assignedError } = await admin.from("license_core")
      .select("id,product_code,status,payment_status,expires_at").in("id", assignedIds);
    if (assignedError) return { active: false, reason: "trial_service_unavailable", remaining_seconds: 0 };
    const hasPaidLicense = (assignedLicenses ?? []).some((item: any) =>
      item.product_code === "ses-merkezi" && item.status === "active" && item.payment_status === "paid"
      && (!item.expires_at || Date.parse(item.expires_at) > Date.now()));
    if (hasPaidLicense) return { active: false, reason: "license_already_assigned", remaining_seconds: 0 };
  }

  const { data: existing, error: existingError } = await admin.from("sesm_trials")
    .select("user_id,device_hash,platform,started_at,expires_at,revoked").eq("user_id", userId).maybeSingle();
  if (existingError) return { active: false, reason: "trial_service_unavailable", remaining_seconds: 0 };
  if (existing) {
    if (existing.device_hash !== deviceHash) return { active: false, reason: "trial_device_mismatch", remaining_seconds: 0 };
    const status = trialStatus(existing);
    if (status.active) await admin.from("sesm_trials").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId);
    return status;
  }

  const { data: usedDevice, error: usedDeviceError } = await admin.from("sesm_trials")
    .select("user_id").eq("device_hash", deviceHash).maybeSingle();
  if (usedDeviceError) return { active: false, reason: "trial_service_unavailable", remaining_seconds: 0 };
  if (usedDevice) return { active: false, reason: "device_trial_already_used", remaining_seconds: 0 };

  const { data: created, error: createError } = await admin.from("sesm_trials")
    .insert({ user_id: userId, device_hash: deviceHash, platform: expectedPlatform })
    .select("user_id,device_hash,platform,started_at,expires_at,revoked").single();
  if (createError || !created) {
    if (createError?.code === "23505") {
      const { data: racedUser, error: racedUserError } = await admin.from("sesm_trials")
        .select("user_id,device_hash,platform,started_at,expires_at,revoked").eq("user_id", userId).maybeSingle();
      if (racedUserError) return { active: false, reason: "trial_service_unavailable", remaining_seconds: 0 };
      if (racedUser) return racedUser.device_hash === deviceHash ? trialStatus(racedUser) : { active: false, reason: "trial_device_mismatch", remaining_seconds: 0 };
      const { data: racedDevice, error: racedDeviceError } = await admin.from("sesm_trials")
        .select("user_id").eq("device_hash", deviceHash).maybeSingle();
      if (racedDeviceError) return { active: false, reason: "trial_service_unavailable", remaining_seconds: 0 };
      if (racedDevice) return { active: false, reason: "device_trial_already_used", remaining_seconds: 0 };
    }
    return { active: false, reason: "trial_start_failed", remaining_seconds: 0 };
  }
  return trialStatus(created);
}

async function entitlementContext(userId: string, deviceHash: string, role: string, platform: unknown, requestedAppId = "") {
  const licensed = await licensedContext(userId, deviceHash, role, requestedAppId);
  const trial = role === "owner" ? { active: false, reason: "owner_account", remaining_seconds: 0 }
    : await trialContext(userId, deviceHash, platform, requestedAppId, licensed);
  return { licensed, trial, paid: role === "owner" || licensed.active };
}


const OFFLINE_PAID_LEASE_MS = 14 * 24 * 60 * 60 * 1000;
const OFFLINE_TRIAL_LEASE_MS = 7 * 24 * 60 * 60 * 1000;
let offlineLeaseSigningKey: CryptoKey | null = null;
let offlineLeasePublicKeyPem: string | null = null;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  let encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_");
  while (encoded.endsWith("=")) encoded = encoded.slice(0, -1);
  return encoded;
}

async function getOfflineLeaseSigningKey(): Promise<CryptoKey | null> {
  if (offlineLeaseSigningKey) return offlineLeaseSigningKey;
  const { data, error } = await admin.rpc("sesm_offline_lease_private_key");
  if (error || typeof data !== "string" || !data.includes("BEGIN PRIVATE KEY")) {
    console.error("Offline lease signing key unavailable", error?.message ?? "missing");
    return null;
  }
  const encoded = data
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .split("").filter((char) => char.charCodeAt(0) > 32).join("");
  const binary = atob(encoded);
  const der = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

  // Derive only the public JWK members, then re-import the signing key as non-exportable.
  const derivationKey = await crypto.subtle.importKey("pkcs8", der, algorithm, true, ["sign"]);
  const privateJwk = await crypto.subtle.exportKey("jwk", derivationKey);
  if (!privateJwk.n || !privateJwk.e) throw new Error("Offline lease RSA public parameters unavailable.");
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: privateJwk.n, e: privateJwk.e, alg: "RS256", ext: true, key_ops: ["verify"] },
    algorithm,
    true,
    ["verify"],
  );
  const publicDer = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
  let publicBinary = "";
  for (const byte of publicDer) publicBinary += String.fromCharCode(byte);
  const publicBase64 = btoa(publicBinary).match(/.{1,64}/g)?.join("\n") ?? "";
  offlineLeasePublicKeyPem = "-----BEGIN PUBLIC KEY-----\n" + publicBase64 + "\n-----END PUBLIC KEY-----";

  offlineLeaseSigningKey = await crypto.subtle.importKey("pkcs8", der, algorithm, false, ["sign"]);
  return offlineLeaseSigningKey;
}

async function getOfflineLeasePublicKeyPem(): Promise<string | null> {
  const signingKey = await getOfflineLeaseSigningKey();
  return signingKey ? offlineLeasePublicKeyPem : null;
}

async function createOfflineLease(
  userId: string,
  deviceHash: string,
  platform: unknown,
  appId: string,
  entitlement: { licensed: any; trial: any; paid: boolean },
) {
  if (!/^[0-9a-f]{64}$/.test(deviceHash)) return null;
  if (!["ses-merkezi", "ses-merkezi-android"].includes(appId)) return null;
  const expectedPlatform = appId === "ses-merkezi-android" ? "android" : "windows";
  if (platform !== expectedPlatform) return null;
  const isPaid = entitlement.paid === true;
  const isTrial = !isPaid && entitlement.trial?.active === true;
  if (!isPaid && !isTrial) return null;

  const issuedAt = Date.now();
  const licenseExpiry = entitlement.licensed?.expires_at
    ? Date.parse(String(entitlement.licensed.expires_at)) : null;
  const trialExpiry = isTrial && entitlement.trial?.expires_at
    ? Date.parse(String(entitlement.trial.expires_at)) : null;
  if (isPaid && licenseExpiry !== null && (!Number.isFinite(licenseExpiry) || licenseExpiry <= issuedAt)) return null;
  if (isTrial && (trialExpiry === null || !Number.isFinite(trialExpiry) || trialExpiry <= issuedAt)) return null;
  const expiresAt = isPaid
    ? Math.min(issuedAt + OFFLINE_PAID_LEASE_MS, licenseExpiry ?? Number.POSITIVE_INFINITY)
    : Math.min(issuedAt + OFFLINE_TRIAL_LEASE_MS, trialExpiry!);
  if (!Number.isFinite(expiresAt) || expiresAt <= issuedAt) return null;

  const signingKey = await getOfflineLeaseSigningKey();
  if (!signingKey) return null;
  const claims = {
    v: 1,
    uid: userId,
    app_id: appId,
    platform: expectedPlatform,
    device_hash: deviceHash,
    entitlement: isPaid ? "paid" : "trial",
    paid: isPaid,
    plan_code: isPaid ? (entitlement.licensed?.plan_code ?? "student") : "trial",
    bundle_code: isPaid ? (entitlement.licensed?.bundle_code ?? "start") : "trial",
    license_expires_at_ms: Number.isFinite(licenseExpiry) ? licenseExpiry : null,
    trial_expires_at_ms: Number.isFinite(trialExpiry) ? trialExpiry : null,
    issued_at_ms: issuedAt,
    expires_at_ms: expiresAt,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(claims));
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingKey, payloadBytes));
  return { v: 1, alg: "RS256", payload: base64Url(payloadBytes), signature: base64Url(signature) };
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
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 256 * 1024) return fail("PAYLOAD_TOO_LARGE", 413);
    let body: any;
    try { body = rawBody ? JSON.parse(rawBody) : {}; }
    catch { return fail("INVALID_JSON", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("INVALID_REQUEST", 400);
    const action = typeof body?.action === "string" ? body.action : "";
    if (action === "student_signup") {
      const digits = String(body.phone ?? "").replace(/\D/g, "");
      let normalizedDigits = "";
      if (digits.length === 10 && digits.startsWith("5")) normalizedDigits = "90" + digits;
      else if (digits.length === 11 && digits.startsWith("05")) normalizedDigits = "90" + digits.slice(1);
      else if (digits.length === 12 && digits.startsWith("905")) normalizedDigits = digits;
      else return fail("STUDENT_PHONE_INVALID", 400);
      const normalizedPhone = "+" + normalizedDigits;
      const password = String(body.password ?? "");
      const displayName = String(body.display_name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (password.length < 8 || password.length > 256 || displayName.length < 2) return fail("STUDENT_SIGNUP_DATA_INVALID", 400);
      const forwarded = req.headers.get("cf-connecting-ip")?.trim() || "unknown";
      const ipHash = await sha256Hex(forwarded || "unknown");
      const { data: withinRateLimit, error: rateLimitError } = await admin.rpc("check_login_rate_limit", {
        p_key: "student-signup:" + ipHash,
        p_max: 5,
      });
      if (rateLimitError) return fail("RATE_LIMIT_SERVICE_UNAVAILABLE", 503);
      if (withinRateLimit !== true) return fail("RATE_LIMITED", 429);
      const aliasEmail = normalizedPhone.slice(1) + "@students.stagepulse.invalid";
      const { data, error } = await admin.auth.admin.createUser({
        email: aliasEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName, phone: normalizedPhone, account_type: "student" },
      });
      if (error || !data?.user) {
        return fail("STUDENT_SIGNUP_UNAVAILABLE", 503);
      }
      return reply({ ok: true, user_id: data.user.id });
    }
    const { user, token } = await requireUser(req);
    // Kullanıcı ve IP birlikte sınırlandırılır; ortak NAT kullanan hesaplar birbirini kilitlemez.
    const forwarded = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? "unknown";
    const { data: withinRateLimit, error: rateLimitError } = await admin.rpc("check_login_rate_limit", {
      p_key: "ses-merkezi-desktop:" + user.id + ":" + forwarded,
      p_max: 60,
    });
    if (rateLimitError) return fail("RATE_LIMIT_SERVICE_UNAVAILABLE", 503);
    if (withinRateLimit !== true) return fail("RATE_LIMITED", 429);
    const role = await getRole(user.id);
    if (action === "store_get") {
      const { data, error } = await admin.from("sesm_store_settings").select("product_code,product_name,price,currency,bank_name,account_holder,iban,payment_instructions,contact_phone,measurement_settings").eq("id", true).single();
      if (error || !data) return fail("STORE_SETTINGS_UNAVAILABLE",503);
      return reply({ok:true,settings:data});
    }
    if (action === "store_update") {
      await requireOwner(user.id);
      const price=Number(body.price), bankName=String(body.bank_name??"").trim().slice(0,120), accountHolder=String(body.account_holder??"").trim().slice(0,120);
      const iban=String(body.iban??"").replace(/\s+/g,"").toUpperCase().slice(0,34), paymentInstructions=String(body.payment_instructions??"").trim().slice(0,1000), contactPhone=String(body.contact_phone??"").trim().slice(0,40);
      if (!Number.isFinite(price) || price < 0 || price > 2500) return fail("FULL_PACKAGE_PRICE_LIMIT", 400);
      if(iban&&!/^TR[0-9]{24}$/.test(iban))return fail("STORE_IBAN_INVALID",400);
      const {data:currentSettings,error:currentSettingsError}=await admin.from("sesm_store_settings").select("measurement_settings").eq("id",true).single();
      if(currentSettingsError||!currentSettings)return fail("STORE_SETTINGS_UNAVAILABLE",503);
      const currentMeasurement=currentSettings.measurement_settings||{advanced_rta_enabled:true,microphone_correction_enabled:true};
      let measurementSettings=currentMeasurement;
      if(body.measurement_settings!==undefined){
        const incoming=body.measurement_settings;
        if(!incoming||typeof incoming!=="object"||Array.isArray(incoming))return fail("MEASUREMENT_SETTINGS_INVALID",400);
        const advanced=incoming.advanced_rta_enabled===undefined?currentMeasurement.advanced_rta_enabled:incoming.advanced_rta_enabled;
        const correction=incoming.microphone_correction_enabled===undefined?currentMeasurement.microphone_correction_enabled:incoming.microphone_correction_enabled;
        if(typeof advanced!=="boolean"||typeof correction!=="boolean")return fail("MEASUREMENT_SETTINGS_INVALID",400);
        measurementSettings={advanced_rta_enabled:advanced,microphone_correction_enabled:correction};
      }
      const {data,error}=await admin.from("sesm_store_settings").update({price,currency:"TRY",product_code:"full_package",product_name:"FULL PAKET",bank_name:bankName,account_holder:accountHolder,iban,payment_instructions:paymentInstructions,contact_phone:contactPhone,measurement_settings:measurementSettings,updated_at:new Date().toISOString(),updated_by:user.id}).eq("id",true).select("product_code,product_name,price,currency,bank_name,account_holder,iban,payment_instructions,contact_phone,measurement_settings").single();
      if(error||!data)return fail("STORE_SETTINGS_SAVE_FAILED",500);
      await audit(user.id,"full_package_store_updated",null,null,{price,bank_name:bankName,iban_configured:!!iban,measurement_settings:measurementSettings});
      return reply({ok:true,settings:data});
    }
    if (action === "purchase_submit") {
      const {data:settings,error:settingsError}=await admin.from("sesm_store_settings").select("price,account_holder,iban").eq("id",true).single();
      if(settingsError||!settings)return fail("STORE_SETTINGS_UNAVAILABLE",503);
      if(!settings.iban||!settings.account_holder)return fail("BANK_DETAILS_NOT_CONFIGURED",409);
      const customerName=String(body.customer_name??user.user_metadata?.display_name??user.user_metadata?.full_name??"").trim().slice(0,120);
      const customerEmail=String(user.email??"").trim().toLowerCase().slice(0,320), customerPhone=String(body.customer_phone??"").trim().slice(0,40);
      const transferReference=String(body.transfer_reference??"").trim().slice(0,120), customerNote=String(body.customer_note??"").trim().slice(0,500);
      if(customerName.length<2||!customerEmail.includes("@")||transferReference.length<3)return fail("PURCHASE_DETAILS_INVALID",400);
      const {data:existing,error:lookupError}=await admin.from("sesm_purchase_requests").select("id,status").eq("user_id",user.id).in("status",["pending","approved"]).maybeSingle();
      if(lookupError)return fail("PURCHASE_LOOKUP_FAILED",500);
      if(existing?.status==="approved")return fail("PURCHASE_ALREADY_APPROVED",409);
      if(existing?.status==="pending")return fail("PURCHASE_ALREADY_PENDING",409);
      const {data:purchase,error}=await admin.from("sesm_purchase_requests").insert({user_id:user.id,product_code:"full_package",product_name:"FULL PAKET",amount:settings.price,currency:"TRY",customer_name:customerName,customer_email:customerEmail,customer_phone:customerPhone,transfer_reference:transferReference,customer_note:customerNote}).select("id,product_name,amount,currency,status,created_at").single();
      if(error?.code==="23505")return fail("PURCHASE_ALREADY_PENDING",409);
      if(error||!purchase)return fail("PURCHASE_SUBMIT_FAILED",500);
      await audit(user.id,"full_package_purchase_submitted",user.id,null,{purchase_id:purchase.id,amount:purchase.amount});
      return reply({ok:true,purchase});
    }
    if (action === "purchase_list") {
      await requireOwner(user.id);
      const {data,error}=await admin.from("sesm_purchase_requests").select("id,user_id,product_name,amount,currency,customer_name,customer_email,customer_phone,transfer_reference,customer_note,status,admin_note,reviewed_at,license_id,created_at").order("created_at",{ascending:false}).limit(300);
      if(error)return fail("PURCHASE_LIST_FAILED",500); return reply({ok:true,purchases:data??[]});
    }
    if (action === "purchase_review") {
      await requireOwner(user.id);
      const purchaseId=String(body.purchase_id??"").trim(), decision=String(body.decision??""), adminNote=String(body.admin_note??"").trim().slice(0,500);
      if(!purchaseId||!["approved","rejected"].includes(decision))return fail("PURCHASE_REVIEW_INVALID",400);
      if(decision==="rejected"){
        const {data,error}=await admin.from("sesm_purchase_requests").update({status:"rejected",admin_note:adminNote,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",purchaseId).eq("status","pending").select("id,status").maybeSingle();
        if(error)return fail("PURCHASE_REVIEW_FAILED",500); if(!data)return fail("PURCHASE_NOT_PENDING",409);
        await audit(user.id,"full_package_purchase_rejected",null,null,{purchase_id:purchaseId}); return reply({ok:true,purchase:data});
      }
      const rawKey=issueLicenseKey(), keyHash=await sha256Hex(normalizeKey(rawKey));
      const {data:approved,error}=await admin.rpc("sesm_review_full_package_purchase",{p_purchase_id:purchaseId,p_owner_user_id:user.id,p_key_hash:keyHash});
      if(error||!approved){console.error("Full package purchase approval failed",error?.message);return fail(error?.code==="P0002"?"PURCHASE_NOT_FOUND":"PURCHASE_REVIEW_FAILED",error?.code==="P0002"?404:500);}
      if(adminNote)await admin.from("sesm_purchase_requests").update({admin_note:adminNote}).eq("id",purchaseId);
      return reply({ok:true,purchase:approved,key:rawKey});
    }
    if (action === "context") {
      const deviceHash = String(body.device_hash ?? "");
      const requestedAppId = String(body.app_id ?? "");
      const entitlement = await entitlementContext(user.id, deviceHash, role, body.platform, requestedAppId);
      const offlineLease = await createOfflineLease(user.id, deviceHash, body.platform, requestedAppId, entitlement);
      const offlineLeasePublicKey = offlineLease ? await getOfflineLeasePublicKeyPem() : null;
      const { data: ownStudent } = await admin.from("sesm_students").select("display_name, email, teacher_user_id")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      return reply({ ok: true, user: { id: user.id, email: user.email?.endsWith("@students.stagepulse.invalid") ? null : (user.email ?? null), phone: user.user_metadata?.phone ?? user.phone ?? null, name: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "" }, role, licensed: entitlement.licensed, trial: entitlement.trial, offline_lease: offlineLease, offline_lease_public_key: offlineLeasePublicKey, entitlements: { paid: entitlement.paid, demo: entitlement.trial.active === true }, student: ownStudent ?? null, app: "Stagepulse Ses Mühendisliği Merkezi" });
    }
    if (action === "license_status") {
      const deviceHash = String(body.device_hash ?? "");
      const requestedAppId = String(body.app_id ?? "");
      const entitlement = await entitlementContext(user.id, deviceHash, role, body.platform, requestedAppId);
      const offlineLease = await createOfflineLease(user.id, deviceHash, body.platform, requestedAppId, entitlement);
      const offlineLeasePublicKey = offlineLease ? await getOfflineLeasePublicKeyPem() : null;
      return reply({ ok: true, licensed: entitlement.licensed, trial: entitlement.trial, offline_lease: offlineLease, offline_lease_public_key: offlineLeasePublicKey, entitlements: { paid: entitlement.paid, demo: entitlement.trial.active === true }, role });
    }
    if (action === "feature_access" || action === "pdf_access") {
      const entitlement = await entitlementContext(user.id, String(body.device_hash ?? ""), role, body.platform, String(body.app_id ?? ""));
      const feature = action === "pdf_access" ? "pdf_library" : String(body.feature ?? "");
      const allowed = entitlement.paid || entitlement.trial.active === true;
      return reply({ ok: true, feature, allowed, paid: entitlement.paid, trial: entitlement.trial, reason: allowed ? null : (entitlement.trial.reason || "license_required") });
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
      const { data: activation, error } = await admin.rpc("sesm_revoke_activation", {
        p_license_id: licenseId,
        p_activation_id: activationId,
      });
      if (error || !activation?.ok) return fail("ACTIVATION_REVOKE_FAILED", 500);
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
      const customerName = String(body.customer_name ?? "").trim().slice(0, 120);
      const customerEmail = String(body.customer_email ?? "").trim().toLowerCase().slice(0, 320);
      const paymentMethod = String(body.payment_method ?? "");
      const paymentStatus = String(body.payment_status ?? "unpaid");
      const paymentReference = String(body.payment_reference ?? "").trim().slice(0, 120);
      const notes = String(body.notes ?? "").trim().slice(0, 500);
      const amount = Number(body.amount);
      const maxDevices = Number(body.max_activations ?? 3);
      if (customerName.length < 2 || (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))
        || !["cash", "bank_transfer"].includes(paymentMethod)
        || !["paid", "unpaid"].includes(paymentStatus)
        || !Number.isFinite(amount) || amount < 0 || amount > 2500
        || ![1, 2, 3, 5].includes(maxDevices)) return fail("LICENSE_CREATE_DATA_INVALID", 400);
      if (paymentStatus === "paid" && paymentMethod === "bank_transfer" && paymentReference.length < 3) {
        return fail("PAYMENT_REFERENCE_REQUIRED", 400);
      }
      const rawKey = issueLicenseKey();
      const keyHash = await sha256Hex(normalizeKey(rawKey));
      const { data, error } = await admin.rpc("sesm_create_manual_full_package_license", {
        p_owner_user_id: user.id,
        p_key_hash: keyHash,
        p_customer_name: customerName,
        p_customer_email: customerEmail,
        p_payment_method: paymentMethod,
        p_payment_status: paymentStatus,
        p_amount: amount,
        p_payment_reference: paymentReference,
        p_admin_note: notes,
        p_max_devices: maxDevices,
      });
      if (error || !data?.license_id) {
        console.error("Manual FULL PAKET license creation failed", error?.message ?? "missing license id");
        return fail(error?.code === "42501" ? "FORBIDDEN_OWNER_ONLY" : "LICENSE_CREATE_FAILED", error?.code === "42501" ? 403 : 500);
      }
      return reply({
        ok: true,
        key: rawKey,
        license: {
          id: data.license_id,
          label: "FULL PAKET",
          plan_code: "student",
          bundle_code: "full_master",
          max_activations: maxDevices,
          expires_at: null,
          payment_status: paymentStatus,
          amount,
          currency: "TRY",
        },
      }, 201);
    }
    if (action === "license_payment_update") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      const paymentStatus = String(body.payment_status ?? "");
      if (!licenseId || !["paid", "unpaid", "refunded"].includes(paymentStatus)) return fail("LICENSE_PAYMENT_DATA_INVALID", 400);
      const { data: lic, error } = await admin.rpc("sesm_set_license_payment_status", {
        p_license_id: licenseId,
        p_owner_user_id: user.id,
        p_payment_status: paymentStatus,
      });
      if (error) {
        console.error("Atomic license payment update failed", error.message);
        return fail(error.code === "P0002" ? "LICENSE_NOT_FOUND" : "LICENSE_PAYMENT_SYNC_FAILED", error.code === "P0002" ? 404 : 500);
      }
      if (!lic) return fail("LICENSE_NOT_FOUND", 404);
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
      const licenseId = String(body.license_id ?? "").trim();
      if (!licenseId) return fail("LICENSE_NOT_FOUND", 404);
      const { data, error } = await admin.rpc("sesm_revoke_license_atomic", {
        p_license_id: licenseId,
        p_owner_user_id: user.id,
      });
      if (error) {
        console.error("Atomic license revoke failed", error.message);
        return fail(error.code === "P0002" ? "LICENSE_NOT_FOUND" : "LICENSE_REVOKE_FAILED", error.code === "P0002" ? 404 : 500);
      }
      if (!data) return fail("LICENSE_NOT_FOUND", 404);
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
