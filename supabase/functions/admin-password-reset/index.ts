import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://stagepulse.com.tr","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const db=()=>createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return json({error:'Method Not Allowed'},405);try{const b=await req.json().catch(()=>({}));const email=String(b.email||'').trim();if(!email)return json({error:'E-posta gerekli.'},400);const c=db();const {error}=await c.auth.admin.generateLink({type:'recovery',email});if(error)throw error;return json({ok:true});}catch(e){console.error(e);return json({error:'Şifre sıfırlama işlemi başarısız.'},500);}});
