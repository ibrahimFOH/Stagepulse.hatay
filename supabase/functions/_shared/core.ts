import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });

export const options = () => new Response(null, { status: 204, headers: cors });

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

export function isPatron(ctxOrRole: any) {
  const claims = ctxOrRole?.userClaims ?? ctxOrRole;
  const app = claims?.app_metadata ?? {};
  const meta = claims?.user_metadata ?? {};
  const role = String(app.role ?? meta.role ?? "").toLowerCase();
  return ["patron", "owner", "admin"].includes(role) ||
    meta.admin_access === true ||
    ["owner", "admin"].includes(String(meta.organization_role ?? "").toLowerCase());
}

export function patronGuard(ctx: any) {
  if (!ctx?.userClaims?.id) throw new Error("AUTH_REQUIRED");
  if (!isPatron(ctx)) throw new Error("PATRON_REQUIRED");
  return ctx.userClaims;
}

export const withPatron = (handler: any) => async (req: Request) => {
  if (req.method === "OPTIONS") return options();
  const user = await getUserFromRequest(req);
  if (!user) return err("AUTH_REQUIRED");
  const ctx = { supabaseAdmin, userClaims: user };
  try {
    patronGuard(ctx);
    return await handler(req, ctx, user);
  } catch (e) {
    return err(e);
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

export function err(e: unknown, status?: number) {
  const msg = e instanceof Error ? e.message : String(e);
  const map: Record<string, [number, string]> = {
    AUTH_REQUIRED: [401, "Oturum gerekli"],
    PATRON_REQUIRED: [403, "Patron yetkisi gerekli"],
    BAD_REQUEST: [400, "Geçersiz istek"],
    FORBIDDEN: [403, "Yetki reddedildi"],
    NOT_FOUND: [404, "Kayıt bulunamadı"],
  };
  const [mappedStatus, text] = map[msg] ?? [500, msg];
  return json({ error: text }, status ?? mappedStatus);
}
