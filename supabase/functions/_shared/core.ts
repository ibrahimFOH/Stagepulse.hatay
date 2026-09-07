import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function options() { return new Response("ok", { headers: cors }); }

function envJson(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) || "{}"); } catch { return {}; }
}

function publishableKey() {
  const keys = envJson("SUPABASE_PUBLISHABLE_KEYS");
  return keys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function secretKey() {
  const keys = envJson("SUPABASE_SECRET_KEYS");
  return keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

export function clients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(url, publishableKey(), { global: { headers: auth ? { Authorization: auth } : {} } });
  const admin = createClient(url, secretKey());
  return { userClient, admin };
}

export async function requireUser(req: Request, patron = false) {
  const { userClient } = clients(req);
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("AUTH_REQUIRED");
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) throw new Error("AUTH_REQUIRED");
  const app = user.app_metadata || {};
  const meta = user.user_metadata || {};
  const allowed = ["patron", "owner", "admin"].includes(String(app.role || ""))
    || meta.admin_access === true
    || ["owner", "admin"].includes(String(meta.organization_role || ""));
  if (patron && !allowed) throw new Error("PATRON_REQUIRED");
  return user;
}

function canonical(v: any): any {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.keys(v).sort().reduce((o, k) => { o[k] = canonical(v[k]); return o; }, {} as any);
  return v;
}

export async function sha256(v: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(v)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "sha256:" + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const map: Record<string, [number, string]> = {
    AUTH_REQUIRED: [401, "Oturum gerekli"],
    PATRON_REQUIRED: [403, "Patron yetkisi gerekli"],
    BAD_REQUEST: [400, "Geçersiz istek"],
  };
  const [status, text] = map[msg] || [500, msg];
  return json({ error: text }, status);
}
