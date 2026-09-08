import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "https://stagepulse.com.tr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
const options = () => new Response(null, { status: 204, headers: cors });

async function authenticate(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!/^bearer\s+/i.test(h)) throw Object.assign(new Error("Oturum gerekli."), { status: 401 });
  const token = h.replace(/^bearer\s+/i, "");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Geçersiz oturum."), { status: 401 });
  return { admin, user: data.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  try {
    if (req.method !== "GET" && req.method !== "POST") return json({ error: "GET veya POST gerekli" }, 405);
    const { admin, user } = await authenticate(req);
    const checks: Record<string, unknown> = { auth: true };
    const started = Date.now();

    const [agents, approvals, memory] = await Promise.all([
      admin.from("jarvis_agents").select("id", { count: "exact", head: true }),
      admin.from("jarvis_approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("jarvis_memory").select("id", { count: "exact", head: true }).eq("scope", "patron").eq("scope_id", user.id),
    ]);
    checks.database = !agents.error && !approvals.error && !memory.error;
    checks.agents = { ok: !agents.error, count: agents.count ?? 0 };
    checks.approvals = { ok: !approvals.error, pending: approvals.count ?? 0 };
    checks.memory = { ok: !memory.error, count: memory.count ?? 0 };
    checks.github = Boolean(Deno.env.get("GITHUB_TOKEN"));
    checks.ai = ["GROQ_API_KEY", "GOOGLE_AI_API_KEY", "HUGGINGFACE_API_KEY", "MISTRAL_API_KEY", "DEEPSEEK_API_KEY", "XAI_API_KEY", "NVIDIA_API_KEY", "OPENROUTER_API_KEY", "LLM7_API_KEY"].some((k) => Boolean(Deno.env.get(k)));

    const ok = checks.database === true;
    return json({ ok, service: "jarvis-health", user: user.id, checks, latency_ms: Date.now() - started, version: "repo-v1" }, ok ? 200 : 503);
  } catch (e) {
    const status = Number((e as any)?.status) || 500;
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, status);
  }
});
