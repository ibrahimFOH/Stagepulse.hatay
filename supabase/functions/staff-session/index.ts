import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED = new Set(["https://stagepulse.com.tr", "https://www.stagepulse.com.tr"]);
const h = (req: Request) => { const o = req.headers.get("origin") || ""; return { "Content-Type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":ALLOWED.has(o)?o:"https://stagepulse.com.tr", "Vary":"Origin", "Access-Control-Allow-Headers":"authorization, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Cache-Control":"no-store" }; };
const out = (req: Request,b:unknown,s=200) => new Response(JSON.stringify(b),{status:s,headers:h(req)});
const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url,key,{auth:{persistSession:false}});

async function tokenUser(req:Request){
  const a=req.headers.get("authorization")||"";
  if(!a.toLowerCase().startsWith("bearer ")) throw Object.assign(new Error("Oturum gerekli."),{status:401});
  const {data,error}=await admin.auth.getUser(a.slice(7).trim());
  if(error||!data.user) throw Object.assign(new Error("Oturum geçersiz."),{status:401});
  return data.user;
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:h(req)});
  if(req.method!=="POST") return out(req,{error:"Method Not Allowed"},405);
  try{
    const u=await tokenUser(req);
    const {data:p,error:pe}=await admin.from("staff_profiles").select("user_id,username,display_name,role,phone,active,notes,created_at,updated_at").eq("user_id",u.id).maybeSingle();
    if(pe) throw pe;
    if(!p||p.active!==true) throw Object.assign(new Error("Personel hesabı aktif değil."),{status:403});
    const {data:rows,error:re}=await admin.from("staff_permissions").select("permission_key,enabled").eq("user_id",u.id);
    if(re) throw re;
    const permissions:Record<string,boolean>={};
    for(const r of rows||[]) permissions[r.permission_key]=!!r.enabled;
    return out(req,{user:{id:u.id,email:u.email,username:p.username,display_name:p.display_name,role:p.role,phone:p.phone,active:p.active,notes:p.notes},permissions});
  }catch(e){
    const s=(e&&typeof e==="object"&&"status"in e&&typeof e.status==="number")?e.status:400;
    return out(req,{error:e instanceof Error?e.message:"Oturum alınamadı."},s);
  }
});