import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED = new Set(["https://stagepulse.com.tr", "https://www.stagepulse.com.tr"]);
const headers = (req: Request) => { const origin = req.headers.get("origin") || ""; return { "Content-Type":"application/json; charset=utf-8", "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://stagepulse.com.tr", "Vary":"Origin", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Cache-Control":"no-store" }; };
const out = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers(req) });

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function requireAdmin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw Object.assign(new Error("Oturum gerekli."), { status: 401 });
  const token = auth.slice(7).trim();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Oturum geçersiz."), { status: 401 });
  const { data: profile, error: pErr } = await admin.from("admin_profiles").select("user_id").eq("user_id", data.user.id).eq("active", true).maybeSingle();
  if (pErr) throw Object.assign(new Error("Yönetici doğrulaması başarısız."), { status: 503 });
  if (!profile) throw Object.assign(new Error("Yönetici yetkisi gerekli."), { status: 403 });
  return data.user;
}

function cleanText(v: unknown, max: number) { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
function normalizeRole(v: unknown) { const r = cleanText(v, 32).toLowerCase(); return ["crew","tech","warehouse","lead"].includes(r) ? r : "crew"; }
function strongPassword(v: unknown) { const p = typeof v === "string" ? v : ""; if (p.length < 10 || p.length > 128 || !/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p) || !/\d/.test(p)) throw new Error("Şifre en az 10 karakter, bir harf ve bir rakam içermeli."); return p; }
function validUsername(v: string) { return /^[a-z0-9._-]{3,64}$/.test(v); }

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return out(req, { error:"Method Not Allowed" }, 405);
  try {
    const adminUser = await requireAdmin(req);
    const b = await req.json().catch(() => ({}));
    const action = cleanText(b.action, 40);

    if (action === "catalog") {
      const { data, error } = await admin.from("permission_catalog").select("key,category,label,description,sort_order,active").eq("active", true).order("sort_order").order("key");
      if (error) throw error;
      return out(req, { permissions: data || [] });
    }
    if (action === "list") {
      const { data: staff, error } = await admin.from("staff_profiles").select("user_id,username,display_name,role,phone,active,notes,created_at,updated_at").neq("role","admin").order("display_name");
      if (error) throw error;
      const ids = (staff || []).map(x => x.user_id);
      const { data: perms, error: pe } = ids.length ? await admin.from("staff_permissions").select("user_id,permission_key,enabled").in("user_id", ids) : { data: [], error: null };
      if (pe) throw pe;
      const map = new Map<string, Record<string, boolean>>();
      for (const row of perms || []) { if (!map.has(row.user_id)) map.set(row.user_id, {}); map.get(row.user_id)![row.permission_key] = !!row.enabled; }
      return out(req, { staff: (staff || []).map(s => ({ ...s, permissions: map.get(s.user_id) || {} })) });
    }

    const userId = cleanText(b.user_id, 64);
    if (action !== "create" && !userId) throw new Error("user_id gerekli.");

    if (action === "create") {
      const username = cleanText(b.username, 64).toLowerCase();
      const display = cleanText(b.display_name, 120);
      const password = strongPassword(b.password);
      const role = normalizeRole(b.role);
      const phone = cleanText(b.phone, 40) || null;
      if (!validUsername(username) || !display) throw new Error("Geçerli kullanıcı adı ve ad soyad gerekli.");
      const { data: exists, error: xe } = await admin.from("staff_profiles").select("user_id").eq("username", username).maybeSingle();
      if (xe) throw xe;
      if (exists) throw new Error("Bu kullanıcı adı zaten kullanılıyor.");
      const email = `${username}@staff.stagepulse.com.tr`;
      const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username, display_name: display, role } });
      if (ce || !created.user) throw ce || new Error("Auth hesabı oluşturulamadı.");
      const { data: profile, error: pe } = await admin.from("staff_profiles").insert({ user_id: created.user.id, username, display_name: display, role, phone, active: true }).select("user_id,username,display_name,role,phone,active,notes,created_at,updated_at").single();
      if (pe) { await admin.auth.admin.deleteUser(created.user.id).catch(()=>{}); throw pe; }
      const { data: catalog, error: ce2 } = await admin.from("permission_catalog").select("key").eq("active", true);
      if (ce2) throw ce2;
      const requested = (b.permissions && typeof b.permissions === "object") ? b.permissions : {};
      if ((catalog || []).length) await admin.from("staff_permissions").insert((catalog || []).map(p => ({ user_id: created.user.id, permission_key: p.key, enabled: requested[p.key] === true })));
      await admin.from("activity_logs").insert({ actor_id: adminUser.id, action:"staff_created", entity_type:"staff", entity_id: created.user.id, metadata:{ username } }).catch(()=>{});
      return out(req, { ok:true, staff:profile });
    }

    const { data: target, error: te } = await admin.from("staff_profiles").select("user_id,username,role,active").eq("user_id", userId).maybeSingle();
    if (te || !target || target.role === "admin") throw new Error("Personel hesabı bulunamadı.");

    if (action === "update") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.display_name != null) patch.display_name = cleanText(b.display_name, 120);
      if (b.role != null) patch.role = normalizeRole(b.role);
      if (b.phone != null) patch.phone = cleanText(b.phone, 40) || null;
      if (b.notes != null) patch.notes = cleanText(b.notes, 2000) || null;
      const { data, error } = await admin.from("staff_profiles").update(patch).eq("user_id", userId).select("user_id,username,display_name,role,phone,active,notes,created_at,updated_at").single();
      if (error) throw error;
      if (b.password != null && String(b.password).length) { const password = strongPassword(b.password); const { error: pe } = await admin.auth.admin.updateUserById(userId, { password }); if (pe) throw pe; await admin.auth.admin.signOut(userId).catch(()=>{}); }
      await admin.from("activity_logs").insert({ actor_id: adminUser.id, action:"staff_updated", entity_type:"staff", entity_id:userId, metadata:{} }).catch(()=>{});
      return out(req, { ok:true, staff:data });
    }

    if (action === "set_active") {
      const active = b.active === true;
      const { error } = await admin.from("staff_profiles").update({ active, updated_at: new Date().toISOString() }).eq("user_id", userId);
      if (error) throw error;
      if (!active) await admin.auth.admin.signOut(userId).catch(()=>{});
      await admin.from("activity_logs").insert({ actor_id: adminUser.id, action: active ? "staff_activated" : "staff_deactivated", entity_type:"staff", entity_id:userId, metadata:{} }).catch(()=>{});
      return out(req, { ok:true, active });
    }

    if (action === "permissions") {
      const raw = b.permissions;
      if (!raw || typeof raw !== "object") throw new Error("permissions nesnesi gerekli.");
      const { data: catalog, error: ce } = await admin.from("permission_catalog").select("key").eq("active", true);
      if (ce) throw ce;
      await admin.from("staff_permissions").delete().eq("user_id", userId);
      const rows = (catalog || []).map(p => ({ user_id:userId, permission_key:p.key, enabled: raw[p.key] === true, updated_at:new Date().toISOString() }));
      if (rows.length) { const { error } = await admin.from("staff_permissions").insert(rows); if (error) throw error; }
      await admin.from("activity_logs").insert({ actor_id: adminUser.id, action:"staff_permissions_updated", entity_type:"staff", entity_id:userId, metadata:{ permission_count: rows.filter(x=>x.enabled).length } }).catch(()=>{});
      return out(req, { ok:true, enabled_count: rows.filter(x=>x.enabled).length });
    }

    if (action === "reset_password") {
      const password = strongPassword(b.password);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      await admin.auth.admin.signOut(userId).catch(()=>{});
      await admin.from("activity_logs").insert({ actor_id: adminUser.id, action:"staff_password_reset", entity_type:"staff", entity_id:userId, metadata:{} }).catch(()=>{});
      return out(req, { ok:true });
    }

    if (action === "delete") {
      await admin.from("staff_permissions").delete().eq("user_id", userId);
      await admin.from("staff_profiles").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return out(req, { ok:true, deleted_user_id:userId });
    }
    throw new Error("Geçersiz işlem.");
  } catch (e) {
    const status = (e && typeof e === "object" && "status" in e && typeof e.status === "number") ? e.status : 400;
    return out(req, { error: e instanceof Error ? e.message : "İşlem başarısız." }, status);
  }
});