import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getClientIp, isDistributedRateLimited } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ADMIN_USERNAME = Deno.env.get("LICENSE_ADMIN_USERNAME") || "";
const PASSWORD_HASH = Deno.env.get("LICENSE_ADMIN_PASSWORD_HASH") || "";
const TOKEN_SECRET = Deno.env.get("LICENSE_ADMIN_TOKEN_SECRET") || "";
const ALLOWED = new Set(["https://stagepulse.com.tr", "https://www.stagepulse.com.tr"]);
const encoder = new TextEncoder();

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://stagepulse.com.tr",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
  };
}
function reply(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}
function clean(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(value: string) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base + "=".repeat((4 - base.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function hmacKey() {
  if (TOKEN_SECRET.length < 32) throw new Error("LICENSE_ADMIN_TOKEN_SECRET must be at least 32 characters");
  return crypto.subtle.importKey("raw", encoder.encode(TOKEN_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signToken(username: string) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(encoder.encode(JSON.stringify({ sub: username, role: "license_admin", iat: now, exp: now + 1800 })));
  const input = `${head}.${body}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(input)));
  return `${input}.${b64url(sig)}`;
}
async function verifyToken(req: Request) {
  const raw = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  try {
    const input = `${parts[0]}.${parts[1]}`;
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(parts[2]), encoder.encode(input));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    return payload.role === "license_admin" && payload.sub === ADMIN_USERNAME && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
async function verifyPassword(password: string) {
  // LICENSE_ADMIN_PASSWORD_HASH format: pbkdf2-sha256$iterations$saltBase64Url$hashBase64Url
  const parts = PASSWORD_HASH.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  try {
    const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromB64url(parts[2]), iterations, hash: "SHA-256" }, material, 256));
    const expected = fromB64url(parts[3]);
    if (derived.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
    return diff === 0;
  } catch { return false; }
}
function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw = b64url(bytes).toUpperCase().replace(/[-_]/g, "").slice(0, 32);
  return `STP-${raw.match(/.{1,4}/g)?.join("-") || raw}`;
}
async function hashKey(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value.trim().toUpperCase())));
  return Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
}
function deviceId(value: unknown) { return clean(value, 160).replace(/[^a-zA-Z0-9._:-]/g, ""); }
Deno.serve(async (req) => {
  const cors = headers(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(req, { error: "Yalnızca POST desteklenir." }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(req, { error: "Lisans veri servisi yapılandırılmamış." }, 503);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return reply(req, { error: "Geçersiz istek." }, 400);
  const action = clean(body.action, 30);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    if (action === "login") {
      if (!ADMIN_USERNAME || !PASSWORD_HASH || TOKEN_SECRET.length < 32) return reply(req, { error: "Lisans yöneticisi henüz güvenli biçimde yapılandırılmamış." }, 503);
      const ip = getClientIp(req);
      if (await isDistributedRateLimited(db, `license-login:ip:${ip}`, 8)) return reply(req, { error: "Çok fazla giriş denemesi. Daha sonra tekrar deneyin." }, 429);
      const username = clean(body.username, 120);
      const password = typeof body.password === "string" ? body.password.slice(0, 1024) : "";
      if (username !== ADMIN_USERNAME || !(await verifyPassword(password))) {
        return reply(req, { error: "Kullanıcı adı veya şifre hatalı." }, 401);
      }
      return reply(req, { ok: true, token: await signToken(username), expires_in: 1800 });
    }

    if (action === "activate" || action === "validate") {
      const key = clean(body.license_key, 100).toUpperCase();
      const device = deviceId(body.device_id);
      if (!key || !device) return reply(req, { valid: false, error: "Lisans anahtarı ve cihaz kimliği gerekli." }, 400);
      if (await isDistributedRateLimited(db, `license-check:ip:${getClientIp(req)}`, 60)) return reply(req, { valid: false, error: "Çok fazla istek." }, 429);
      const licenseHash = await hashKey(key);
      const { data: license, error } = await db.from("stagepulse_licenses").select("id,status,max_devices,activated_devices,expires_at,product_code").eq("license_hash", licenseHash).maybeSingle();
      if (error) throw error;
      if (!license || license.status !== "active" || (license.expires_at && Date.parse(license.expires_at) <= Date.now()) || license.product_code !== clean(body.product_code || "stagepulse", 80)) {
        return reply(req, { valid: false, error: "Lisans geçersiz, iptal edilmiş veya süresi dolmuş." }, 200);
      }
      const devices = Array.isArray(license.activated_devices) ? license.activated_devices : [];
      const known = devices.some((entry: any) => entry && entry.id === device);
      if (action === "activate" && !known) {
        if (devices.length >= Number(license.max_devices)) return reply(req, { valid: false, error: "Lisansın cihaz sınırı dolmuş." }, 200);
        const { error: updateError } = await db.from("stagepulse_licenses").update({ activated_devices: [...devices, { id: device, activated_at: new Date().toISOString() }], updated_at: new Date().toISOString() }).eq("id", license.id).eq("status", "active");
        if (updateError) throw updateError;
      }
      return reply(req, { valid: true, product_code: license.product_code, expires_at: license.expires_at, activated: true });
    }

    if (!(await verifyToken(req))) return reply(req, { error: "Lisans yöneticisi oturumu geçersiz veya süresi dolmuş." }, 401);

    if (action === "list") {
      const { data, error } = await db.from("stagepulse_licenses").select("id,license_prefix,customer_name,product_code,status,max_devices,activated_devices,expires_at,notes,created_at,updated_at,revoked_at").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return reply(req, { ok: true, licenses: data || [] });
    }
    if (action === "create") {
      const customer = clean(body.customer_name, 160);
      const product = clean(body.product_code || "stagepulse", 80).toLowerCase();
      const maxDevices = Number(body.max_devices || 1);
      const expiresRaw = clean(body.expires_at, 40);
      const notes = clean(body.notes, 1000);
      if (!customer) return reply(req, { error: "Müşteri adı zorunludur." }, 400);
      if (!/^[a-z0-9._-]{2,80}$/.test(product)) return reply(req, { error: "Ürün kodu geçersiz." }, 400);
      if (!Number.isInteger(maxDevices) || maxDevices < 1 || maxDevices > 50) return reply(req, { error: "Cihaz sınırı 1 ile 50 arasında olmalıdır." }, 400);
      const expiresAt = expiresRaw ? new Date(expiresRaw).toISOString() : null;
      if (expiresAt && Date.parse(expiresAt) <= Date.now()) return reply(req, { error: "Bitiş tarihi gelecekte olmalıdır." }, 400);
      const key = randomKey();
      const { data, error } = await db.from("stagepulse_licenses").insert({
        license_hash: await hashKey(key), license_prefix: key.slice(0, 12), customer_name: customer,
        product_code: product, max_devices: maxDevices, expires_at: expiresAt, notes: notes || null,
      }).select("id,license_prefix,customer_name,product_code,status,max_devices,expires_at,created_at").single();
      if (error) throw error;
      return reply(req, { ok: true, license: data, license_key: key, warning: "Anahtar yalnızca bu yanıtta gösterilir. Güvenli yerde saklayın." }, 201);
    }
    if (action === "revoke") {
      const id = clean(body.id, 80);
      if (!id) return reply(req, { error: "Lisans kimliği gerekli." }, 400);
      const { data, error } = await db.from("stagepulse_licenses").update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select("id,status,revoked_at").single();
      if (error) throw error;
      return reply(req, { ok: true, license: data });
    }
    return reply(req, { error: "Bilinmeyen işlem." }, 400);
  } catch (error) {
    console.error("[license-admin] request failed", error);
    return reply(req, { error: "İşlem tamamlanamadı. Sunucu kayıtlarını kontrol edin." }, 500);
  }
});
