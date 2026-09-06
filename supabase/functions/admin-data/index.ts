import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
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
  const { data: membership, error } = await supabase.from("org_memberships").select("active,role:role_id(code,is_admin_role)").eq("user_id", auth.user.id).eq("active", true).maybeSingle();
  if (error) throw new Error("RBAC_LOOKUP");
  const role = Array.isArray((membership as any)?.role) ? (membership as any).role?.[0] : (membership as any)?.role;
  if (!membership || role?.is_admin_role !== true) throw new Error("FORBIDDEN");
  return { supabase, user: auth.user, roleCode: role.code };
}

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
      const { data, error } = await q; if (error) throw error; return data ?? [];
    };
    const allowedRead = new Set(["teklifler","customers","business_settings","settlements","services","price_rules","equipment","jobs","job_equipment","job_staff","payments","notifications","activity_logs"]);
    let data: unknown;
    if (action === "bootstrap") {
      const [offers, settings, customers, settlements, services, equipment, jobs, payments, notifications, activity] = await Promise.all([
        select("teklifler", "*", {column:"created_at", ascending:false}),
        (async()=>{const {data,error}=await supabase.from("business_settings").select("*").eq("id",true).maybeSingle();if(error)throw error;return data??{};})(),
        select("customers","*",{column:"updated_at",ascending:false}), select("settlements","*",{column:"event_date",ascending:false}),
        select("services","*",{column:"sort_order",ascending:true}), select("equipment","*",{column:"category",ascending:true}),
        select("jobs","*",{column:"event_at",ascending:true}), select("payments","*",{column:"due_date",ascending:true}),
        select("notifications","*",{column:"created_at",ascending:false}), select("activity_logs","*",{column:"created_at",ascending:false})
      ]);
      data={offers,settings,customers,settlements,services,equipment,jobs,payments,notifications,activity,admin_user_id:user.id};
    } else if (action === "list") {
      const table=typeof body?.table === "string" ? body.table : "";
      if(!allowedRead.has(table)) throw new Error("BAD_ACTION");
      data=await select(table,typeof body?.columns === "string" ? body.columns : "*",body?.order?.column?body.order:undefined);
    } else if (action === "upsert") {
      const table=String(body?.table||""); if(!allowedRead.has(table)) throw new Error("BAD_ACTION");
      if(!body?.payload||typeof body.payload!=="object") throw new Error("BAD_PAYLOAD");
      const {data:rows,error}=await supabase.from(table).upsert(body.payload).select();if(error)throw error;data=rows??[];
    } else if (action === "update_offer") {
      const id=String(body?.id||"");if(!id)throw new Error("BAD_ID");if(!body?.payload||typeof body.payload!=="object")throw new Error("BAD_PAYLOAD");
      const {data:row,error}=await supabase.from("teklifler").update(body.payload).eq("id",id).select().single();if(error)throw error;data=row;
    } else if (action === "delete_offer") {
      const id=String(body?.id||"");if(!id)throw new Error("BAD_ID");const {error}=await supabase.from("teklifler").delete().eq("id",id);if(error)throw error;data={ok:true};
    } else if (action === "delete") {
      const table=String(body?.table||"");if(!new Set(["customers","services","price_rules","equipment","jobs","job_equipment","job_staff","payments","settlements","activity_logs"]).has(table))throw new Error("BAD_ACTION");
      const id=String(body?.id||"");if(!id)throw new Error("BAD_ID");const {error}=await supabase.from(table).delete().eq("id",id);if(error)throw error;data={ok:true};
    } else if (action === "clear_activity") {
      const {error}=await supabase.from("activity_logs").delete().not("id","is",null);if(error)throw error;data={ok:true};
    } else if (action === "activity_insert") {
      if(!body?.payload||typeof body.payload!=="object")throw new Error("BAD_PAYLOAD");const {error}=await supabase.from("activity_logs").insert({...body.payload,actor_id:user.id});if(error)throw error;data={ok:true};
    } else throw new Error("BAD_ACTION");
    return Response.json({ok:true,data},{headers:cors});
  } catch(e) {
    const message=e instanceof Error?e.message:"İşlem başarısız.";
    const status=message==="UNAUTHENTICATED"?401:message==="FORBIDDEN"?403:(message.startsWith("BAD_")?400:500);
    return jsonError(status===403?"Admin yetkisi gerekli.":status===401?"Oturum gerekli.":status===500?"İşlem başarısız.":message,status,cors);
  }
});
