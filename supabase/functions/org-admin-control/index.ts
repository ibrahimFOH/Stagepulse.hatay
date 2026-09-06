import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,service,{auth:{persistSession:false}});
const ALLOWED=new Set(["https://stagepulse.com.tr","https://www.stagepulse.com.tr"]);
const ADMIN_ROLES=new Set(["owner","super_admin","upper_admin"]);
const headers=(req:Request)=>{const origin=req.headers.get("origin")||"";return {"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":ALLOWED.has(origin)?origin:"https://stagepulse.com.tr","Access-Control-Allow-Credentials":"true","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-supabase-api-version","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"};};
const out=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:headers(req)});
const text=(v:unknown,n=200)=>typeof v==="string"?v.trim().slice(0,n):"";
const bool=(v:unknown,d=true)=>typeof v==="boolean"?v:d;
const iso=()=>new Date().toISOString();
const validRoles=new Set(["owner","super_admin","upper_admin","ceo","department_manager","regional_manager","employee"]);
const password=(v:unknown)=>{const p=typeof v==="string"?v:"";if(p.length<10||p.length>128||!/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p)||!/[0-9]/.test(p))throw new Error("Şifre en az 10 karakter, bir harf ve bir rakam içermeli.");return p};
async function authUser(req:Request){const h=req.headers.get("authorization")||"";if(!h.toLowerCase().startsWith("bearer "))throw Object.assign(new Error("Oturum gerekli."),{status:401});const {data:u,error:ue}=await db.auth.getUser(h.slice(7).trim());if(ue||!u.user)throw Object.assign(new Error("Oturum geçersiz."),{status:401});return u.user.id}
async function actorContext(userId:string){const {data:membership,error:me}=await db.from("org_memberships").select("user_id,active,role:role_id(code,name,tier,is_admin_role,can_manage_children),position:position_id(code,name),department:department_id(id,code,name),region:region_id(id,code,name),manager_user_id").eq("user_id",userId).eq("active",true).maybeSingle();if(me)throw Object.assign(new Error("Organizasyon üyeliği okunamadı."),{status:503});const role=Array.isArray((membership as any)?.role)?(membership as any).role?.[0]:(membership as any)?.role;const roleCode=role?.code||null;return {membership,roleCode,isOwner:roleCode==="owner",isAdminRole:ADMIN_ROLES.has(roleCode)}}
async function requireAdmin(req:Request){const uid=await authUser(req);const ctx=await actorContext(uid);if(!ctx.membership)throw Object.assign(new Error("Aktif organizasyon üyeliği gerekli."),{status:403});if(!ctx.isAdminRole)throw Object.assign(new Error("Bu alan yalnızca üst yönetim hesaplarına açıktır. CEO ve diğer personel portalı kullanmalıdır."),{status:403});return {uid,...ctx}}
async function requireOwner(req:Request){const ctx=await requireAdmin(req);if(!ctx.isOwner)throw Object.assign(new Error("Bu işlem yalnızca Patron hesabına açıktır."),{status:403});return ctx.uid}
async function audit(actor:string,action:string,target_type:string,target_id:string|null,metadata:unknown={}){try{await db.from("stagepulse_audit_log").insert({actor_type:"owner",actor_id:actor,action,target_type,target_id,result:"ok",metadata})}catch(_){} }
async function permissionsFor(userId:string){const {data:m,error:me}=await db.from("org_memberships").select("role:role_id(code,tier,is_admin_role)").eq("user_id",userId).eq("active",true).maybeSingle();if(me)throw me;const role=Array.isArray((m as any)?.role)?(m as any)?.role?.[0]:(m as any)?.role;const elevated=role?.code==="owner"||role?.code==="super_admin"||((role?.is_admin_role===true)&&Number(role?.tier)<=1);if(elevated){const {data:c,error:ce}=await db.from("admin_capabilities").select("key,name,category,description").eq("active",true).order("category").order("key");if(ce)throw ce;return c||[]}const {data:g,error:ge}=await db.from("admin_capability_grants").select("capability_key,enabled").eq("user_id",userId).eq("enabled",true).order("capability_key");if(ge)throw ge;const keys=(g||[]).map((x:any)=>x.capability_key).filter(Boolean);if(!keys.length)return [];const {data:c,error:ce}=await db.from("admin_capabilities").select("key,name,category,description").in("key",keys).eq("active",true).order("category").order("key");if(ce)throw ce;return c||[]}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=="POST")return out(req,{error:"Method Not Allowed"},405);
  try{
    const b=await req.json().catch(()=>({}));
    const action=text(b.action,80);
    if(action==="my_context"){
      const actor=await authUser(req);const ctx=await actorContext(actor);
      if(!ctx.membership)return out(req,{membership:null,owner:false,is_admin:false,capabilities:[]});
      return out(req,{membership:ctx.membership,owner:ctx.isOwner,is_admin:ctx.isAdminRole,capabilities:await permissionsFor(actor)});
    }
    const actor=await requireOwner(req);
    if(action==="catalog"){
      const [r,p,d,g,c]=await Promise.all([
        db.from("org_roles").select("id,code,name,tier,is_admin_role,can_manage_children,active").eq("active",true).order("tier").order("name"),
        db.from("org_positions").select("id,code,name,description,active").eq("active",true).order("name"),
        db.from("org_departments").select("id,code,name,description,manager_user_id,active").eq("active",true).order("name"),
        db.from("org_regions").select("id,code,name,manager_user_id,active").eq("active",true).order("name"),
        db.from("admin_capabilities").select("key,category,name,description,active").eq("active",true).order("category").order("key")
      ]);for(const x of[r,p,d,g,c])if(x.error)throw x.error;return out(req,{roles:r.data||[],positions:p.data||[],departments:d.data||[],regions:g.data||[],capabilities:c.data||[]});
    }
    if(action==="members"){
      const {data,error}=await db.from("org_memberships").select("user_id,role_id,position_id,department_id,region_id,manager_user_id,active,created_at,updated_at,role:role_id(code,name,tier,is_admin_role,can_manage_children),position:position_id(code,name),department:department_id(code,name),region:region_id(code,name)").order("created_at");if(error)throw error;
      const {data:users,error:ue}=await db.auth.admin.listUsers({page:1,perPage:1000});if(ue)throw ue;const um=new Map((users.users||[]).map(u=>[u.id,{email:u.email,display_name:u.user_metadata?.display_name||u.user_metadata?.full_name||"",username:u.user_metadata?.username||"",last_sign_in_at:u.last_sign_in_at}]));return out(req,{members:await Promise.all((data||[]).map(async(x:any)=>({...x,profile:um.get(x.user_id)||{},capabilities:await permissionsFor(x.user_id)})))});
    }
    if(action==="create_member"){
      const username=text(b.username,64).toLowerCase(),display=text(b.display_name,120),pw=password(b.password),roleCode=text(b.role_code,60)||"employee",positionCode=text(b.position_code,60);
      if(!/^[a-z0-9._-]{3,64}$/.test(username)||!display)throw new Error("Geçerli kullanıcı adı ve ad soyad gerekli.");if(!validRoles.has(roleCode)||roleCode==="owner")throw new Error("Geçerli bir yönetici/personel rolü seçin.");if(!positionCode)throw new Error("Pozisyon gerekli.");
      const {data:role,error:re}=await db.from("org_roles").select("id,code").eq("code",roleCode).eq("active",true).single();if(re)throw re;const {data:pos,error:pe}=await db.from("org_positions").select("id").eq("code",positionCode).eq("active",true).single();if(pe)throw pe;
      const email=`${username}@stagepulse.com.tr`;
      const {data:users,error:ue}=await db.auth.admin.listUsers({page:1,perPage:1000});if(ue)throw ue;const exists=(users.users||[]).find((u:any)=>String(u.email||"").toLowerCase()===email);if(exists)throw new Error("Bu kullanıcı zaten mevcut.");
      const {data:created,error:ce}=await db.auth.admin.createUser({email,password:pw,email_confirm:true,user_metadata:{username,display_name:display}});if(ce||!created.user)throw ce||new Error("Kullanıcı oluşturulamadı.");
      try{const {error:me}=await db.from("org_memberships").insert({user_id:created.user.id,role_id:role.id,position_id:pos.id,department_id:text(b.department_id,60)||null,region_id:text(b.region_id,60)||null,manager_user_id:text(b.manager_user_id,60)||null,active:true});if(me)throw me;const caps=Array.isArray(b.capabilities)?b.capabilities.filter((x:any)=>typeof x==="string"):[];if(caps.length){const {data:validCaps,error:ve}=await db.from("admin_capabilities").select("key").in("key",caps).eq("active",true);if(ve)throw ve;const allowed=new Set((validCaps||[]).map((x:any)=>x.key));const rows=caps.filter((k:string)=>allowed.has(k)).map((key:string)=>({user_id:created.user.id,capability_key:key,enabled:true,granted_by:actor,updated_at:iso()}));if(rows.length){const {error:ge}=await db.from("admin_capability_grants").upsert(rows,{onConflict:"user_id,capability_key"});if(ge)throw ge;}}await audit(actor,"org_member_created","org_membership",created.user.id,{username,roleCode});return out(req,{ok:true,user_id:created.user.id});}catch(e){try{await db.auth.admin.deleteUser(created.user.id)}catch(_){}throw e}
    }
    if(action==="save_membership"){
      const uid=text(b.user_id,60);if(!uid||uid===actor)throw new Error("Patron hesabı değiştirilemez.");const roleCode=text(b.role_code,60),posCode=text(b.position_code,60);if(!roleCode||!posCode)throw new Error("Rol ve pozisyon gerekli.");const {data:r,error:re}=await db.from("org_roles").select("id,code").eq("code",roleCode).eq("active",true).single();if(re)throw re;if(r.code==="owner")throw new Error("Başka Owner atanamaz.");const {data:p,error:pe}=await db.from("org_positions").select("id").eq("code",posCode).eq("active",true).single();if(pe)throw pe;const {error}=await db.from("org_memberships").update({role_id:r.id,position_id:p.id,department_id:text(b.department_id,60)||null,region_id:text(b.region_id,60)||null,manager_user_id:text(b.manager_user_id,60)||null,active:bool(b.active,true),updated_at:iso()}).eq("user_id",uid);if(error)throw error;await audit(actor,"org_membership_saved","org_membership",uid,{roleCode,posCode});return out(req,{ok:true});
    }
    if(action==="set_capability"){
      const uid=text(b.user_id,60),key=text(b.capability_key,200);if(!uid||!key)throw new Error("Kullanıcı ve yetki gerekli.");if(uid===actor)throw new Error("Patron yetkileri değiştirilemez.");const {data:cap,error:ce}=await db.from("admin_capabilities").select("key").eq("key",key).eq("active",true).maybeSingle();if(ce)throw ce;if(!cap)throw new Error("Admin yetkisi bulunamadı.");const {error}=await db.from("admin_capability_grants").upsert({user_id:uid,capability_key:key,enabled:b.enabled===true,granted_by:actor,updated_at:iso()},{onConflict:"user_id,capability_key"});if(error)throw error;await audit(actor,"admin_capability_changed","admin_capability",null,{uid,key,enabled:b.enabled===true});return out(req,{ok:true});
    }
    if(action==="set_panel_rule"){
      const role_code=text(b.role_code,60),panel_code=text(b.panel_code,120),scope_mode=text(b.scope_mode,30);if(!role_code||!panel_code||!["company","department","region","self","none"].includes(scope_mode))throw new Error("Rol, panel ve kapsam gerekli.");const {error}=await db.from("org_panel_rules").upsert({role_code,panel_code,scope_mode,active:bool(b.active,true),updated_at:iso()},{onConflict:"role_code"});if(error)throw error;await audit(actor,"org_panel_rule_saved","org_panel_rule",null,{role_code,panel_code,scope_mode});return out(req,{ok:true});
    }
    if(action==="save_role"){
      const id=text(b.id,60),code=text(b.code,60).toLowerCase(),name=text(b.name,120),tier=Number(b.tier);if(!code||!name||!Number.isInteger(tier)||tier<0||tier>6)throw new Error("Rol kodu, adı ve 0-6 arası seviye gerekli.");if(code==="owner")throw new Error("Patron rolü bu merkezden değiştirilemez.");const payload={code,name,tier,is_admin_role:bool(b.is_admin_role,false),can_manage_children:bool(b.can_manage_children,false),active:bool(b.active,true)};const q=id?db.from("org_roles").update(payload).eq("id",id):db.from("org_roles").insert(payload);const {error}=await q;if(error)throw error;await audit(actor,"org_role_saved","org_role",id||null,{code});return out(req,{ok:true});
    }
    if(action==="save_position"){
      const id=text(b.id,60),code=text(b.code,60).toLowerCase(),name=text(b.name,120);if(!code||!name)throw new Error("Pozisyon kodu ve adı gerekli.");if(code==="owner")throw new Error("Patron pozisyonu bu merkezden değiştirilemez.");const payload={code,name,description:text(b.description,500)||null,active:bool(b.active,true)};const q=id?db.from("org_positions").update(payload).eq("id",id):db.from("org_positions").insert(payload);const {error}=await q;if(error)throw error;await audit(actor,"org_position_saved","org_position",id||null,{code});return out(req,{ok:true});
    }
    if(action==="save_department"){
      const id=text(b.id,60),code=text(b.code,60).toLowerCase(),name=text(b.name,120);if(!code||!name)throw new Error("Departman kodu ve adı gerekli.");const payload={code,name,description:text(b.description,500)||null,manager_user_id:text(b.manager_user_id,60)||null,active:bool(b.active,true),updated_at:iso()};const q=id?db.from("org_departments").update(payload).eq("id",id):db.from("org_departments").insert(payload);const {error}=await q;if(error)throw error;await audit(actor,"org_department_saved","org_department",id||null,{code});return out(req,{ok:true});
    }
    if(action==="save_region"){
      const id=text(b.id,60),code=text(b.code,60).toLowerCase(),name=text(b.name,120);if(!code||!name)throw new Error("Bölge kodu ve adı gerekli.");const payload={code,name,manager_user_id:text(b.manager_user_id,60)||null,active:bool(b.active,true),updated_at:iso()};const q=id?db.from("org_regions").update(payload).eq("id",id):db.from("org_regions").insert(payload);const {error}=await q;if(error)throw error;await audit(actor,"org_region_saved","org_region",id||null,{code});return out(req,{ok:true});
    }
    if(action==="reset_password"){
      const uid=text(b.user_id,60);if(!uid||uid===actor)throw new Error("Patron hesabı bu yoldan değiştirilemez.");const {error}=await db.auth.admin.updateUserById(uid,{password:password(b.password)});if(error)throw error;try{await db.auth.admin.signOut(uid)}catch(_){}await audit(actor,"org_member_password_reset","user",uid);return out(req,{ok:true});
    }
    if(action==="delete_member"){
      const uid=text(b.user_id,60);if(!uid||uid===actor)throw new Error("Patron hesabı silinemez.");const {error:de}=await db.from("org_memberships").delete().eq("user_id",uid);if(de)throw de;const {error:ae}=await db.auth.admin.deleteUser(uid);if(ae)throw ae;await audit(actor,"org_member_deleted","user",uid);return out(req,{ok:true,deleted:true});
    }
    throw new Error("Geçersiz işlem.");
  }catch(e){console.error("[org-admin-control]",e);const internal=typeof (e as any)?.code==="string"||(e as any)?.__isAuthError===true;const status=internal?500:((e as any)?.status||400);return out(req,{error:internal?"İşlem başarısız.":e instanceof Error?e.message:"İşlem başarısız."},status)}
});
