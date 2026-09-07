import { json, options, withPatron, sha256, err } from "../_shared/core.ts";

const P:any={
  groq:{env:"GROQ_API_KEY",base:"https://api.groq.com/openai/v1",modelEnv:"GROQ_MODEL",model:"llama-3.3-70b-versatile"},
  gemini:{env:"GOOGLE_AI_API_KEY",base:"https://generativelanguage.googleapis.com/v1beta/openai",modelEnv:"GOOGLE_AI_MODEL",model:"gemini-2.5-flash"},
  huggingface:{env:"HUGGINGFACE_API_KEY",base:"https://router.huggingface.co/v1",modelEnv:"HUGGINGFACE_MODEL",model:"openai/gpt-oss-120b:fastest"},
  mistral:{env:"MISTRAL_API_KEY",base:"https://api.mistral.ai/v1",modelEnv:"MISTRAL_MODEL",model:"mistral-small-latest"},
  deepseek:{env:"DEEPSEEK_API_KEY",base:"https://api.deepseek.com/v1",modelEnv:"DEEPSEEK_MODEL",model:"deepseek-chat"},
  xai:{env:"XAI_API_KEY",base:"https://api.x.ai/v1",modelEnv:"XAI_MODEL",model:"grok-4-1-fast"},
  openrouter:{env:"OPENROUTER_API_KEY",base:"https://openrouter.ai/api/v1",modelEnv:"OPENROUTER_MODEL",model:"openai/gpt-4o-mini"},
  llm7:{env:"LLM7_API_KEY",base:"https://api.llm7.io/v1",modelEnv:"LLM7_MODEL",model:"default",tools:false}
};
const TABLES:any={leads:["teklifler","leads","contacts"],events:["event_projects","events","etkinlikler"],equipment:["equipment","ekipman","technical_specs"],staff:["staff","personnel","personel"]};
const WRITE=new Set(["github.file_write","github.push","github.merge","github.open_pr","db.delete","db.bulk_update","pricing.update","deploy","permission.change","agent.create","agent.delete","agent.grant_tool","quotes.send"]);
const TOOLS:any=[
{name:"leads.list",description:"Canlı teklif/lead kayıtlarını listeler",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}},
{name:"events.list",description:"Canlı etkinlik kayıtlarını listeler",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}},
{name:"equipment.list",description:"Canlı ekipman kayıtlarını listeler",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}},
{name:"staff.list",description:"Canlı personel kayıtlarını listeler",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:50}},additionalProperties:false}},
{name:"agents.list",description:"JARVIS ajanlarını listeler",parameters:{type:"object",properties:{},additionalProperties:false}},
{name:"approvals.list",description:"Bekleyen JARVIS onaylarını listeler",parameters:{type:"object",properties:{},additionalProperties:false}},
{name:"github.status",description:"GitHub bağlantı durumunu kontrol eder",parameters:{type:"object",properties:{branch:{type:"string"}},additionalProperties:false}},
{name:"repo.tree",description:"GitHub repository ağacını listeler",parameters:{type:"object",properties:{branch:{type:"string"}},additionalProperties:false}},
{name:"repo.read_file",description:"GitHub repository dosyası okur",parameters:{type:"object",properties:{path:{type:"string"},branch:{type:"string"}},required:["path"],additionalProperties:false}},
{name:"repo.propose_change",description:"Repository değişikliği için approval oluşturur; doğrudan yazmaz",parameters:{type:"object",properties:{path:{type:"string"},content:{type:"string"},commit_message:{type:"string"},base_branch:{type:"string"},pr_title:{type:"string"},pr_body:{type:"string"}},required:["path","content"],additionalProperties:false}},
{name:"db.delete",description:"Allowlist DB kaydını silmek için approval oluşturur",parameters:{type:"object",properties:{table:{type:"string",enum:["teklifler","event_projects","equipment","staff","services","price_rules"]},id:{type:"string",format:"uuid"}},required:["table","id"],additionalProperties:false}},
{name:"db.bulk_update",description:"Allowlist DB güncellemesi için approval oluşturur",parameters:{type:"object",properties:{table:{type:"string",enum:["teklifler","event_projects","equipment","staff","services","price_rules"]},id:{type:"string",format:"uuid"},values:{type:"object"}},required:["table","id","values"],additionalProperties:false}},
{name:"pricing.update",description:"Service veya price rule fiyatı için approval oluşturur",parameters:{type:"object",properties:{target:{type:"string",enum:["services","price_rules"]},id:{type:"string",format:"uuid"},field:{type:"string",enum:["base_price","daily_price","crew_unit_price","setup_fee","teardown_fee","margin_pct","value"]},value:{type:"number"}},required:["target","id","field","value"],additionalProperties:false}},
{name:"permission.change",description:"Admin capability grant değişikliği için approval oluşturur",parameters:{type:"object",properties:{user_id:{type:"string",format:"uuid"},capability_key:{type:"string"},enabled:{type:"boolean"}},required:["user_id","capability_key","enabled"],additionalProperties:false}},
{name:"agent.create",description:"JARVIS ajanı oluşturmak için approval oluşturur",parameters:{type:"object",properties:{name:{type:"string"},mode:{type:"string"},system_prompt:{type:"string"},tools:{type:"array",items:{type:"string"}}},required:["name"],additionalProperties:false}},
{name:"agent.delete",description:"JARVIS ajanını emekliye ayırmak için approval oluşturur",parameters:{type:"object",properties:{id:{type:"string"}},required:["id"],additionalProperties:false}},
{name:"agent.grant_tool",description:"JARVIS ajanına tool izni vermek için approval oluşturur",parameters:{type:"object",properties:{id:{type:"string"},tool:{type:"string"}},required:["id","tool"]}},
{name:"quotes.send",description:"Teklif gönderimi için approval oluşturur",parameters:{type:"object",properties:{offer_id:{type:"string",format:"uuid"},channel:{type:"string",enum:["email","whatsapp","sms"]},message:{type:"string"}},required:["offer_id","channel","message"]}},
{name:"deploy",description:"Allowlist deploy işlemi için approval oluşturur",parameters:{type:"object",properties:{target:{type:"string",enum:["pages","supabase"]},function:{type:"string"}},required:["target"]}}
];

