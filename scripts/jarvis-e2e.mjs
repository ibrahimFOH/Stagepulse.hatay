const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_E2E_EMAIL", "SUPABASE_E2E_PASSWORD"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);

const base = process.env.SUPABASE_URL.replace(/\/$/, "");
const pub = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.SUPABASE_E2E_EMAIL;
const password = process.env.SUPABASE_E2E_PASSWORD;

async function api(path, init = {}) {
  const headers = { apikey: pub, "content-type": "application/json", ...(init.headers || {}) };
  const r = await fetch(`${base}${path}`, { ...init, headers });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

const session = await api("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
if (!session.access_token) throw new Error("Login did not return access_token");
const auth = { Authorization: `Bearer ${session.access_token}` };

const health = await api("/functions/v1/patron-ai", { method: "POST", headers: auth, body: JSON.stringify({ health: true }) });
if (health.ok !== true || health.auth !== "@supabase/server") throw new Error(`patron-ai health failed: ${JSON.stringify(health)}`);

const chat = await api("/functions/v1/patron-ai", { method: "POST", headers: auth, body: JSON.stringify({ message: "Teklifleri canlı veritabanından listele ve kaç kayıt olduğunu söyle." }) });
if (!chat.reply || chat.provider === "fallback") throw new Error(`patron-ai model path failed: ${JSON.stringify(chat)}`);

const read = await api("/functions/v1/jarvis-tools", { method: "POST", headers: auth, body: JSON.stringify({ tool: "leads.list", params: { limit: 5 } }) });
if (read.status !== "ok" || !read.result) throw new Error(`read tool failed: ${JSON.stringify(read)}`);

const name = `JARVIS-E2E-${Date.now()}`;
const create = await api("/functions/v1/jarvis-tools", { method: "POST", headers: auth, body: JSON.stringify({ tool: "agent.create", params: { name, mode: "e2e", system_prompt: "E2E cleanup agent", tools: [] } }) });
if (create.status !== "pending_approval" || !create.approval_id) throw new Error(`approval creation failed: ${JSON.stringify(create)}`);

const approved = await api("/functions/v1/jarvis-approve", { method: "POST", headers: auth, body: JSON.stringify({ approval_id: create.approval_id, decision: "approve", note: "Automated JARVIS E2E" }) });
if (approved.approval?.status !== "executed") throw new Error(`approval execution failed: ${JSON.stringify(approved)}`);
const agentId = approved.approval?.execution_result?.id;
if (!agentId) throw new Error(`agent executor did not return id: ${JSON.stringify(approved)}`);

const retire = await api("/functions/v1/jarvis-tools", { method: "POST", headers: auth, body: JSON.stringify({ tool: "agent.delete", params: { id: agentId } }) });
if (retire.status !== "pending_approval" || !retire.approval_id) throw new Error(`cleanup approval creation failed: ${JSON.stringify(retire)}`);
const cleaned = await api("/functions/v1/jarvis-approve", { method: "POST", headers: auth, body: JSON.stringify({ approval_id: retire.approval_id, decision: "approve", note: "Automated JARVIS E2E cleanup" }) });
if (cleaned.approval?.status !== "executed") throw new Error(`cleanup execution failed: ${JSON.stringify(cleaned)}`);

console.log(JSON.stringify({ ok: true, patronAuth: true, modelProvider: chat.provider, readTool: true, approvalCreate: true, approvalExecute: true, cleanup: true }));
