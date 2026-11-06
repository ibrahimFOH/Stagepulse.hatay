import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "sesm-education-pdfs";
const ORIGINS = new Set(["https://stagepulse.com.tr","https://www.stagepulse.com.tr","https://appassets.androidplatform.net","http://localhost:5173","http://127.0.0.1:5173"]);
const headers = (req:Request) => ({
  ...(ORIGINS.has(req.headers.get("origin") ?? "") ? {"Access-Control-Allow-Origin":req.headers.get("origin")!} : {}),
  "Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"
});
const send = (req:Request, body:unknown, status=200) => new Response(JSON.stringify(body),{status,headers:headers(req)});
const bad = (req:Request, error:string, status=400) => send(req,{ok:false,error},status);
const text = (v:unknown,n=500) => typeof v==="string" ? v.trim().slice(0,n) : "";
const strong = (v:string) => v.length>=10 && v.length<=128 && /[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(v) && /\d/.test(v);
const norm = (v:unknown) => (Array.isArray(v)?v:[v]).map(x=>String(x??"").trim().toLocaleLowerCase("tr-TR")).filter(Boolean).sort();
const equalAnswer = (a:unknown,b:unknown) => {const x=norm(a),y=norm(b);return x.length===y.length&&x.every((v,i)=>v===y[i]);};

async function caller(req:Request) {
  const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(!token)throw new Error("UNAUTHENTICATED");
  const {data,error}=await supabase.auth.getUser(token);
  if(error||!data.user)throw new Error("UNAUTHENTICATED");
  return data.user;
}
async function owner(userId:string) {
  const {data,error}=await supabase.from("org_memberships")
    .select("user_id,role:org_roles!org_memberships_role_id_fkey(code,is_admin_role,active)")
    .eq("user_id",userId).eq("active",true).limit(2);
  if(error||!data||data.length!==1)return false;
  const role=Array.isArray(data[0].role)?data[0].role[0]:data[0].role;
  if(role?.code!=="owner"||role?.is_admin_role!==true||role?.active!==true)return false;
  const {data:all,error:allError}=await supabase.from("org_memberships")
    .select("user_id,role:org_roles!org_memberships_role_id_fkey(code,is_admin_role,active)").eq("active",true);
  if(allError)return false;
  const ids=[...new Set((all??[]).filter((m:any)=>{const r=Array.isArray(m.role)?m.role[0]:m.role;return r?.code==="owner"&&r?.is_admin_role===true&&r?.active===true;}).map((m:any)=>String(m.user_id)))];
  return ids.length===1&&ids[0]===userId;
}
async function student(userId:string) {
  const {data:s,error}=await supabase.from("sesm_students").select("user_id,license_id,is_active")
    .eq("user_id",userId).eq("is_active",true).maybeSingle();
  if(error||!s)throw new Error("STUDENT_ACCESS_REQUIRED");
  const {data:l,error:le}=await supabase.from("sesm_license_keys").select("is_active,payment_status,expires_at").eq("id",s.license_id).maybeSingle();
  if(le||!l?.is_active||l.payment_status!=="paid"||(l.expires_at&&Date.parse(l.expires_at)<=Date.now()))throw new Error("STUDENT_LICENSE_REQUIRED");
}
async function ownedExam(id:string,uid:string) {
  const {data,error}=await supabase.from("sesm_exams").select("id").eq("id",id).eq("created_by",uid).maybeSingle();
  if(error||!data)throw new Error("EXAM_NOT_FOUND");
}
async function audit(uid:string,action:string,subject:string|null,details:Record<string,unknown>={}) {
  await supabase.from("sesm_audit_events").insert({actor_user_id:uid,action,subject_user_id:subject,details:{area:"education_admin",...details}});
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{status:204,headers:headers(req)});
  if(req.method!=="POST")return bad(req,"METHOD_NOT_ALLOWED",405);
  try{
    const user=await caller(req);
    const raw=await req.text();
    if(new TextEncoder().encode(raw).byteLength>256*1024)return bad(req,"PAYLOAD_TOO_LARGE",413);
    let b:any;try{b=raw?JSON.parse(raw):{};}catch{return bad(req,"INVALID_JSON",400);}
    if(!b||typeof b!=="object"||Array.isArray(b))return bad(req,"INVALID_REQUEST",400);
    const action=text(b.action,50);
    const adminActions=new Set(["students_list","student_licenses_list","student_create","student_delete","student_password_reset","exams_list","exam_save","exam_delete","exam_publish","questions_list","question_save","question_delete","exam_attempts","documents_list","document_register","document_update","document_replace","document_publish","document_delete","document_analytics","document_signed_url"]);
    if(adminActions.has(action)&&!(await owner(user.id)))return bad(req,"FORBIDDEN_OWNER_ONLY",403);

    if(action==="students_list"){
      const {data,error}=await supabase.from("sesm_students").select("user_id,license_id,email,display_name,is_active,created_at,updated_at").eq("teacher_user_id",user.id).order("created_at",{ascending:false}).limit(500);
      if(error)throw new Error("STUDENT_LIST_FAILED");
      const ids=(data??[]).map((x:any)=>x.user_id);
      const [p,l]=await Promise.all([
        ids.length?supabase.from("sesm_progress").select("student_user_id,completed").in("student_user_id",ids):Promise.resolve({data:[],error:null}),
        (data??[]).length?supabase.from("sesm_license_keys").select("id,label,payment_status,expires_at,is_active").in("id",(data??[]).map((x:any)=>x.license_id)):Promise.resolve({data:[],error:null})
      ]);
      if(p.error||l.error)throw new Error("STUDENT_LIST_FAILED");
      const lm=new Map((l.data??[]).map((x:any)=>[x.id,x])), pm=new Map<string,{done:number,total:number}>();
      for(const x of p.data??[]){const v=pm.get(x.student_user_id)??{done:0,total:0};v.total++;if(x.completed)v.done++;pm.set(x.student_user_id,v);}
      return send(req,{ok:true,students:(data??[]).map((x:any)=>({...x,license:lm.get(x.license_id)??null,progress:pm.get(x.user_id)??{done:0,total:0}}))});
    }

    if(action==="student_licenses_list"){
      const {data,error}=await supabase.from("sesm_license_keys")
        .select("id,label,customer_name,customer_email,payment_status,expires_at,is_active,plan_code,bundle_code")
        .eq("created_by",user.id).eq("is_active",true).eq("payment_status","paid")
        .order("created_at",{ascending:false}).limit(500);
      if(error)throw new Error("STUDENT_LICENSE_LIST_FAILED");
      const valid=(data??[]).filter((x:any)=>!x.expires_at||Date.parse(x.expires_at)>Date.now());
      return send(req,{ok:true,licenses:valid});
    }
    if(action==="student_create"){
      const email=text(b.email,320).toLowerCase(),name=text(b.display_name,120),password=typeof b.password==="string"?b.password:"",licenseId=text(b.license_id,80);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||!strong(password)||!licenseId)return bad(req,"STUDENT_INPUT_INVALID",400);
      const {data:l,error:le}=await supabase.from("sesm_license_keys").select("id,is_active,payment_status,expires_at")
        .eq("id",licenseId).eq("created_by",user.id).maybeSingle();
      if(le||!l?.is_active||l.payment_status!=="paid"||(l.expires_at&&Date.parse(l.expires_at)<=Date.now()))return bad(req,"STUDENT_LICENSE_INVALID",409);
      const created=await supabase.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name,role:"student",created_by_admin:true}});
      if(created.error||!created.data.user)return bad(req,(created.error?.message??"").toLowerCase().includes("already")?"STUDENT_EMAIL_EXISTS":"STUDENT_CREATE_FAILED",409);
      const id=created.data.user.id;
      const {error:ie}=await supabase.from("sesm_students").insert({user_id:id,teacher_user_id:user.id,license_id:licenseId,email,display_name:name,is_active:true});
      if(ie){await supabase.auth.admin.deleteUser(id);throw new Error("STUDENT_PROFILE_CREATE_FAILED");}
      await audit(user.id,"student_created",id,{email,display_name:name,license_id:licenseId});
      return send(req,{ok:true,student:{user_id:id,email,display_name:name,license_id:licenseId}},201);
    }
    if(action==="student_password_reset"){
      const id=text(b.student_user_id,80),password=typeof b.new_password==="string"?b.new_password:"";
      if(!id||!strong(password))return bad(req,"PASSWORD_POLICY_INVALID",400);
      const {data:s,error}=await supabase.from("sesm_students").select("user_id,email").eq("user_id",id).eq("teacher_user_id",user.id).maybeSingle();
      if(error||!s)return bad(req,"STUDENT_NOT_FOUND",404);
      const r=await supabase.auth.admin.updateUserById(id,{password});if(r.error)throw new Error("STUDENT_PASSWORD_RESET_FAILED");
      await audit(user.id,"student_password_reset",id,{email:s.email});return send(req,{ok:true});
    }
    if(action==="student_delete"){
      const id=text(b.student_user_id,80);if(!id||id===user.id)return bad(req,"STUDENT_NOT_FOUND",404);
      const {data:s,error}=await supabase.from("sesm_students").select("user_id,email,display_name").eq("user_id",id).eq("teacher_user_id",user.id).maybeSingle();
      if(error||!s)return bad(req,"STUDENT_NOT_FOUND",404);
      await audit(user.id,"student_deleted",null,{student_user_id:id,email:s.email,display_name:s.display_name});
      await supabase.from("sesm_progress").update({marked_by:null}).eq("marked_by",id);
      const r=await supabase.auth.admin.deleteUser(id);if(r.error)throw new Error("STUDENT_DELETE_FAILED");
      return send(req,{ok:true});
    }

    if(action==="exams_list"){
      const {data,error}=await supabase.from("sesm_exams").select("id,title,description,module_id,duration_minutes,pass_percent,attempts_allowed,is_published,created_at,updated_at,published_at").eq("created_by",user.id).order("created_at",{ascending:false}).limit(300);
      if(error)throw error;return send(req,{ok:true,exams:data??[]});
    }
    if(action==="exam_save"){
      const id=text(b.id,80),title=text(b.title,180),description=text(b.description,3000),module=text(b.module_id,80)||null;
      const duration=b.duration_minutes===null||b.duration_minutes===""?null:Number(b.duration_minutes),pass=Number(b.pass_percent??70),attempts=Number(b.attempts_allowed??1);
      if(title.length<2||!Number.isFinite(pass)||pass<0||pass>100||!Number.isInteger(attempts)||attempts<1||attempts>20||(duration!==null&&(!Number.isInteger(duration)||duration<1||duration>600)))return bad(req,"EXAM_INPUT_INVALID",400);
      const payload={title,description,module_id:module,duration_minutes:duration,pass_percent:pass,attempts_allowed:attempts,updated_at:new Date().toISOString(),is_published:false,published_at:null};
      let exam:any;
      if(id){const r=await supabase.from("sesm_exams").update(payload).eq("id",id).eq("created_by",user.id).select().maybeSingle();if(r.error||!r.data)return bad(req,"EXAM_NOT_FOUND",404);exam=r.data;}
      else{const r=await supabase.from("sesm_exams").insert({...payload,created_by:user.id}).select().single();if(r.error||!r.data)throw new Error("EXAM_CREATE_FAILED");exam=r.data;}
      await audit(user.id,id?"exam_updated":"exam_created",null,{exam_id:exam.id,title});return send(req,{ok:true,exam});
    }
    if(action==="exam_delete"||action==="exam_publish"){
      const id=text(b.exam_id,80);if(!id)return bad(req,"EXAM_NOT_FOUND",404);await ownedExam(id,user.id);
      if(action==="exam_delete"){const r=await supabase.from("sesm_exams").delete().eq("id",id).eq("created_by",user.id);if(r.error)throw new Error("EXAM_DELETE_FAILED");await audit(user.id,"exam_deleted",null,{exam_id:id});return send(req,{ok:true});}
      const publish=b.published===true;
      if(publish){const q=await supabase.from("sesm_questions").select("id",{count:"exact",head:true}).eq("exam_id",id);if(q.error)throw q.error;if((q.count??0)<1)return bad(req,"EXAM_HAS_NO_QUESTIONS",409);}
      const r=await supabase.from("sesm_exams").update({is_published:publish,published_at:publish?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id).select().single();
      if(r.error)throw new Error("EXAM_PUBLISH_FAILED");await audit(user.id,publish?"exam_published":"exam_unpublished",null,{exam_id:id});return send(req,{ok:true,exam:r.data});
    }
    if(action==="questions_list"){
      const id=text(b.exam_id,80);if(!id)return bad(req,"EXAM_NOT_FOUND",404);await ownedExam(id,user.id);
      const r=await supabase.from("sesm_questions").select("id,exam_id,question_text,question_type,options,correct_answer,explanation,points,position").eq("exam_id",id).order("position");
      if(r.error)throw r.error;return send(req,{ok:true,questions:r.data??[]});
    }
    if(action==="question_save"){
      const id=text(b.id,80),examId=text(b.exam_id,80),question=text(b.question_text,4000),type=text(b.question_type,30);
      const options=Array.isArray(b.options)?b.options.slice(0,20):[],correct=b.correct_answer,points=Number(b.points??1),position=Number(b.position??0);
      if(!examId||question.length<2||!["single_choice","multiple_choice","true_false","short_answer"].includes(type)||!Number.isFinite(points)||points<=0||points>1000||!Number.isInteger(position))return bad(req,"QUESTION_INPUT_INVALID",400);
      await ownedExam(examId,user.id);
      if((type==="single_choice"&&(!options.length||typeof correct!=="string"))||(type==="multiple_choice"&&(!options.length||!Array.isArray(correct)||!correct.length))||(type==="true_false"&&typeof correct!=="boolean")||(type==="short_answer"&&!(typeof correct==="string"||Array.isArray(correct))))return bad(req,"QUESTION_ANSWER_INVALID",400);
      const payload={exam_id:examId,question_text:question,question_type:type,options,correct_answer:correct,explanation:text(b.explanation,2000),points,position,updated_at:new Date().toISOString()};
      let result:any;if(id){const r=await supabase.from("sesm_questions").update(payload).eq("id",id).eq("exam_id",examId).select().maybeSingle();if(r.error||!r.data)return bad(req,"QUESTION_NOT_FOUND",404);result=r.data;}
      else{const r=await supabase.from("sesm_questions").insert(payload).select().single();if(r.error||!r.data)throw new Error("QUESTION_CREATE_FAILED");result=r.data;}
      await supabase.from("sesm_exams").update({updated_at:new Date().toISOString(),is_published:false,published_at:null}).eq("id",examId);
      await audit(user.id,id?"question_updated":"question_created",null,{exam_id:examId,question_id:result.id});return send(req,{ok:true,question:result});
    }
    if(action==="question_delete"){
      const id=text(b.question_id,80),examId=text(b.exam_id,80);if(!id||!examId)return bad(req,"QUESTION_NOT_FOUND",404);await ownedExam(examId,user.id);
      const r=await supabase.from("sesm_questions").delete().eq("id",id).eq("exam_id",examId);if(r.error)throw new Error("QUESTION_DELETE_FAILED");
      await supabase.from("sesm_exams").update({is_published:false,published_at:null,updated_at:new Date().toISOString()}).eq("id",examId);
      await audit(user.id,"question_deleted",null,{exam_id:examId,question_id:id});return send(req,{ok:true});
    }
    if(action==="exam_attempts"){
      const id=text(b.exam_id,80);if(!id)return bad(req,"EXAM_NOT_FOUND",404);await ownedExam(id,user.id);
      const r=await supabase.from("sesm_exam_attempts").select("id,student_user_id,score,max_score,percent,passed,correct_count,question_count,started_at,submitted_at,status").eq("exam_id",id).order("submitted_at",{ascending:false}).limit(500);
      if(r.error)throw r.error;const ids=(r.data??[]).map((x:any)=>x.student_user_id);
      const s=ids.length?await supabase.from("sesm_students").select("user_id,email,display_name").in("user_id",ids):{data:[]};
      const map=new Map((s.data??[]).map((x:any)=>[x.user_id,x]));return send(req,{ok:true,attempts:(r.data??[]).map((x:any)=>({...x,student:map.get(x.student_user_id)??null}))});
    }
    if(action==="published_exams"){
      await student(user.id);const r=await supabase.from("sesm_exams").select("id,title,description,module_id,duration_minutes,pass_percent,attempts_allowed,published_at").eq("is_published",true).order("published_at",{ascending:false});
      if(r.error)throw r.error;return send(req,{ok:true,exams:r.data??[]});
    }
    if(action==="exam_begin"){
      await student(user.id);const id=text(b.exam_id,80);
      const e=await supabase.from("sesm_exams").select("id,title,duration_minutes,attempts_allowed").eq("id",id).eq("is_published",true).maybeSingle();
      if(e.error||!e.data)return bad(req,"EXAM_NOT_AVAILABLE",404);
      const count=await supabase.from("sesm_exam_attempts").select("id",{count:"exact",head:true}).eq("exam_id",id).eq("student_user_id",user.id);
      if(count.error)throw count.error;if((count.count??0)>=e.data.attempts_allowed)return bad(req,"EXAM_ATTEMPTS_EXHAUSTED",409);
      const q=await supabase.from("sesm_questions").select("id,exam_id,question_text,question_type,options,points,position").eq("exam_id",id).order("position");
      if(q.error)throw q.error;if(!q.data?.length)return bad(req,"EXAM_HAS_NO_QUESTIONS",409);
      const a=await supabase.from("sesm_exam_attempts").insert({exam_id:id,student_user_id:user.id,status:"in_progress",started_at:new Date().toISOString(),submitted_at:null,answers:{},score:0,max_score:0,percent:0,passed:false,correct_count:0,question_count:0}).select("id,started_at").single();
      if(a.error||!a.data)throw new Error("EXAM_BEGIN_FAILED");
      return send(req,{ok:true,attempt:a.data,exam:e.data,questions:q.data});
    }
    if(action==="exam_submit"){
      await student(user.id);const id=text(b.attempt_id,80),answers=b.answers&&typeof b.answers==="object"&&!Array.isArray(b.answers)?b.answers:{};
      const a=await supabase.from("sesm_exam_attempts").select("id,exam_id,started_at,status").eq("id",id).eq("student_user_id",user.id).maybeSingle();
      if(a.error||!a.data||a.data.status!=="in_progress")return bad(req,"EXAM_ATTEMPT_NOT_FOUND",404);
      const e=await supabase.from("sesm_exams").select("id,pass_percent,duration_minutes").eq("id",a.data.exam_id).eq("is_published",true).maybeSingle();
      if(e.error||!e.data)return bad(req,"EXAM_NOT_AVAILABLE",404);
      const q=await supabase.from("sesm_questions").select("id,question_type,correct_answer,points").eq("exam_id",e.data.id);
      if(q.error||!q.data?.length)return bad(req,"EXAM_HAS_NO_QUESTIONS",409);
      let score=0,max=0,correct=0;for(const item of q.data){const pts=Number(item.points)||0;max+=pts;const supplied=answers[item.id];const ok=item.question_type==="true_false"?Boolean(supplied)===Boolean(item.correct_answer):equalAnswer(supplied,item.correct_answer);if(ok){score+=pts;correct++;}}
      const percent=max?Math.round(score/max*10000)/100:0,timed=!!e.data.duration_minutes&&Date.now()-Date.parse(a.data.started_at)>e.data.duration_minutes*60000;
      const result=await supabase.from("sesm_exam_attempts").update({answers,score,max_score:max,percent,passed:!timed&&percent>=Number(e.data.pass_percent),correct_count:correct,question_count:q.data.length,submitted_at:new Date().toISOString(),status:timed?"timed_out":"submitted"}).eq("id",id).eq("student_user_id",user.id).eq("status","in_progress").select("id,score,max_score,percent,passed,correct_count,question_count,submitted_at,status").single();
      if(result.error)throw new Error("EXAM_SUBMIT_FAILED");return send(req,{ok:true,result:result.data});
    }

    if(action==="documents_list"){
      const r=await supabase.from("sesm_education_documents").select("*").order("updated_at",{ascending:false}).limit(500);
      if(r.error)throw r.error;return send(req,{ok:true,documents:r.data??[]});
    }
    if(action==="document_register"){
      const title=text(b.title,180),description=text(b.description,3000),category=text(b.category,80)||"genel",path=text(b.storage_path,500),file=text(b.file_name,255),size=Number(b.file_size);
      if(title.length<2||!path.startsWith(user.id+"/")||!file.toLowerCase().endsWith(".pdf")||!Number.isInteger(size)||size<1||size>52428800)return bad(req,"DOCUMENT_INPUT_INVALID",400);
      const folder=path.split("/").slice(0,-1).join("/"),name=path.split("/").at(-1);
      const objects=await supabase.storage.from(BUCKET).list(folder,{search:name,limit:100});
      if(objects.error||!(objects.data??[]).some((x:any)=>x.name===name))return bad(req,"DOCUMENT_FILE_NOT_FOUND",404);
      const r=await supabase.from("sesm_education_documents").insert({title,description,category,storage_path:path,file_name:file,file_size:size,mime_type:"application/pdf",uploaded_by:user.id,version:1,is_published:false}).select().single();
      if(r.error)throw new Error("DOCUMENT_REGISTER_FAILED");await audit(user.id,"education_document_uploaded",null,{document_id:r.data.id,title,file_name:file});return send(req,{ok:true,document:r.data},201);
    }
    if(action==="document_update"){
      const id=text(b.document_id,80),title=text(b.title,180);if(!id||title.length<2)return bad(req,"DOCUMENT_INPUT_INVALID",400);
      const r=await supabase.from("sesm_education_documents").update({title,description:text(b.description,3000),category:text(b.category,80)||"genel",updated_at:new Date().toISOString(),is_published:false,published_at:null}).eq("id",id).select().maybeSingle();
      if(r.error||!r.data)return bad(req,"DOCUMENT_NOT_FOUND",404);await audit(user.id,"education_document_updated",null,{document_id:id,title});return send(req,{ok:true,document:r.data});
    }

    if(action==="document_replace"){
      const id=text(b.document_id,80),path=text(b.storage_path,500),file=text(b.file_name,255),size=Number(b.file_size);
      if(!id||!path.startsWith(user.id+"/")||!file.toLowerCase().endsWith(".pdf")||!Number.isInteger(size)||size<1||size>52428800)return bad(req,"DOCUMENT_INPUT_INVALID",400);
      const doc=await supabase.from("sesm_education_documents").select("id,storage_path,version").eq("id",id).maybeSingle();
      if(doc.error||!doc.data)return bad(req,"DOCUMENT_NOT_FOUND",404);
      const parts=path.split("/"),folder=parts.slice(0,-1).join("/"),name=parts.at(-1);
      const objects=await supabase.storage.from(BUCKET).list(folder,{search:name,limit:100});
      if(objects.error||!(objects.data??[]).some((x:any)=>x.name===name))return bad(req,"DOCUMENT_FILE_NOT_FOUND",404);
      const updated=await supabase.from("sesm_education_documents").update({
        storage_path:path,file_name:file,file_size:size,version:Number(doc.data.version||1)+1,
        is_published:false,published_at:null,updated_at:new Date().toISOString()
      }).eq("id",id).select().single();
      if(updated.error)throw new Error("DOCUMENT_REPLACE_FAILED");
      await supabase.storage.from(BUCKET).remove([doc.data.storage_path]);
      await audit(user.id,"education_document_replaced",null,{document_id:id,file_name:file,version:updated.data.version});
      return send(req,{ok:true,document:updated.data});
    }
    if(action==="document_publish"){
      const id=text(b.document_id,80),publish=b.published===true;if(!id)return bad(req,"DOCUMENT_NOT_FOUND",404);
      const doc=await supabase.from("sesm_education_documents").select("id,storage_path").eq("id",id).maybeSingle();if(doc.error||!doc.data)return bad(req,"DOCUMENT_NOT_FOUND",404);
      if(publish){const parts=doc.data.storage_path.split("/"),folder=parts.slice(0,-1).join("/"),name=parts.at(-1);const files=await supabase.storage.from(BUCKET).list(folder,{search:name,limit:100});if(files.error||!(files.data??[]).some((x:any)=>x.name===name))return bad(req,"DOCUMENT_FILE_NOT_FOUND",404);}
      const r=await supabase.from("sesm_education_documents").update({is_published:publish,published_at:publish?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id).select().single();
      if(r.error)throw new Error("DOCUMENT_PUBLISH_FAILED");await audit(user.id,publish?"education_document_published":"education_document_unpublished",null,{document_id:id});return send(req,{ok:true,document:r.data});
    }
    if(action==="document_delete"){
      const id=text(b.document_id,80),doc=await supabase.from("sesm_education_documents").select("id,storage_path").eq("id",id).maybeSingle();
      if(doc.error||!doc.data)return bad(req,"DOCUMENT_NOT_FOUND",404);
      const removed=await supabase.storage.from(BUCKET).remove([doc.data.storage_path]);if(removed.error)throw new Error("DOCUMENT_STORAGE_DELETE_FAILED");
      const r=await supabase.from("sesm_education_documents").delete().eq("id",id);if(r.error)throw new Error("DOCUMENT_DELETE_FAILED");
      await audit(user.id,"education_document_deleted",null,{document_id:id});return send(req,{ok:true});
    }
    if(action==="document_analytics"){
      const id=text(b.document_id,80);let q=supabase.from("sesm_document_events").select("document_id,user_id,event_type,created_at,platform").order("created_at",{ascending:false}).limit(10000);
      if(id)q=q.eq("document_id",id);const r=await q;if(r.error)throw r.error;
      const stats=new Map<string,{views:number,downloads:number,users:Set<string>,last:string|null}>();
      for(const x of r.data??[]){const v=stats.get(x.document_id)??{views:0,downloads:0,users:new Set<string>(),last:null};if(x.event_type==="view")v.views++;else v.downloads++;if(x.user_id)v.users.add(x.user_id);if(!v.last||x.created_at>v.last)v.last=x.created_at;stats.set(x.document_id,v);}
      return send(req,{ok:true,summary:[...stats.entries()].map(([document_id,v])=>({document_id,views:v.views,downloads:v.downloads,unique_users:v.users.size,last_event:v.last}))});
    }
    if(action==="document_signed_url"){
      const id=text(b.document_id,80),doc=await supabase.from("sesm_education_documents").select("id,storage_path").eq("id",id).maybeSingle();
      if(doc.error||!doc.data)return bad(req,"DOCUMENT_NOT_FOUND",404);const r=await supabase.storage.from(BUCKET).createSignedUrl(doc.data.storage_path,600);
      if(r.error||!r.data?.signedUrl)throw new Error("DOCUMENT_URL_FAILED");return send(req,{ok:true,url:r.data.signedUrl,expires_in:600});
    }
    if(action==="published_documents"){
      await student(user.id);const r=await supabase.from("sesm_education_documents").select("id,title,description,category,file_name,file_size,version,published_at").eq("is_published",true).order("category").order("title");
      if(r.error)throw r.error;return send(req,{ok:true,documents:r.data??[]});
    }
    if(action==="document_open"){
      await student(user.id);const id=text(b.document_id,80),event=b.event_type==="download"?"download":"view",platform=["windows","android","web"].includes(String(b.platform))?String(b.platform):"unknown";
      const doc=await supabase.from("sesm_education_documents").select("id,storage_path").eq("id",id).eq("is_published",true).maybeSingle();
      if(doc.error||!doc.data)return bad(req,"DOCUMENT_NOT_AVAILABLE",404);
      const log=await supabase.from("sesm_document_events").insert({document_id:id,user_id:user.id,event_type:event,platform});if(log.error)throw new Error("DOCUMENT_EVENT_FAILED");
      const signed=await supabase.storage.from(BUCKET).createSignedUrl(doc.data.storage_path,600);
      if(signed.error||!signed.data?.signedUrl)throw new Error("DOCUMENT_URL_FAILED");return send(req,{ok:true,url:signed.data.signedUrl,expires_in:600});
    }
    return bad(req,"UNKNOWN_ACTION",400);
  }catch(e){
    const code=e instanceof Error?e.message:"INTERNAL_ERROR";
    const status=code==="UNAUTHENTICATED"?401:code==="FORBIDDEN_OWNER_ONLY"?403:(code.includes("NOT_FOUND")||code.includes("NOT_AVAILABLE")?404:(code.includes("REQUIRED")||code.includes("LICENSE")?403:500));
    const safe=new Set(["UNAUTHENTICATED","FORBIDDEN_OWNER_ONLY","STUDENT_ACCESS_REQUIRED","STUDENT_LICENSE_REQUIRED","STUDENT_LIST_FAILED","STUDENT_CREATE_FAILED","STUDENT_PROFILE_CREATE_FAILED","STUDENT_PASSWORD_RESET_FAILED","STUDENT_DELETE_FAILED","EXAM_CREATE_FAILED","EXAM_DELETE_FAILED","EXAM_PUBLISH_FAILED","QUESTION_CREATE_FAILED","QUESTION_DELETE_FAILED","EXAM_BEGIN_FAILED","EXAM_SUBMIT_FAILED","DOCUMENT_REGISTER_FAILED","DOCUMENT_PUBLISH_FAILED","DOCUMENT_STORAGE_DELETE_FAILED","DOCUMENT_DELETE_FAILED","DOCUMENT_URL_FAILED","DOCUMENT_EVENT_FAILED","STUDENT_NOT_FOUND"]);
    return bad(req,safe.has(code)?code:"INTERNAL_ERROR",status);
  }
});
