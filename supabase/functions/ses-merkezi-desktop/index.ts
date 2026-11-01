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
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}
function fail(req: Request, code: string, status = 400) { return reply(req, { ok: false, error: code }, status); }
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
  // Owner yetkisi sabit bir UUID'ye değil, veritabanındaki aktif organizasyon rolüne bağlıdır.
  const { data: member, error: memberError } = await admin.from("org_memberships")
    .select("active, role:org_roles!org_memberships_role_id_fkey(code,is_admin_role)")
    .eq("user_id", userId).eq("active", true).maybeSingle();
  const rawRole = (member as any)?.role;
  const memberRole = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  if (!memberError && member && memberRole?.code === "owner" && memberRole?.is_admin_role === true) return "owner";
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
async function licensedContext(userId: string, deviceHash: string, role: string) {
  if (role === "owner") return { active: true, plan_code: "owner", bundle_code: "full_master", expires_at: null };
  if (!/^[0-9a-f]{64}$/.test(deviceHash)) return { active: false, reason: "device_id_invalid" };
  const { data: activation } = await admin.from("sesm_activations")
    .select("license_id, is_active, last_seen_at").eq("user_id", userId).eq("device_hash", deviceHash).eq("is_active", true).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  if (!activation) return { active: false, reason: "not_activated" };
  const { data: lic } = await admin.from("sesm_license_keys").select("is_active, plan_code, bundle_code, expires_at, payment_status")
    .eq("id", activation.license_id).maybeSingle();
  const valid = !!lic?.is_active && lic.payment_status === "paid" && (!lic.expires_at || Date.parse(lic.expires_at) > Date.now());
  if (valid) await admin.from("sesm_activations").update({ last_seen_at: new Date().toISOString() }).eq("user_id", userId).eq("device_hash", deviceHash).eq("license_id", activation.license_id);
  return { active: valid, plan_code: valid ? lic!.plan_code : null, bundle_code: valid ? (lic!.bundle_code ?? "start") : null, expires_at: lic?.expires_at ?? null, reason: valid ? null : (lic?.payment_status !== "paid" ? "payment_required" : "expired_or_disabled") };
}
async function requireOwner(userId: string) {
  const role = await getRole(userId);
  if (role !== "owner") throw new Error("FORBIDDEN_OWNER_ONLY");
  return role;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, "METHOD_NOT_ALLOWED", 405);
  try {
    const { user } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const role = await getRole(user.id);
    if (action === "context") {
      const deviceHash = String(body.device_hash ?? "");
      const license = await licensedContext(user.id, deviceHash, role);
      const { data: ownStudent } = await admin.from("sesm_students").select("display_name, email, teacher_user_id")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      return reply(req, { ok: true, user: { id: user.id, email: user.email, name: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "" }, role, licensed: license, student: ownStudent ?? null, app: "Stagepulse Ses Mühendisliği Merkezi" });
    }
    if (action === "license_status") {
      return reply(req, { ok: true, licensed: await licensedContext(user.id, String(body.device_hash ?? ""), role), role });
    }
    if (action === "license_list") {
      await requireOwner(user.id);
      const { data: licenses, error } = await admin.from("sesm_license_keys")
        .select("id,label,plan_code,bundle_code,max_activations,expires_at,is_active,created_at,notes,customer_name,customer_email,payment_method,payment_status,amount,currency,payment_reference")
        .eq("created_by", user.id).order("created_at", { ascending: false }).limit(500);
      if (error) return fail(req, "LICENSE_LIST_FAILED", 500);
      const ids = (licenses ?? []).map((lic: any) => lic.id);
      const activations = ids.length
        ? await admin.from("sesm_activations").select("license_id,device_hash,is_active").in("license_id", ids)
        : { data: [], error: null };
      if (activations.error) return fail(req, "LICENSE_ACTIVATION_LIST_FAILED", 500);
      const counts = new Map<string, Set<string>>();
      for (const item of activations.data ?? []) {
        if (item.is_active) {
          if (!counts.has(item.license_id)) counts.set(item.license_id, new Set<string>());
          counts.get(item.license_id)!.add(item.device_hash);
        }
      }
      return reply(req, { ok: true, licenses: (licenses ?? []).map((lic: any) => ({
        ...lic, active_activations: counts.get(lic.id)?.size ?? 0,
      })) });
    }
    if (action === "license_activations") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      if (!licenseId) return fail(req, "LICENSE_NOT_FOUND", 404);
      const { data: ownedLicense, error: ownedError } = await admin.from("sesm_license_keys")
        .select("id").eq("id", licenseId).eq("created_by", user.id).maybeSingle();
      if (ownedError || !ownedLicense) return fail(req, "LICENSE_NOT_FOUND", 404);
      const { data: rows, error } = await admin.from("sesm_activations")
        .select("id,device_hash,activated_at,last_seen_at,is_active")
        .eq("license_id", licenseId).order("activated_at", { ascending: false }).limit(100);
      if (error) return fail(req, "LICENSE_ACTIVATION_LIST_FAILED", 500);
      return reply(req, { ok: true, activations: (rows ?? []).map((row: any) => ({
        id: row.id, device_hint: String(row.device_hash ?? "").slice(0, 8).toUpperCase(),
        activated_at: row.activated_at, last_seen_at: row.last_seen_at, is_active: !!row.is_active,
      })) });
    }
    if (action === "activation_revoke") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      const activationId = String(body.activation_id ?? "").trim();
      if (!licenseId || !activationId) return fail(req, "ACTIVATION_NOT_FOUND", 404);
      const { data: ownedLicense, error: ownedError } = await admin.from("sesm_license_keys")
        .select("id").eq("id", licenseId).eq("created_by", user.id).maybeSingle();
      if (ownedError || !ownedLicense) return fail(req, "LICENSE_NOT_FOUND", 404);
      const { data: activation, error } = await admin.from("sesm_activations")
        .update({ is_active: false }).eq("id", activationId).eq("license_id", licenseId)
        .select("id,device_hash").maybeSingle();
      if (error || !activation) return fail(req, "ACTIVATION_REVOKE_FAILED", 500);
      await audit(user.id, "activation_revoked", null, licenseId, { device_hint: String(activation.device_hash ?? "").slice(0, 8).toUpperCase() });
      return reply(req, { ok: true });
    }
    if (action === "license_extend") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      const daysToAdd = Number(body.days_to_add);
      if (!licenseId || !Number.isInteger(daysToAdd) || daysToAdd < 1 || daysToAdd > 3650) return fail(req, "LICENSE_EXTENSION_INVALID", 400);
      const { data: lic, error: lookupError } = await admin.from("sesm_license_keys")
        .select("id,expires_at,is_active,plan_code,payment_status").eq("id", licenseId).eq("created_by", user.id).maybeSingle();
      if (lookupError || !lic) return fail(req, "LICENSE_NOT_FOUND", 404);
      if (!lic.is_active) return fail(req, "LICENSE_DISABLED", 409);
      if (lic.payment_status !== "paid") return fail(req, "LICENSE_PAYMENT_REQUIRED", 403);
      if (!lic.expires_at) return fail(req, "LICENSE_LIFETIME_CANNOT_EXTEND", 400);
      const oldExpiry = Date.parse(lic.expires_at);
      const base = Number.isFinite(oldExpiry) && oldExpiry > Date.now() ? oldExpiry : Date.now();
      const nextExpiry = new Date(base + daysToAdd * 86400000).toISOString();
      const { error } = await admin.from("sesm_license_keys").update({ expires_at: nextExpiry })
        .eq("id", licenseId).eq("created_by", user.id);
      if (error) return fail(req, "LICENSE_EXTEND_FAILED", 500);
      await audit(user.id, "license_extended", null, licenseId, { days_added: daysToAdd, expires_at: nextExpiry });
      return reply(req, { ok: true, expires_at: nextExpiry });
    }
    if (action === "audit_list") {
      await requireOwner(user.id);
      const { data: events, error } = await admin.from("sesm_audit_events")
        .select("id,action,license_id,details,created_at").eq("actor_user_id", user.id)
        .order("created_at", { ascending: false }).limit(100);
      if (error) return fail(req, "AUDIT_LIST_FAILED", 500);
      return reply(req, { ok: true, events: events ?? [] });
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
      if (customerEmail && (!customerEmail.includes("@") || customerEmail.length > 320)) return fail(req, "LICENSE_CUSTOMER_EMAIL_INVALID", 400);
      if (!Number.isFinite(amount) || amount < 0 || amount > 999999999 || !/^[A-Z]{3}$/.test(currency)) return fail(req, "LICENSE_PAYMENT_DATA_INVALID", 400);
      const { data: lic, error } = await admin.from("sesm_license_keys").insert({
        key_hash: hash, label, plan_code: plan, bundle_code: bundle, max_activations: maxActivations, expires_at: expiresAt,
        created_by: user.id, notes: String(body.notes ?? "").slice(0, 500), customer_name: customerName,
        customer_email: customerEmail, payment_method: paymentMethod, payment_status: paymentStatus,
        amount, currency, payment_reference: paymentReference,
      }).select("id,label,plan_code,bundle_code,max_activations,expires_at,created_at,customer_name,customer_email,payment_method,payment_status,amount,currency,payment_reference").single();
      if (error || !lic) return fail(req, "LICENSE_CREATE_FAILED", 500);
      await audit(user.id, "license_created", null, lic.id, { label, customer_name: customerName, plan_code: plan, bundle_code: bundle, max_activations: maxActivations, expires_at: expiresAt, payment_status: paymentStatus, payment_method: paymentMethod, amount, currency, payment_reference: paymentReference });
      // Raw key is returned once. Only SHA-256 hash is stored in the database.
      return reply(req, { ok: true, license: lic, key: rawKey });
    }
    if (action === "license_payment_update") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "").trim();
      const paymentStatus = String(body.payment_status ?? "");
      if (!licenseId || !["paid", "unpaid", "refunded"].includes(paymentStatus)) return fail(req, "LICENSE_PAYMENT_DATA_INVALID", 400);
      const { data: lic, error } = await admin.from("sesm_license_keys")
        .update({ payment_status: paymentStatus }).eq("id", licenseId).eq("created_by", user.id)
        .select("id,payment_status,customer_name").maybeSingle();
      if (error || !lic) return fail(req, "LICENSE_NOT_FOUND", 404);
      if (paymentStatus !== "paid") {
        await admin.from("sesm_activations").update({ is_active: false }).eq("license_id", licenseId);
        await admin.from("sesm_students").update({ is_active: false }).eq("license_id", licenseId).eq("teacher_user_id", user.id);
      }
      await audit(user.id, "license_payment_updated", null, licenseId, { payment_status: paymentStatus });
      return reply(req, { ok: true, license: lic });
    }
    if (action === "license_activate") {
      // Any authenticated account may redeem a valid owner-issued license key.
      const key = normalizeKey(body.key);
      const deviceHash = String(body.device_hash ?? "");
      if (key.length < 30 || key.length > 64 || !/^[A-Z0-9]+$/.test(key)) return fail(req, "LICENSE_FORMAT_INVALID", 400);
      if (!/^[0-9a-f]{64}$/.test(deviceHash)) return fail(req, "DEVICE_ID_INVALID", 400);
      const hash = await sha256Hex(key);
      const displayName = String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? body.display_name ?? "").trim().slice(0, 120);
      const { data, error } = await admin.rpc("sesm_activate_license", { p_key_hash: hash, p_user_id: user.id, p_device_hash: deviceHash, p_email: user.email ?? "", p_display_name: displayName });
      if (error) {
        const raw = String(error.message ?? "");
        if (raw.includes("LICENSE_PAYMENT_REQUIRED")) return fail(req, "LICENSE_PAYMENT_REQUIRED", 403);
        if (raw.includes("LICENSE_INVALID_OR_EXPIRED")) return fail(req, "LICENSE_INVALID_OR_EXPIRED", 403);
        if (raw.includes("LICENSE_ACTIVATION_LIMIT")) return fail(req, "LICENSE_ACTIVATION_LIMIT", 409);
        if (raw.includes("STUDENT_ALREADY_LINKED")) return fail(req, "STUDENT_ALREADY_LINKED", 409);
        if (raw.includes("DEVICE_BOUND_TO_OTHER_USER")) return fail(req, "DEVICE_BOUND_TO_OTHER_USER", 409);
        return fail(req, "LICENSE_ACTIVATION_FAILED", 400);
      }
      await audit(user.id, "license_activated", user.id, data?.license_id ?? null, { device_hash_prefix: deviceHash.slice(0, 8) });
      return reply(req, { ok: true, result: data, role: "student" });
    }
    if (action === "teacher_students") {
      await requireOwner(user.id);
      const { data: students, error } = await admin.from("sesm_students").select("user_id,license_id,email,display_name,is_active,created_at,updated_at").eq("teacher_user_id", user.id).order("created_at", { ascending: false });
      if (error) return fail(req, "STUDENTS_READ_FAILED", 500);
      const ids = (students ?? []).map((s: any) => s.user_id);
      const progress = ids.length ? await admin.from("sesm_progress").select("student_user_id,module_id,completed,marked_at,teacher_note,updated_at").in("student_user_id", ids) : { data: [], error: null };
      return reply(req, { ok: true, students: students ?? [], progress: progress.data ?? [] });
    }
    if (action === "progress_get") {
      let target = user.id;
      if (role === "owner") target = String(body.student_user_id ?? user.id);
      else if (role !== "student") return fail(req, "LICENSE_REQUIRED", 403);
      if (target !== user.id && role !== "owner") return fail(req, "FORBIDDEN", 403);
      if (role === "owner" && target !== user.id) {
        const { data: student } = await admin.from("sesm_students").select("user_id").eq("user_id", target).eq("teacher_user_id", user.id).maybeSingle();
        if (!student) return fail(req, "STUDENT_NOT_FOUND", 404);
      }
      const { data, error } = await admin.from("sesm_progress").select("module_id,completed,marked_by,marked_at,teacher_note,updated_at").eq("student_user_id", target);
      if (error) return fail(req, "PROGRESS_READ_FAILED", 500);
      return reply(req, { ok: true, student_user_id: target, progress: data ?? [], editable: role === "owner" && target !== user.id });
    }
    if (action === "progress_mark") {
      await requireOwner(user.id);
      const target = String(body.student_user_id ?? "");
      const moduleId = String(body.module_id ?? "");
      const completed = body.completed === true;
      const note = String(body.teacher_note ?? "").trim().slice(0, 1000);
      if (!target || !MODULES.has(moduleId)) return fail(req, "PROGRESS_INPUT_INVALID", 400);
      const { data: student } = await admin.from("sesm_students").select("user_id,license_id").eq("user_id", target).eq("teacher_user_id", user.id).eq("is_active", true).maybeSingle();
      if (!student) return fail(req, "STUDENT_NOT_FOUND", 404);
      const row = { student_user_id: target, module_id: moduleId, completed, marked_by: completed ? user.id : null, marked_at: completed ? new Date().toISOString() : null, teacher_note: note, updated_at: new Date().toISOString() };
      const { data, error } = await admin.from("sesm_progress").upsert(row, { onConflict: "student_user_id,module_id" }).select().single();
      if (error || !data) return fail(req, "PROGRESS_SAVE_FAILED", 500);
      await audit(user.id, completed ? "progress_marked_complete" : "progress_marked_incomplete", target, student.license_id, { module_id: moduleId });
      return reply(req, { ok: true, progress: data });
    }
    if (action === "license_revoke") {
      await requireOwner(user.id);
      const licenseId = String(body.license_id ?? "");
      const { data, error } = await admin.from("sesm_license_keys").update({ is_active: false }).eq("id", licenseId).eq("created_by", user.id).select("id").maybeSingle();
      if (error || !data) return fail(req, "LICENSE_NOT_FOUND", 404);
      await admin.from("sesm_activations").update({ is_active: false }).eq("license_id", licenseId);
      await admin.from("sesm_students").update({ is_active: false }).eq("license_id", licenseId).eq("teacher_user_id", user.id);
      await audit(user.id, "license_revoked", null, licenseId);
      return reply(req, { ok: true });
    }
    return fail(req, "UNKNOWN_ACTION", 400);
  } catch (err) {
    const message = String((err as Error)?.message ?? "INTERNAL_ERROR");
    if (message === "UNAUTHENTICATED") return fail(req, "UNAUTHENTICATED", 401);
    if (message === "FORBIDDEN_OWNER_ONLY") return fail(req, "FORBIDDEN_OWNER_ONLY", 403);
    return fail(req, "INTERNAL_ERROR", 500);
  }
});
