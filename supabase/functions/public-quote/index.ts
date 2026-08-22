import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED = new Set(["https://stagepulse.com.tr","https://www.stagepulse.com.tr"]);
const buckets = new Map<string, number[]>();

function cors(req: Request) { const origin=req.headers.get("origin")||""; return {"Access-Control-Allow-Origin":ALLOWED.has(origin)?origin:"https://stagepulse.com.tr","Vary":"Origin","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"}; }
function limited(key:string){const now=Date.now();const a=(buckets.get(key)||[]).filter(t=>now-t<60_000);a.push(now);buckets.set(key,a);return a.length>5;}
function json(data:unknown,status=200,headers:Record<string,string>){return Response.json(data,{status,headers});}
function clean(v:unknown,max=200){return typeof v==='string'?v.trim().slice(0,max):'';}
function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function validPhone(v:string){return /^[0-9+\s()\-]{7,20}$/.test(v);}
const b64url=(bytes:Uint8Array|string)=>{const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;let binary='';for(const b of data)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');};
const pemDer=(pem:string)=>Uint8Array.from(atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));

async function fcmAccessToken(){
  const project=Deno.env.get('FCM_PROJECT_ID'),email=Deno.env.get('FCM_CLIENT_EMAIL'),privateKey=Deno.env.get('FCM_PRIVATE_KEY')?.replace(/\\n/g,'\n');
  if(!project||!email||!privateKey)throw new Error('FCM_NOT_CONFIGURED');
  const now=Math.floor(Date.now()/1000);
  const unsigned=`${b64url(JSON.stringify({alg:'RS256',typ:'JWT'}))}.${b64url(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}))}`;
  const key=await crypto.subtle.importKey('pkcs8',pemDer(privateKey),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${b64url(signature)}`})});
  const token=await tokenRes.json();
  if(!tokenRes.ok||!token.access_token)throw new Error('FCM_AUTH_FAILED');
  return {project,accessToken:token.access_token};
}

async function pushQuote(admin:any, userIds:string[], quote:any){
  if(!userIds.length)return;
  try{
    const {data:devices}=await admin.from('notification_devices').select('id,token').in('user_id',userIds).eq('active',true);
    if(!devices?.length)return;
    const {project,accessToken}=await fcmAccessToken();
    const title='Yeni teklif talebi';
    const body=`${quote.quote_number||'Yeni teklif'} - ${quote.name||''}`.trim();
    const path='/admin/#offers';
    for(const device of devices){
      const message={message:{token:device.token,notification:{title,body},data:{title,body,url:path,kind:'new_quote',offer_id:String(quote.id)},webpush:{headers:{Urgency:'high',TTL:'86400'},notification:{title,body,icon:'https://stagepulse.com.tr/favicon-32.png',badge:'https://stagepulse.com.tr/favicon-32.png',tag:'stagepulse-new-quote',renotify:true,requireInteraction:true,vibrate:[200,100,200]},fcm_options:{link:`https://stagepulse.com.tr${path}`}}}};
      const r=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`,{method:'POST',headers:{authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify(message)});
      if(!r.ok){const detail=await r.text();if(r.status===404||r.status===410||/UNREGISTERED|NOT_FOUND/i.test(detail))await admin.from('notification_devices').update({active:false,updated_at:new Date().toISOString()}).eq('id',device.id);}
    }
  }catch(error){console.warn('[public-quote] push dispatch failed',error instanceof Error?error.message:error);}
}

Deno.serve(async req=>{
  const h=cors(req);
  if(req.method==='OPTIONS')return new Response('ok',{headers:h});
  if(req.method!=='POST')return json({error:'Method Not Allowed'},405,h);
  try{
    const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
    if(limited(`quote:${ip}`))return json({error:'Çok fazla teklif isteği. Lütfen biraz sonra tekrar deneyin.'},429,h);
    const body=await req.json().catch(()=>null);
    if(!body||body.website)return json({error:'İstek reddedildi.'},400,h);
    const name=clean(body.name,160),company=clean(body.company,160),email=clean(body.email,200),phone=clean(body.phone,30),eventType=clean(body.event_type,80),type=clean(body.type,120),location=clean(body.location,160),message=clean(body.message,4000);
    const people=Number(body.people),eventDate=clean(body.event_date,10);
    if(!name||!phone||!eventType||!type||!location||!message||!body.kvkk||!eventDate||!Number.isInteger(people)||people<1||people>100000)return json({error:'Zorunlu alanlar eksik veya geçersiz.'},400,h);
    if(email&&!validEmail(email))return json({error:'E-posta adresi geçersiz.'},400,h);
    if(!validPhone(phone))return json({error:'Telefon numarası geçersiz.'},400,h);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))return json({error:'Etkinlik tarihi geçersiz.'},400,h);
    const today=new Date();const todayIso=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate())).toISOString().slice(0,10);if(eventDate<todayIso)return json({error:'Etkinlik tarihi geçmiş olamaz.'},400,h);
    const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
    const {data,error}=await admin.from('teklifler').insert({name,phone,company:company||null,email:email||null,type,event_type:eventType,location,people,event_date:eventDate,message,status:'new'}).select('id,quote_number,status,event_date,created_at,name').single();
    if(error)throw error;

    // The database trigger creates the in-app notification rows. This second
    // dispatch delivers the same event to registered admin/staff devices even
    // when the browser/PWA is closed.
    const {data:recipients}=await admin.rpc('notification_recipients_for_offer', {p_offer_id:data.id}).catch(()=>({data:null} as any));
    let userIds:string[]=Array.isArray(recipients)?recipients.map((r:any)=>r.user_id).filter((v:any)=>typeof v==='string'):[];
    if(!userIds.length){
      const [{data:admins},{data:staff}]=await Promise.all([
        admin.from('admin_profiles').select('user_id').eq('active',true),
        admin.from('staff_profiles').select('user_id').eq('active',true)
      ]);
      userIds=[...(admins||[]),...(staff||[])].map((r:any)=>r.user_id).filter(Boolean);
    }
    await pushQuote(admin,[...new Set(userIds)],data);
    return json({ok:true,quote:data},200,h);
  }catch(e){console.error(e);return json({error:'Teklif kaydedilemedi.'},500,h);}
});