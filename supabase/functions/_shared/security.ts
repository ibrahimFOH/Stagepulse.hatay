// Stagepulse shared security helpers: CORS, password policy, distributed login/submit limits.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ALLOWED_ORIGINS=new Set<string>(["https://stagepulse.com.tr","https://www.stagepulse.com.tr","http://localhost:5173","http://127.0.0.1:5173"]);
export function corsHeadersFor(req:Request):Record<string,string>{
  const origin=req.headers.get("origin")||"";
  const h:Record<string,string>={...corsHeaders,"Vary":"Origin","Cache-Control":"no-store"};
  delete h["Access-Control-Allow-Origin"];
  if(ALLOWED_ORIGINS.has(origin))h["Access-Control-Allow-Origin"]=origin;
  return h;
}
export function handleOptions(req:Request):Response|null{if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeadersFor(req)});return null;}
const fallbackBuckets=new Map<string,number[]>(),WINDOW=60_000,MAX=10;
export function getClientIp(req:Request):string{return req.headers.get("cf-connecting-ip")?.trim()||req.headers.get("x-real-ip")?.trim()||req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";}
export function isRateLimited(key:string):boolean{const now=Date.now(),arr=(fallbackBuckets.get(key)||[]).filter(t=>now-t<WINDOW);arr.push(now);fallbackBuckets.set(key,arr);if(fallbackBuckets.size>5000){const k=fallbackBuckets.keys().next().value;if(k!==undefined)fallbackBuckets.delete(k);}return arr.length>MAX;}
export async function isDistributedRateLimited(db:any,key:string,max=10):Promise<boolean>{try{const {data,error}=await db.rpc("check_login_rate_limit",{p_key:key,p_max:max});if(error)return true;return data!==true;}catch(_){return true;}}
export function isStrongPassword(password:string):boolean{if(typeof password!=="string"||password.length<10)return false;return /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(password)&&/[0-9]/.test(password);}
export const GENERIC_LOGIN_ERROR="Geçersiz kullanıcı adı veya şifre.";
export function jsonError(message:string,status:number,headers:Record<string,string>):Response{return Response.json({error:message},{status,headers});}
