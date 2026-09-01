import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED=new Set(["https://stagepulse.com.tr","https://www.stagepulse.com.tr"]);
const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false}});
const cors=(req:Request)=>({"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":ALLOWED.has(req.headers.get("origin")||"")?req.headers.get("origin")!:"https://stagepulse.com.tr","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-stagepulse-dispatch-token","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"});
const out=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors(req)});
const b64url=(bytes:Uint8Array|string)=>{const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;let binary='';for(const b of data)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');};
const pemDer=(pem:string)=>{
  const clean=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g,'').replace(/\\n/g,'').replace(/\s/g,'');
  try{return Uint8Array.from(atob(clean),c=>c.charCodeAt(0));}catch(e){throw new Error(`FCM_PRIVATE_KEY_INVALID: ${e instanceof Error?e.message:String(e)}`);}
};
function serviceAccount(){
  const raw=Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')?.trim();
  if(raw){
    try{
      const json=JSON.parse(raw.startsWith('{')?raw:new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/\s/g,'')),c=>c.charCodeAt(0))));
      if(json?.project_id&&json?.client_email&&json?.private_key)return{project:String(json.project_id),email:String(json.client_email),privateKey:String(json.private_key)};
    }catch(e){throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON_INVALID: ${e instanceof Error?e.message:String(e)}`);}
  }
  const project=Deno.env.get('FCM_PROJECT_ID');
  const email=Deno.env.get('FCM_CLIENT_EMAIL');
  const privateKey=Deno.env.get('FCM_PRIVATE_KEY');
  if(!project||!email||!privateKey)throw new Error('FCM_NOT_CONFIGURED');
  return{project,email,privateKey};
}
async function fcmAccessToken(){
  const cfg=serviceAccount();
  const privateKey=cfg.privateKey.replace(/\\n/g,'\n');
  const now=Math.floor(Date.now()/1000);
  const unsigned=`${b64url(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${b64url(JSON.stringify({iss:cfg.email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}))}`;
  const key=await crypto.subtle.importKey('pkcs8',pemDer(privateKey),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${b64url(signature)}`})});
  const j=await r.json();
  if(!r.ok||!j.access_token)throw new Error(`FCM_AUTH_FAILED${j?.error?`: ${j.error}`:''}`);
  return{project:cfg.project,accessToken:j.access_token};
}
async function requireAdmin(req:Request){const h=req.headers.get('authorization')||'';if(!h.toLowerCase().startsWith('bearer '))throw new Error('UNAUTHENTICATED');const {data,error}=await admin.auth.getUser(h.slice(7).trim());if(error||!data.user)throw new Error('UNAUTHENTICATED');const {data:m,error:me}=await admin.from('org_memberships').select('active,role:role_id(code,is_admin_role)').eq('user_id',data.user.id).eq('active',true).maybeSingle();const role=Array.isArray((m as any)?.role)?(m as any).role[0]:(m as any)?.role;if(me||!m?.active||role?.is_admin_role!==true)throw new Error('FORBIDDEN');return data.user;}
function safePath(value:unknown){const raw=typeof value==='string'?value:'/portal/';try{const u=new URL(raw,'https://stagepulse.com.tr');if(!['https://stagepulse.com.tr','https://www.stagepulse.com.tr'].includes(u.origin))return'/portal/';return`${u.pathname}${u.search}${u.hash}`;}catch{return'/portal/';}}
async function notificationPath(notification:{recipient_user_id:string;offer_id?:string|null},id:number){const {data:m}=await admin.from('org_memberships').select('role:role_id(is_admin_role)').eq('user_id',notification.recipient_user_id).eq('active',true).maybeSingle();const role=Array.isArray((m as any)?.role)?(m as any).role[0]:(m as any)?.role;const base=role?.is_admin_role===true?'/admin/':'/portal/';const q=new URLSearchParams({notification:String(id)});if(notification.offer_id)q.set('offer',notification.offer_id);return`${base}?${q}`;}
async function dispatch(userIds:string[],title:string,text:string,kind:string,path:string){const {data:devices,error}=await admin.from('notification_devices').select('id,token,push_type,active').in('user_id',userIds).eq('active',true).eq('push_type','fcm');if(error)throw error;const ctx=await fcmAccessToken();let sent=0,stale=0,failed=0;const errors:unknown[]=[];for(const d of devices||[]){if(!d.token){failed++;errors.push({device_id:d.id,message:'FCM_TOKEN_MISSING'});continue;}try{const message={message:{token:d.token,notification:{title,body:text},data:{url:path,kind},android:{priority:'high',notification:{channel_id:'stagepulse_default',sound:'default'}},webpush:{headers:{Urgency:'high',TTL:'86400'},notification:{title,body:text,icon:'https://stagepulse.com.tr/favicon-32.png',badge:'https://stagepulse.com.tr/favicon-32.png',tag:`stagepulse-${kind}`,renotify:true,requireInteraction:true},fcm_options:{link:`https://stagepulse.com.tr${path}`}}}};const r=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(ctx.project)}/messages:send`,{method:'POST',headers:{authorization:`Bearer ${ctx.accessToken}`,'content-type':'application/json'},body:JSON.stringify(message)});if(r.ok){sent++;continue;}const detail=await r.text();if(r.status===404||r.status===410||/UNREGISTERED|NOT_FOUND/i.test(detail)){stale++;await admin.from('notification_devices').update({active:false,updated_at:new Date().toISOString()}).eq('id',d.id);}else{failed++;errors.push({device_id:d.id,status:r.status,body:detail});}}catch(e){failed++;errors.push({device_id:d.id,message:e instanceof Error?e.message:String(e)});}}return{ok:failed===0,sent,stale,failed,total:(devices||[]).length,errors};}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});if(req.method!=='POST')return out(req,{error:'Method Not Allowed'},405);try{const b=await req.json().catch(()=>({}));let ids:string[]=[];let title='Stagepulse',text='',kind='system',path='/portal/';if(b.dispatch_token){const id=Number(b.notification_id),token=String(b.dispatch_token);if(!Number.isSafeInteger(id)||id<1||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token))return out(req,{ok:false,error:'INVALID_OR_USED_TOKEN'},409);const {data:n,error}=await admin.from('notifications').select('id,recipient_user_id,title,body,kind,offer_id').eq('id',id).eq('push_dispatch_token',token).is('push_dispatched_at',null).maybeSingle();if(error)throw error;if(!n)return out(req,{ok:false,error:'INVALID_OR_USED_TOKEN'},409);const {data:c,error:ce}=await admin.from('notifications').update({push_dispatched_at:new Date().toISOString()}).eq('id',id).eq('push_dispatch_token',token).is('push_dispatched_at',null).select('id').maybeSingle();if(ce)throw ce;if(!c)return out(req,{ok:false,error:'ALREADY_DISPATCHED'},409);ids=[n.recipient_user_id];title=n.title||title;text=n.body||'';kind=n.kind||kind;path=await notificationPath(n,id);}else{await requireAdmin(req);ids=Array.isArray(b.user_ids)?b.user_ids.filter((x:unknown):x is string=>typeof x==='string'):[];title=typeof b.title==='string'?b.title.trim().slice(0,120):title;text=typeof b.body==='string'?b.body.trim().slice(0,1000):'';kind=typeof b.kind==='string'?b.kind.slice(0,80):kind;path=safePath(b.url);if(!ids.length||!text)return out(req,{error:'user_ids ve body gerekli.'},400);}return out(req,await dispatch(ids,title,text,kind,path));}catch(e){const m=e instanceof Error?e.message:String(e);const s=m==='UNAUTHENTICATED'?401:m==='FORBIDDEN'?403:m==='FCM_NOT_CONFIGURED'?503:500;return out(req,{error:m,statusCode:(e as any)?.statusCode||0,providerBody:(e as any)?.body||null},s);}});
