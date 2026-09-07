import { withSupabase } from "npm:@supabase/server";
export const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-idempotency-key","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
export const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
export const options=()=>new Response("ok",{headers:cors});
export function isPatron(ctx:any){const a=ctx?.userClaims?.app_metadata||{},m=ctx?.userClaims?.user_metadata||{};return ["patron","owner","admin"].includes(String(a.role||""))||m.admin_access===true||["owner","admin"].includes(String(m.organization_role||""));}
export function patronGuard(ctx:any){if(!ctx?.userClaims?.id)throw new Error("AUTH_REQUIRED");if(!isPatron(ctx))throw new Error("PATRON_REQUIRED");return ctx.userClaims;}
export const withPatron=(handler:any)=>withSupabase({auth:"user"},async(req:any,ctx:any)=>handler(req,ctx,patronGuard(ctx)));
function canonical(v:any):any{if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==="object")return Object.keys(v).sort().reduce((o,k)=>{o[k]=canonical(v[k]);return o},{} as any);return v}
export async function sha256(v:unknown){const bytes=new TextEncoder().encode(JSON.stringify(canonical(v)));const digest=await crypto.subtle.digest("SHA-256",bytes);return"sha256:"+[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export function err(e:unknown){const msg=e instanceof Error?e.message:String(e),map:Record<string,[number,string]>={AUTH_REQUIRED:[401,"Oturum gerekli"],PATRON_REQUIRED:[403,"Patron yetkisi gerekli"],BAD_REQUEST:[400,"Geçersiz istek"],FORBIDDEN:[403,"Yetki reddedildi"],NOT_FOUND:[404,"Kayıt bulunamadı"]};const [status,text]=map[msg]||[500,msg];return json({error:text},status)}