async function table(admin:any,alias:string,limit=50){for(const t of TABLES[alias]||[]){const r=await admin.from(t).select("*").limit(limit);if(!r.error)return{table:t,items:r.data||[],count:(r.data||[]).length};}return{table:null,items:[],count:0};}
async function ghRead(tool:string,p:any){const token=Deno.env.get("GITHUB_TOKEN");if(!token)throw Error("GITHUB_TOKEN secret eksik");const o=Deno.env.get("GITHUB_OWNER")||"ibrahimFOH",r=Deno.env.get("GITHUB_REPO")||"Stagepulse.hatay",b=String(p.branch||"main"),h={Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};if(tool==="repo.tree"){const x=await fetch(`https://api.github.com/repos/${o}/${r}/git/trees/${encodeURIComponent(b)}?recursive=1`,{headers:h});if(!x.ok)throw Error("Repo ağacı alınamadı");const d=await x.json();return{owner:o,repo:r,branch:b,files:(d.tree||[]).filter((z:any)=>z.type==="blob").map((z:any)=>z.path)}}const path=String(p.path||"");if(!path||path.includes("..")||path.startsWith("/"))throw Error("Geçersiz path");const x=await fetch(`https://api.github.com/repos/${o}/${r}/contents/${encodeURIComponent(path).replace(/%2F/g,"/")}?ref=${encodeURIComponent(b)}`,{headers:h});if(!x.ok)throw Error("Dosya okunamadı");const d=await x.json();return{owner:o,repo:r,branch:b,path:d.path,sha:d.sha,content:new TextDecoder().decode(Uint8Array.from(atob(String(d.content).replace(/\n/g,"")),c=>c.charCodeAt(0)))};}
async function approval(admin:any,userId:string,type:string,payload:any){const key=crypto.randomUUID(),payload_hash=await sha256(payload),a={id:"ap_"+key,type,status:"pending",requested_by:"patron",requested_by_user:userId,preview:{title:"Patron onayı gerekli",risk:"high",diff_summary:payload.diff_summary||payload.instruction||type},payload,payload_hash,idempotency_key:key};const r=await admin.from("jarvis_approvals").insert(a).select().single();if(r.error)throw r.error;await admin.from("jarvis_audit").insert({actor:userId,mode:"patron",event_type:"approval.created",body:{approval_id:a.id,type}});return{status:"pending_approval",approval_id:a.id,approval:a};}
async function execTool(admin:any,userId:string,tool:string,p:any){
 if(WRITE.has(tool)){const type=tool==="repo.propose_change"?"github.file_write":tool;return approval(admin,userId,type,p)}
 if(tool==="leads.list")return table(admin,"leads",Math.min(Number(p.limit)||50,50));
 if(tool==="events.list")return table(admin,"events",Math.min(Number(p.limit)||50,50));
 if(tool==="equipment.list")return table(admin,"equipment",Math.min(Number(p.limit)||50,50));
 if(tool==="staff.list")return table(admin,"staff",Math.min(Number(p.limit)||50,50));
 if(tool==="agents.list"){const r=await admin.from("jarvis_agents").select("id,name,mode,tools,status,created_at,updated_at").order("created_at",{ascending:false});if(r.error)throw r.error;return{items:r.data||[],count:(r.data||[]).length};}
 if(tool==="approvals.list"){const r=await admin.from("jarvis_approvals").select("id,type,status,preview,payload,created_at,requested_by").eq("status","pending").order("created_at",{ascending:false}).limit(50);if(r.error)throw r.error;return{items:r.data||[],count:(r.data||[]).length};}
 if(tool==="github.status")return{owner:Deno.env.get("GITHUB_OWNER")||"ibrahimFOH",repo:Deno.env.get("GITHUB_REPO")||"Stagepulse.hatay",branch:String(p.branch||"main"),configured:Boolean(Deno.env.get("GITHUB_TOKEN"))};
 if(tool==="repo.tree"||tool==="repo.read_file")return ghRead(tool,p);
 throw Error("Bilinmeyen araç: "+tool);
}
async function openaiAgent(p:any,key:string,model:string,userMessage:string,history:any[],context:any,memory:any,admin:any,userId:string,toolsEnabled=true){
 const system="Sen Stagepulse Patron JARVIS'sın. Türkçe konuş. Canlı şirket verisi için araçları kullan. Yazma/silme/fiyat/izin/deploy/GitHub/teklif gönderme gibi kritik işlemleri asla doğrudan yapma; approval oluştur. Bir işlemin sonucu ancak gerçek tool sonucu geldiyse yapılmış say. Araçları gerekirse birden çok adımda sırayla kullan.";
 let messages:any[]=[{role:"system",content:system},{role:"user",content:JSON.stringify({message:userMessage,context,memory,history})}],lastTool:any=null;
 for(let round=0;round<4;round++){
   const body:any={model,messages,temperature:.2,max_tokens:1000};
   if(toolsEnabled){body.tools=TOOLS.map((t:any)=>({type:"function",function:t}));body.tool_choice="auto";}
   const r=await fetch(p.base+"/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify(body)});
   const j=await r.json();if(!r.ok)throw Error(`AI ${r.status}: ${j?.error?.message||"API hatası"}`);
   const m=j?.choices?.[0]?.message;if(!m)throw Error("AI cevabı boş");
   if(!toolsEnabled||!Array.isArray(m.tool_calls)||!m.tool_calls.length)return{reply:String(m.content||""),tool:lastTool};
   messages.push(m);
   for(const call of m.tool_calls){const name=String(call?.function?.name||""),args=JSON.parse(call?.function?.arguments||"{}");const result=await execTool(admin,userId,name,args);lastTool={name,result:(result as any)?.status||"ok"};messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result).slice(0,12000)});}
 }
 return{reply:"Araç zinciri azami adım sayısına ulaştı. Sonuçları yukarıdaki tool çıktıları üzerinden değerlendirdim.",tool:lastTool};
}

