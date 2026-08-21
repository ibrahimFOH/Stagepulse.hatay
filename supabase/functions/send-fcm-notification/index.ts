import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED = new Set(["https://stagepulse.com.tr", "https://www.stagepulse.com.tr"]);
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
const cors = (req: Request) => ({ "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": ALLOWED.has(req.headers.get("origin") || "") ? req.headers.get("origin")! : "https://stagepulse.com.tr", "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" });
const out = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors(req) });

async function requireAdmin(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.toLowerCase().startsWith("bearer ")) throw new Error("UNAUTHENTICATED");
  const { data, error } = await admin.auth.getUser(h.slice(7).trim());
  if (error || !data.user) throw new Error("UNAUTHENTICATED");
  const { data: profile, error: pe } = await admin.from("admin_profiles").select("active").eq("user_id", data.user.id).maybeSingle();
  if (pe || !profile?.active) throw new Error("FORBIDDEN");
  return data.user;
}

const b64url = (bytes: Uint8Array | string) => {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = ""; for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const pemDer = (pem: string) => Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), c => c.charCodeAt(0));

async function fcmAccessToken() {
  const project = Deno.env.get("FCM_PROJECT_ID");
  const email = Deno.env.get("FCM_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FCM_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!project || !email || !privateKey) throw new Error("FCM_NOT_CONFIGURED");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemDer(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }) });
  const token = await tokenRes.json();
  if (!tokenRes.ok || !token.access_token) throw new Error("FCM_AUTH_FAILED");
  return { project, accessToken: token.access_token };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return out(req, { error: "Method Not Allowed" }, 405);
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((v: unknown): v is string => typeof v === "string") : [];
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "Stagepulse";
    const text = typeof body.body === "string" ? body.body.trim().slice(0, 1000) : "";
    if (!userIds.length || !text) return out(req, { error: "user_ids ve body gerekli." }, 400);
    const { data: devices, error } = await admin.from("notification_devices").select("id,token").in("user_id", userIds).eq("active", true);
    if (error) throw error;
    if (!devices?.length) return out(req, { ok: true, sent: 0, stale: 0 });
    const { project, accessToken } = await fcmAccessToken();
    let sent = 0, stale = 0;
    for (const device of devices) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ message: { token: device.token, notification: { title, body: text }, data: { url: typeof body.url === "string" ? body.url.slice(0, 500) : "/portal/", kind: typeof body.kind === "string" ? body.kind.slice(0, 80) : "system" } } }) });
      if (r.ok) { sent++; continue; }
      const detail = await r.text();
      if (r.status === 404 || r.status === 410 || /UNREGISTERED|NOT_FOUND/i.test(detail)) { stale++; await admin.from("notification_devices").update({ active: false, updated_at: new Date().toISOString() }).eq("id", device.id); }
    }
    return out(req, { ok: true, sent, stale, total: devices.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "FCM gönderimi başarısız.";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : message === "FCM_NOT_CONFIGURED" ? 503 : 500;
    return out(req, { error: message }, status);
  }
});
