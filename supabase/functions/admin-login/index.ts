import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeadersFor, handleOptions, getClientIp, isDistributedRateLimited, GENERIC_LOGIN_ERROR, jsonError } from "../_shared/security.ts";

const ADMIN_ROLES = new Set(["owner", "super_admin", "upper_admin"]);

Deno.serve(async(req)=>{
  const opt=handleOptions(req);
  if(opt)return opt;
  const headers=corsHeadersFor(req);
  if(req.method!=="POST")return jsonError("Method Not Allowed",405,headers);
  try{
    const body=await req.json().catch(()=>null);
    const username=typeof body?.username==="string"?body.username.trim().toLowerCase():"";
    const password=typeof body?.password==="string"?body.password:"";
    if(!username||!password)return jsonError("Kullanıcı adı ve şifre zorunludur.",400,headers);

    const url=Deno.env.get("SUPABASE_URL")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const limitedByIp=await isDistributedRateLimited(admin,`admin-login:ip:${getClientIp(req)}`,10);
    const limitedByAccount=await isDistributedRateLimited(admin,`admin-login:account:${username.slice(0,120)}`,10);
    if(limitedByIp||limitedByAccount)return jsonError("Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",429,headers);

    const isEmail=username.includes("@");
    const {data:legacy,error:le}=await admin.from("admin_profiles").select("user_id").eq("username",username).eq("active",true).maybeSingle();
    if(le)return jsonError("İşlem başarısız.",500,headers);
    if(!isEmail&&!legacy&&!/^[a-z0-9._-]{3,64}$/.test(username))return jsonError(GENERIC_LOGIN_ERROR,401,headers);

    let email=isEmail?username:`${username}@stagepulse.com.tr`;
    if(legacy?.user_id){
      const {data:legacyUser,error:legacyError}=await admin.auth.admin.getUserById(legacy.user_id);
      if(legacyError||!legacyUser.user?.email)return jsonError(GENERIC_LOGIN_ERROR,401,headers);
      email=legacyUser.user.email;
    }

    const auth=createClient(url,anon,{auth:{persistSession:false}});
    const {data,error}=await auth.auth.signInWithPassword({email,password});
    if(error||!data.session||!data.user)return jsonError(GENERIC_LOGIN_ERROR,401,headers);

    const {data:membership,error:me}=await admin.from("org_memberships").select("active,role:role_id(code,name,tier,is_admin_role)").eq("user_id",data.user.id).eq("active",true).maybeSingle();
    const role=Array.isArray((membership as any)?.role)?(membership as any).role?.[0]:(membership as any)?.role;
    if(me||!membership||!ADMIN_ROLES.has(role?.code||""))return jsonError(GENERIC_LOGIN_ERROR,401,headers);

    return Response.json({session:data.session,user:{id:data.user.id,username:data.user.user_metadata?.username||username,display_name:data.user.user_metadata?.display_name||data.user.user_metadata?.full_name||"",role:role.code}},{headers});
  }catch(_){
    return jsonError("İşlem başarısız.",500,headers);
  }
});
