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

Deno.serve(async req=>{
  const h=cors(req);
  if(req.method==='OPTIONS') return new Response('ok',{headers:h});
  if(req.method!=='POST') return json({error:'Method Not Allowed'},405,h);
  try{
    const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
    if(limited(`quote:${ip}`)) return json({error:'Çok fazla teklif isteği. Lütfen biraz sonra tekrar deneyin.'},429,h);
    const body=await req.json().catch(()=>null);
    if(!body || body.website) return json({error:'İstek reddedildi.'},400,h);
    const name=clean(body.name,160),company=clean(body.company,160),email=clean(body.email,200),phone=clean(body.phone,30),eventType=clean(body.event_type,80),type=clean(body.type,120),location=clean(body.location,160),message=clean(body.message,4000);
    const people=Number(body.people),eventDate=clean(body.event_date,10);
    if(!name||!phone||!eventType||!type||!location||!message||!body.kvkk||!eventDate||!Number.isInteger(people)||people<1||people>100000) return json({error:'Zorunlu alanlar eksik veya geçersiz.'},400,h);
    if(email && !validEmail(email)) return json({error:'E-posta adresi geçersiz.'},400,h);
    if(!validPhone(phone)) return json({error:'Telefon numarası geçersiz.'},400,h);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return json({error:'Etkinlik tarihi geçersiz.'},400,h);
    const today=new Date(); const todayIso=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate())).toISOString().slice(0,10); if(eventDate<todayIso) return json({error:'Etkinlik tarihi geçmiş olamaz.'},400,h);
    const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
    const {data,error}=await admin.from('teklifler').insert({name,phone,company:company||null,email:email||null,type,event_type:eventType,location,people,event_date:eventDate,message,status:'new'}).select('id,quote_number,status,event_date,created_at').single();
    if(error) throw error;
    return json({ok:true,quote:data},200,h);
  }catch(e){console.error(e);return json({error:'Teklif kaydedilemedi.'},500,h);}
});