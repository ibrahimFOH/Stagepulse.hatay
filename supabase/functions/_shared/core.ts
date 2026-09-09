import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://stagepulse.com.tr",
  "https://www.stagepulse.com.tr",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function corsFor(req?: Request) {
  if (!req) return cors;
  const origin = req.headers.get("origin");
  return origin && ALLOWED_ORIGINS.has(origin)
    ? { ...cors, "Access-Control-Allow-Origin": origin, "Vary": "Origin" }
    : { ...cors, "Access-Control-Allow-Origin": "null" };
}

export function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function options(req?: Request) {
  return new Response(null, { status: 204, headers: corsFor(req) });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment is not configured");

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function membershipRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("org_memberships")
    .select("role:role_id(code,is_admin_role,active),active")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(20);
  if (error) throw error;
  const memberships = Array.isArray(data) ? data : [];
  const membership: any = memberships.find((m: any) => Array.isArray(m?.role) ? m.role[0]?.code : m?.role?.code);
  const role = Array.isArray(membership?.role) ? membership.role[0] : membership?.role;
  return role ?? null;
}

export async function isPatron(ctxOrUser: any) {
  const user = ctxOrUser?.userClaims ?? ctxOrUser;
  const userId = String(user?.id ?? "");
  if (!userId) return false;
  const role = await membershipRole(userId);
  const code = String(role?.code ?? "").toLowerCase();
  return role?.is_admin_role === true || ["patron", "owner", "admin"].includes(code);
}

export async function patronGuard(ctx: any) {
  if (!ctx?.userClaims?.id) throw new Error("AUTH_REQUIRED");
  if (!(await isPatron(ctx))) throw new Error("PATRON_REQUIRED");
  return ctx.userClaims;
}

export const withPatron = (handler: any) => async (req: Request) => {
  if (req.method === "OPTIONS") return options(req);
  const user = await getUserFromRequest(req);
  if (!user) return err("AUTH_REQUIRED", undefined, req);
  const ctx = { supabaseAdmin, userClaims: user };
  try {
    await patronGuard(ctx);
    return await handler(req, ctx, user);
  } catch (e) {
    return err(e, undefined, req);
  }
};

function canonical(v: any): any {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => {
      o[k] = canonical(v[k]);
      return o;
    }, {} as any);
  }
  return v;
}

export async function sha256(v: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(v)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "sha256:" + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export function err(e: unknown, status?: number, req?: Request) {
  const msg = e instanceof Error ? e.message : String(e);
  const map: Record<string, [number, string]> = {
    AUTH_REQUIRED: [401, "Oturum gerekli"],
    PATRON_REQUIRED: [403, "Patron yetkisi gerekli"],
    BAD_REQUEST: [400, "Geçersiz istek"],
    FORBIDDEN: [403, "Yetki reddedildi"],
    NOT_FOUND: [404, "Kayıt bulunamadı"],
  };
  const [mappedStatus, text] = map[msg] ?? [500, msg];
  return json({ error: text }, status ?? mappedStatus, req);
}
