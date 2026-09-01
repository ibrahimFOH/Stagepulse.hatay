import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"https://stagepulse.com.tr","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const db=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
async function auth(req:Request){const h=req.headers.get("authorization")||"";if(!h.toLowerCase().startsWith("bearer "))return null;const c=db();const {data,error}=await c.auth.getUser(h.slice(7).trim());if(error||!data.user)return null;const {data:m}=await c.from("org_memberships").select("user_id,active,role:role_id(code,is_admin_role)").eq("user_id",data.user.id).eq("active",true).maybeSingle();return m?data.user:null;}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return json({error:'Method Not Allowed'},405);const user=await auth(req);if(!user)return json({error:'Yönetici oturumu gerekli.'},403);return json({ok:true,user_id:user.id});});
