import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, handleOptions, jsonError } from "../_shared/security.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function client(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("UNAUTHENTICATED");
  return createClient(url, serviceRole, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
}

async function requireAdmin(req: Request) {
  const supabase = client(req);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("UNAUTHENTICATED");
  const { data: profile, error } = await supabase.from("admin_profiles").select("user_id,active,username,display_name").eq("user_id", auth.user.id).maybeSingle();
  if (error || !profile?.active) throw new Error("FORBIDDEN");
  return { supabase, user: auth.user, profile };
}

const READERS: Record<string, () => Promise<unknown>> = {};

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const cors = corsHeadersFor(req);
  if (req.method !== "POST") return jsonError("Method Not Allowed", 405, cors);
  try {
    const { supabase, user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";

    const select = async (table: string, columns = "*", order?: { column: string; ascending?: boolean }) => {
      let q = supabase.from(table).select(columns);
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true, nullsFirst: false });
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    };

    let data: unknown;
    switch (action) {
      case "bootstrap": {
        const [offers, settings, customers, settlements, services, equipment, jobs, payments, notifications, activity] = await Promise.all([
          select("teklifler", "*", { column: "created_at", ascending: false }),
          (async () => { const { data, error } = await supabase.from("business_settings").select("*").eq("id", true).maybeSingle(); if (error) throw error; return data ?? {}; })(),
          select("customers", "*", { column: "updated_at", ascending: false }),
          select("settlements", "*", { column: "event_date", ascending: false }),
          select("services", "*", { column: "sort_order", ascending: true }),
          select("equipment", "*", { column: "category", ascending: true }),
          select("jobs", "*", { column: "event_at", ascending: true }),
          select("payments", "*", { column: "due_date", ascending: true }),
          select("notifications", "*", { column: "created_at", ascending: false }),
          select("activity_logs", "*", { column: "created_at", ascending: false }),
        ]);
        data = { offers, settings, customers, settlements, services, equipment, jobs, payments, notifications, activity, admin_user_id: user.id };
        break;
      }
      case "list": {
        const table = typeof body?.table === "string" ? body.table : "";
        const allowed = new Set(["teklifler", "customers", "business_settings", "settlements", "services", "price_rules", "equipment", "jobs", "job_equipment", "job_staff", "payments", "notifications", "activity_logs", "staff_profiles", "staff_permissions", "permission_catalog"]);
        if (!allowed.has(table)) throw new Error("BAD_ACTION");
        data = await select(table, typeof body?.columns === "string" ? body.columns : "*", body?.order?.column ? body.order : undefined);
        break;
      }
      case "upsert": {
        const table = typeof body?.table === "string" ? body.table : "";
        const allowed = new Set(["business_settings", "customers", "services", "price_rules", "equipment", "jobs", "job_equipment", "job_staff", "payments", "settlements"]);
        if (!allowed.has(table)) throw new Error("BAD_ACTION");
        const payload = body?.payload;
        if (!payload || typeof payload !== "object") throw new Error("BAD_PAYLOAD");
        const { data: rows, error } = await supabase.from(table).upsert(payload).select();
        if (error) throw error;
        data = rows ?? [];
        break;
      }
      case "update_offer": {
        const id = String(body?.id || "");
        if (!id) throw new Error("BAD_ID");
        const payload = body?.payload;
        if (!payload || typeof payload !== "object") throw new Error("BAD_PAYLOAD");
        const { data: row, error } = await supabase.from("teklifler").update(payload).eq("id", id).select().single();
        if (error) throw error;
        data = row;
        break;
      }
      case "delete_offer": {
        const id = String(body?.id || "");
        if (!id) throw new Error("BAD_ID");
        const { error } = await supabase.from("teklifler").delete().eq("id", id);
        if (error) throw error;
        data = { ok: true };
        break;
      }
      case "delete": {
        const table = typeof body?.table === "string" ? body.table : "";
        const allowed = new Set(["customers", "services", "price_rules", "equipment", "jobs", "job_equipment", "job_staff", "payments", "settlements"]);
        if (!allowed.has(table)) throw new Error("BAD_ACTION");
        const id = String(body?.id || "");
        if (!id) throw new Error("BAD_ID");
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
        data = { ok: true };
        break;
      }
      case "activity_insert": {
        const payload = body?.payload;
        if (!payload || typeof payload !== "object") throw new Error("BAD_PAYLOAD");
        const { error } = await supabase.from("activity_logs").insert({ ...payload, actor_id: user.id });
        if (error) throw error;
        data = { ok: true };
        break;
      }
      default:
        throw new Error("BAD_ACTION");
    }

    return Response.json({ ok: true, data }, { headers: cors });
  } catch (e) {
    const message = e instanceof Error ? e.message : "İşlem başarısız.";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : message === "BAD_ACTION" || message === "BAD_PAYLOAD" || message === "BAD_ID" ? 400 : 500;
    return jsonError(status === 403 ? "Admin yetkisi gerekli." : status === 401 ? "Oturum gerekli." : message, status, cors);
  }
});
