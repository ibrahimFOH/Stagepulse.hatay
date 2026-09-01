import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, handleOptions, getClientIp, isDistributedRateLimited, GENERIC_LOGIN_ERROR, jsonError } from "../_shared/security.ts";

Deno.serve(async(req)=>{
  const options=handleOptions(req);
  if(options)return options;
  const headers={...corsHeadersFor(req),"Cache-Control":"no-store"};
  if(req.method!=="POST")return jsonError("Method Not Allowed",405,headers);
  try{
    const body=await req.json().catch(()=>null);
    const username=typeof body?.username==="string"?body.username.trim().toLowerCase():"";
    const password=typeof body?.password==="string"?body.password:"";
    if(!username||!password)return jsonError("Kullanıcı adı ve şifre gerekli.",400,headers);

    const url=Deno.env.get("SUPABASE_URL")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const ip=getClientIp(req);
    if(await isDistributedRateLimited(admin,`portal-login:${ip}`,10)){
      return jsonError("Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",429,headers);
    }

    const auth=createClient(url,anon,{auth:{persistSession:false}});
    const email=username.includes("@")?username:`${username}@stagepulse.com.tr`;
    const {data,error}=await auth.auth.signInWithPassword({email,password});
    if(error||!data.user||!data.session)return jsonError(GENERIC_LOGIN_ERROR,401,headers);

    const {data:membership,error:membershipError}=await admin.from("org_memberships").select("user_id,active,role:role_id(code,is_admin_role),department_id,region_id").eq("user_id",data.user.id).eq("active",true).maybeSingle();
    if(membershipError)return jsonError("İşlem başarısız.",500,headers);
    if(!membership)return jsonError(GENERIC_LOGIN_ERROR,401,headers);

    return Response.json({ok:true,session:data.session,user:data.user,membership},{headers});
  }catch(error){
    console.error(error);
    return jsonError("Portal giriş işlemi başarısız.",500,headers);
  }
});