Deno.serve(withPatron(async(req:any,ctx:any,user:any)=>{if(req.method==="OPTIONS")return options();try{if(req.method!=="POST")return json({error:"POST gerekli"},405);const admin=ctx.supabaseAdmin,b=await req.json();if(b.health===true)return json({ok:true,service:"patron-ai",user:user.id,ai_configured:Object.keys(P).some(id=>Boolean(Deno.env.get(P[id].env))),providers:Object.fromEntries(Object.entries(P).map(([id,p]:any)=>[id,Boolean(Deno.env.get(p.env))])),github_configured:Boolean(Deno.env.get("GITHUB_TOKEN"))});const message=String(b.message||"").trim().slice(0,4000);if(!message)throw Error("BAD_REQUEST");const memR=await admin.from("jarvis_memory").select("content,created_at").eq("scope","patron").eq("scope_id",user.id).order("created_at",{ascending:false}).limit(12);if(memR.error)throw memR.error;const history=Array.isArray(b.history)?b.history.slice(-12):[],order=Object.keys(P),reply0="JARVIS çevrimiçi. Canlı tool ve approval katmanı hazır.",provider0="fallback";let reply=reply0,provider=provider0,providerError="",tool:any=null;for(const id of order){const p=P[id],key=Deno.env.get(p.env);if(!key)continue;try{const out=await openaiAgent(p,key,Deno.env.get(p.modelEnv)||p.model,message,history,null,memR.data||[],admin,user.id,p.tools!==false);if(out.reply){reply=out.reply;tool=out.tool;provider=id;break;}}catch(e){providerError=String(e)}}const memory={message:message.slice(0,1000),reply:reply.slice(0,1500),tool,at:new Date().toISOString()};await admin.from("jarvis_memory").insert({scope:"patron",scope_id:user.id,content:memory});await admin.from("jarvis_audit").insert({actor:user.id,mode:"patron",event_type:"patron.chat",body:{message:message.slice(0,1000),provider,provider_error:providerError||null,tool}});return json({reply,provider,ai_configured:provider!=="fallback",provider_error:providerError||null,tool,memory_count:(memR.data||[]).length+1});}catch(e){return err(e)}}));
