(()=>{'use strict';
const SUPABASE_URL='https://itasctyjzyewcykozuex.supabase.co';
const KEY='sb_publishable_tP3CMhVAjv6FNtrkYfVEOA_dbF9m8Jb';
const API=SUPABASE_URL+'/functions/v1/license-core';
const $=id=>document.getElementById(id);
let token='',expiresAt=0,rows=[],busy=false,userId='',studentLicenses=[],students=[],exams=[],documents=[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(id,value,kind=''){const el=$(id);if(!el)return;el.textContent=value||'';el.className=kind;}
function logged(on){$('login').classList.toggle('hidden',on);$('app').classList.toggle('hidden',!on);$('logout').classList.toggle('hidden',!on);$('conn').textContent=on?'Ortak hesap bağlı':'Oturum kapalı';}
function clearSession(){token='';expiresAt=0;userId='';logged(false);}
async function authLogin(email,password){
 const response=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({email:email.trim(),password})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.access_token)throw Error(data.msg||data.message||'E-posta veya şifre doğrulanamadı.');
 token=data.access_token;userId=data.user?.id||'';expiresAt=Date.now()+Number(data.expires_in||3600)*1000;
}
async function call(action,data={}){
 if(!token||Date.now()>=expiresAt){clearSession();throw Error('Oturum sona erdi. Yeniden giriş yap.');}
 const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+token},body:JSON.stringify({action,...data})});
 const result=await response.json().catch(()=>({error:'Sunucudan geçersiz yanıt alındı.'}));
 if(response.status===401){clearSession();throw Error(result.error||'Oturum sona erdi.');}
 if(!response.ok||result.ok===false)throw Error(result.error||('HTTP '+response.status));
 return result;
}
function status(l){
 if(l.status!=='active')return 'İptal edildi';
 if(l.payment_status!=='paid')return 'Ödeme bekliyor';
 if(l.expires_at&&Date.parse(l.expires_at)<=Date.now())return 'Süresi doldu';
 return 'Aktif';
}
function isActive(l){return status(l)==='Aktif';}
function date(v){if(!v)return 'Süresiz';const d=new Date(v);return Number.isNaN(d.getTime())?'Bilinmiyor':new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium'}).format(d);}
function product(v){return ({stagepulse:'Stagepulse','ses-merkezi':'Ses Merkezi',jarvis:'JARVIS'})[v]||v;}
function filtered(){const q=$('search').value.toLocaleLowerCase('tr-TR'),f=$('filter').value;return rows.filter(l=>(f==='all'||(f==='active'?isActive(l):!isActive(l)))&&[l.customer_name,l.product_code,l.status,l.payment_status,l.id].join(' ').toLocaleLowerCase('tr-TR').includes(q));}
function render(){
 const active=rows.filter(isActive).length;
 $('total').textContent=rows.length;$('active').textContent=active;$('revoked').textContent=rows.length-active;
 const list=filtered();
 $('licenses').innerHTML=list.length?list.map(l=>{
  const on=isActive(l);
  return '<article class="license"><div class="heading"><h3>'+esc(l.customer_name)+'</h3><span class="badge '+(on?'':'off')+'">'+esc(status(l))+'</span></div><small>'+esc(product(l.product_code))+' · '+esc(l.plan_code||'standart')+'</small><div class="meta"><div><small>Bitiş</small><b>'+esc(date(l.expires_at))+'</b></div><div><small>Cihaz</small><b>'+Number(l.active_devices||0)+' / '+Number(l.max_devices||1)+'</b></div><div><small>Ödeme</small><b>'+esc(l.payment_status||'—')+'</b></div><div><small>Oluşturma</small><b>'+esc(date(l.created_at))+'</b></div></div>'+(on?'<button class="secondary" data-revoke="'+esc(l.id)+'">Lisansı iptal et</button>':'')+'</article>';
 }).join(''):'<div class="panel">Bu filtrede lisans bulunamadı.</div>';
}
async function refresh(){
 if(busy)return;busy=true;
 try{const r=await call('admin_list');rows=r.licenses||[];render();$('conn').textContent='Ortak hesap bağlı';message('msg','');await refreshEducation();}
 catch(e){message('msg',e.message,'error');$('conn').textContent='Bağlantı hatası';}
 finally{busy=false;}
}
$('loginForm').onsubmit=async e=>{
 e.preventDefault();$('loginBtn').disabled=true;message('loginMsg','Supabase hesabı doğrulanıyor…');
 try{await authLogin($('email').value,$('password').value);$('password').value='';logged(true);await refresh();}
 catch(err){clearSession();message('loginMsg',err.message,'error');}
 finally{$('loginBtn').disabled=false;}
};
$('logout').onclick=clearSession;
$('refresh').onclick=refresh;
$('search').oninput=render;
$('filter').onchange=render;
$('createForm').onsubmit=async e=>{
 e.preventDefault();$('createBtn').disabled=true;$('keyResult').classList.add('hidden');
 try{
  let expiry=null;
  if($('expiry').value){const d=new Date($('expiry').value+'T23:59:59');if(d.getTime()<=Date.now())throw Error('Bitiş tarihi gelecekte olmalı.');expiry=d.toISOString();}
  const r=await call('admin_create',{app_id:$('product').value,customer_name:$('customer').value.trim(),max_devices:Number($('devices').value),expires_at:expiry,payment_status:$('payment').value,notes:$('notes').value.trim()});
  $('keyValue').textContent=r.license_key;$('keyResult').classList.remove('hidden');$('createForm').reset();
  message('msg','Lisans oluşturuldu. Anahtarı şimdi güvenli yere kopyala.','success');await refresh();
 }catch(err){message('msg',err.message,'error');}
 finally{$('createBtn').disabled=false;}
};
$('copyKey').onclick=async()=>{try{await navigator.clipboard.writeText($('keyValue').textContent);$('copyKey').textContent='Kopyalandı ✓';}catch{message('msg','Anahtarı seçip elle kopyala.','error');}};
$('hideKey').onclick=()=>{$('keyValue').textContent='';$('keyResult').classList.add('hidden');};
$('licenses').onclick=async e=>{
 const btn=e.target.closest('[data-revoke]');if(!btn)return;
 const license=rows.find(x=>x.id===btn.dataset.revoke);if(!license||!confirm(license.customer_name+' lisansı iptal edilsin mi?'))return;
 btn.disabled=true;
 try{await call('admin_revoke',{license_id:license.id});message('msg','Lisans iptal edildi.','success');await refresh();}
 catch(err){message('msg',err.message,'error');}
 finally{btn.disabled=false;}
};
const csv=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
$('export').onclick=()=>{
 const fields=['customer_name','product_code','status','payment_status','max_devices','active_devices','expires_at','created_at','id'];
 const data=[fields.join(';'),...filtered().map(l=>fields.map(f=>csv(l[f])).join(';'))];
 const blob=new Blob(['\ufeff'+data.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='stagepulse-ortak-lisanslar.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

async function educationCall(action,data={}){
 if(!token||Date.now()>=expiresAt){clearSession();throw Error('Oturum sona erdi. Yeniden giriş yap.');}
 const response=await fetch(SUPABASE_URL+'/functions/v1/sesm-education-admin',{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+token},body:JSON.stringify({action,...data})});
 const result=await response.json().catch(()=>({error:'Sunucudan geçersiz yanıt alındı.'}));
 if(response.status===401){clearSession();throw Error(result.error||'Oturum sona erdi.');}
 if(!response.ok||result.ok!==true)throw Error(result.error||('HTTP '+response.status));
 return result;
}
function renderStudentLicenses(){
 const select=$('studentLicense');if(!select)return;
 select.innerHTML='<option value="">Ödenmiş aktif lisans seç</option>'+studentLicenses.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.customer_name||x.label||'Lisans')+' · '+esc(x.customer_email||'')+' · '+esc(date(x.expires_at))+'</option>').join('');
 if(!studentLicenses.length)select.innerHTML='<option value="">Önce ödenmiş aktif Ses Merkezi lisansı oluştur</option>';
}
function renderStudents(){
 const node=$('studentList');if(!node)return;
 node.innerHTML=students.length?students.map(s=>'<article class="education-card"><div class="heading"><h3>'+esc(s.display_name||'Öğrenci')+'</h3><span class="status-live">'+(s.is_active?'Aktif':'Pasif')+'</span></div><small>'+esc(s.email)+'</small><div class="education-meta"><span>İlerleme: '+Number(s.progress?.done||0)+' / '+Number(s.progress?.total||0)+'</span><span>Oluşturma: '+esc(date(s.created_at))+'</span></div><div class="education-actions"><button class="secondary" data-student="password" data-id="'+esc(s.user_id)+'">Parola yenile</button><button class="secondary" data-student="delete" data-id="'+esc(s.user_id)+'">Hesabı sil</button></div></article>').join(''):'<div class="license">Henüz öğrenci hesabı yok.</div>';
}
function renderExams(){
 const node=$('examList'),select=$('questionExam');if(!node||!select)return;
 select.innerHTML='<option value="">Sınav seç</option>'+exams.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('');
 node.innerHTML=exams.length?exams.map(x=>'<article class="education-card"><div class="heading"><h3>'+esc(x.title)+'</h3><span class="'+(x.is_published?'status-live':'status-draft')+'">'+(x.is_published?'Yayında':'Taslak')+'</span></div><small>'+esc(x.description||'Açıklama yok')+'</small><div class="education-meta"><span>Geçme: '+Number(x.pass_percent)+'%</span><span>Deneme: '+Number(x.attempts_allowed)+'</span><span>Süre: '+(x.duration_minutes?Number(x.duration_minutes)+' dk':'Sınırsız')+'</span></div><div class="education-actions"><button class="secondary" data-exam="edit" data-id="'+esc(x.id)+'">Düzenle</button><button class="secondary" data-exam="questions" data-id="'+esc(x.id)+'">Sorular</button><button class="secondary" data-exam="attempts" data-id="'+esc(x.id)+'">Sonuçlar</button><button data-exam="publish" data-published="'+(!x.is_published)+'" data-id="'+esc(x.id)+'">'+(x.is_published?'Yayından kaldır':'Yayınla')+'</button><button class="secondary" data-exam="delete" data-id="'+esc(x.id)+'">Sil</button></div></article>').join(''):'<div class="license">Henüz sınav oluşturulmadı.</div>';
}
function renderQuestions(list){
 const node=$('questionList');if(!node)return;
 node.innerHTML=list.length?list.map((q,i)=>'<article class="education-card"><b>'+(i+1)+'. '+esc(q.question_text)+'</b><small>'+esc(q.question_type)+' · '+Number(q.points)+' puan · Cevap: '+esc(Array.isArray(q.correct_answer)?q.correct_answer.join(', '):String(q.correct_answer))+'</small><button class="secondary" data-question-edit="'+esc(q.id)+'" data-exam-id="'+esc(q.exam_id)+'">Düzenle</button><button class="secondary" data-question-delete="'+esc(q.id)+'" data-exam-id="'+esc(q.exam_id)+'">Soruyu sil</button></article>').join(''):'<div class="license">Bu sınavda soru yok.</div>';
}
function renderAttempts(list){
 const node=$('examAttemptsList');if(!node)return;
 node.innerHTML=list.length?list.map(a=>'<div class="result-row"><span><b>'+esc(a.student?.display_name||a.student?.email||'Öğrenci')+'</b><br>'+Number(a.correct_count||0)+' / '+Number(a.question_count||0)+' doğru · '+(a.passed?'Başarılı':'Başarısız')+' · '+esc(a.status)+'</span><b>'+Number(a.percent||0).toFixed(1)+'%</b></div>').join(''):'Henüz sınav sonucu yok.';
}
function renderDocuments(){
 const node=$('documentList');if(!node)return;
 node.innerHTML=documents.length?documents.map(d=>'<article class="education-card"><div class="heading"><h3>'+esc(d.title)+'</h3><span class="'+(d.is_published?'status-live':'status-draft')+'">'+(d.is_published?'Yayında':'Taslak')+'</span></div><small>'+esc(d.description||d.file_name)+'</small><div class="education-meta"><span>'+esc(d.category)+'</span><span>'+(Number(d.file_size)/1048576).toFixed(2)+' MB</span><span>Sürüm '+Number(d.version||1)+'</span></div><div class="education-actions"><button class="secondary" data-document="edit" data-id="'+esc(d.id)+'">Bilgileri düzenle</button><button class="secondary" data-document="replace" data-id="'+esc(d.id)+'">Yeni sürüm</button><button class="secondary" data-document="preview" data-id="'+esc(d.id)+'">Önizle</button><button data-document="publish" data-published="'+(!d.is_published)+'" data-id="'+esc(d.id)+'">'+(d.is_published?'Yayından kaldır':'Yayınla')+'</button><button class="secondary" data-document="analytics" data-id="'+esc(d.id)+'">Analiz</button><button class="secondary" data-document="delete" data-id="'+esc(d.id)+'">Sil</button></div></article>').join(''):'<div class="license">Henüz eğitim PDF dosyası yok.</div>';
}
async function refreshEducation(){
 try{
  const [l,s,e,d,a]=await Promise.all([educationCall('student_licenses_list'),educationCall('students_list'),educationCall('exams_list'),educationCall('documents_list'),educationCall('document_analytics')]);
  studentLicenses=l.licenses||[];students=s.students||[];exams=e.exams||[];documents=d.documents||[];
  renderStudentLicenses();renderStudents();renderExams();renderDocuments();
  const analytics=$('documentAnalytics'),summary=a.summary||[];
  if(analytics)analytics.innerHTML=summary.length?summary.map(x=>{const doc=documents.find(y=>y.id===x.document_id);return '<div class="result-row"><span><b>'+esc(doc?.title||'Eğitim PDF')+'</b><br>'+Number(x.views)+' görüntüleme · '+Number(x.downloads)+' indirme · '+Number(x.unique_users)+' tekil öğrenci</span><small>'+esc(date(x.last_event))+'</small></div>';}).join(''):'Henüz PDF kullanım kaydı yok. Öğrenci uygulaması belgeyi document_open API üzerinden açtığında analiz oluşur.';
 }catch(e){message('msg','Eğitim yönetimi yüklenemedi: '+e.message,'error');}
}
$('studentForm').onsubmit=async e=>{
 e.preventDefault();$('studentCreate').disabled=true;
 try{await educationCall('student_create',{display_name:$('studentName').value.trim(),email:$('studentEmail').value.trim(),password:$('studentPassword').value,license_id:$('studentLicense').value});$('studentForm').reset();message('msg','Öğrenci hesabı oluşturuldu. İlk parolayı güvenli şekilde öğrenciye ilet.','success');await refreshEducation();}
 catch(err){message('msg',err.message,'error');}finally{$('studentCreate').disabled=false;}
};
$('studentList').onclick=async e=>{
 const b=e.target.closest('button[data-student]');if(!b)return;const id=b.dataset.id;
 try{b.disabled=true;if(b.dataset.student==='password'){const p=prompt('Yeni parola (en az 10 karakter, harf ve rakam):');if(p===null)return;await educationCall('student_password_reset',{student_user_id:id,new_password:p});message('msg','Öğrenci parolası yenilendi.','success');}
 else{const s=students.find(x=>x.user_id===id);if(!confirm((s?.display_name||'Öğrenci')+' hesabı ve ilerleme kayıtları kalıcı olarak silinecek. Devam edilsin mi?'))return;await educationCall('student_delete',{student_user_id:id});await refreshEducation();message('msg','Öğrenci hesabı silindi.','success');}}
 catch(err){message('msg',err.message,'error');}finally{b.disabled=false;}
};
$('examForm').onsubmit=async e=>{
 e.preventDefault();try{await educationCall('exam_save',{title:$('examTitle').value.trim(),description:$('examDescription').value.trim(),module_id:$('examModule').value.trim(),duration_minutes:$('examDuration').value?Number($('examDuration').value):null,pass_percent:Number($('examPass').value),attempts_allowed:Number($('examAttempts').value)});$('examForm').reset();$('examPass').value='70';$('examAttempts').value='1';await refreshEducation();message('msg','Sınav taslağı oluşturuldu. Soruları ekleyip yayınla.','success');}
 catch(err){message('msg',err.message,'error');}
};
$('examList').onclick=async e=>{
 const b=e.target.closest('button[data-exam]');if(!b)return;const id=b.dataset.id,x=exams.find(v=>v.id===id);if(!x)return;
 try{b.disabled=true;const action=b.dataset.exam;
 if(action==='edit'){
  const title=prompt('Sınav adı:',x.title);if(title===null)return;
  const description=prompt('Açıklama:',x.description||'');if(description===null)return;
  const moduleId=prompt('Modül kodu:',x.module_id||'');if(moduleId===null)return;
  const duration=prompt('Süre (dakika, boş = süresiz):',x.duration_minutes||'');if(duration===null)return;
  const pass=prompt('Geçme notu (%):',x.pass_percent);if(pass===null)return;
  const attempts=prompt('Deneme hakkı:',x.attempts_allowed);if(attempts===null)return;
  await educationCall('exam_save',{id,title,description,module_id:moduleId,duration_minutes:duration?Number(duration):null,pass_percent:Number(pass),attempts_allowed:Number(attempts)});
  await refreshEducation();message('msg','Sınav bilgileri güncellendi. Yeniden yayınlaman gerekir.','success');
 }
 else if(action==='questions'){$('questionExam').value=id;const r=await educationCall('questions_list',{exam_id:id});renderQuestions(r.questions||[]);}
 else if(action==='attempts'){const r=await educationCall('exam_attempts',{exam_id:id});renderAttempts(r.attempts||[]);}
 else if(action==='publish'){await educationCall('exam_publish',{exam_id:id,published:b.dataset.published==='true'});await refreshEducation();}
 else if(action==='delete'){if(!confirm('Sınav, soruları ve sonuçları silinsin mi?'))return;await educationCall('exam_delete',{exam_id:id});await refreshEducation();}}
 catch(err){message('msg',err.message,'error');}finally{b.disabled=false;}
};
$('questionExam').onchange=async()=>{if(!$('questionExam').value){renderQuestions([]);return;}try{const r=await educationCall('questions_list',{exam_id:$('questionExam').value});renderQuestions(r.questions||[]);}catch(err){message('msg',err.message,'error');}};
$('questionForm').onsubmit=async e=>{
 e.preventDefault();const type=$('questionType').value,raw=$('questionCorrect').value.trim();let answer=raw;
 if(type==='true_false'){if(!['true','false'].includes(raw.toLowerCase())){message('msg','Doğru/yanlış cevabı true veya false olmalı.','error');return;}answer=raw.toLowerCase()==='true';}
 if(type==='multiple_choice')answer=raw.split(',').map(x=>x.trim()).filter(Boolean);
 const options=['true_false','short_answer'].includes(type)?[]:$('questionOptions').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 try{await educationCall('question_save',{exam_id:$('questionExam').value,question_text:$('questionText').value.trim(),question_type:type,options,correct_answer:answer,points:Number($('questionPoints').value),position:$('questionList').children.length,explanation:$('questionExplanation').value.trim()});$('questionText').value='';$('questionOptions').value='';$('questionCorrect').value='';$('questionExplanation').value='';const r=await educationCall('questions_list',{exam_id:$('questionExam').value});renderQuestions(r.questions||[]);await refreshEducation();message('msg','Soru kaydedildi. Değişen sınavı yeniden yayınlamalısın.','success');}
 catch(err){message('msg',err.message,'error');}
};
$('questionList').onclick=async e=>{
 const edit=e.target.closest('button[data-question-edit]');
 const del=e.target.closest('button[data-question-delete]');
 if(edit){
  const id=edit.dataset.questionEdit,examId=edit.dataset.examId;
  try{const r=await educationCall('questions_list',{exam_id:examId}),q=(r.questions||[]).find(x=>x.id===id);if(!q)return;
   const question=prompt('Soru metni:',q.question_text);if(question===null)return;
   const correctText=prompt('Doğru cevap (çoklu cevap için virgülle ayır):',Array.isArray(q.correct_answer)?q.correct_answer.join(', '):String(q.correct_answer));if(correctText===null)return;
   const explanation=prompt('Açıklama:',q.explanation||'');if(explanation===null)return;
   const points=prompt('Puan:',q.points);if(points===null)return;
   let answer=correctText;if(q.question_type==='true_false'){if(!['true','false'].includes(correctText.toLowerCase()))throw Error('Doğru/yanlış cevabı true veya false olmalı.');answer=correctText.toLowerCase()==='true';}else if(q.question_type==='multiple_choice')answer=correctText.split(',').map(x=>x.trim()).filter(Boolean);
   await educationCall('question_save',{id,exam_id:examId,question_text:question,question_type:q.question_type,options:q.options||[],correct_answer:answer,explanation,points:Number(points),position:q.position||0});
   const fresh=await educationCall('questions_list',{exam_id:examId});renderQuestions(fresh.questions||[]);await refreshEducation();message('msg','Soru güncellendi. Sınavı yeniden yayınlamalısın.','success');
  }catch(err){message('msg',err.message,'error');}return;
 }
 if(!del)return;if(!confirm('Soru silinsin mi?'))return;
 try{await educationCall('question_delete',{question_id:del.dataset.questionDelete,exam_id:del.dataset.examId});const r=await educationCall('questions_list',{exam_id:del.dataset.examId});renderQuestions(r.questions||[]);await refreshEducation();}catch(err){message('msg',err.message,'error');}
};
async function uploadPdf(file,path){
 const url=SUPABASE_URL+'/storage/v1/object/sesm-education-pdfs/'+path.split('/').map(encodeURIComponent).join('/');
 const response=await fetch(url,{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+token,'Content-Type':'application/pdf','x-upsert':'false'},body:file});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(data.message||data.error||'PDF yüklenemedi.');
}
$('documentForm').onsubmit=async e=>{
 e.preventDefault();const file=$('documentFile').files[0];if(!file)return;
 if((file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))||file.size<1||file.size>52428800){message('msg','Yalnızca 50 MB altındaki PDF dosyaları kabul edilir.','error');return;}
 $('documentUpload').disabled=true;let path='';
 try{if(!userId)throw Error('Oturum kullanıcı bilgisi eksik. Yeniden giriş yap.');path=userId+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');await uploadPdf(file,path);
 await educationCall('document_register',{title:$('documentTitle').value.trim(),description:$('documentDescription').value.trim(),category:$('documentCategory').value.trim(),storage_path:path,file_name:file.name,file_size:file.size});
 $('documentForm').reset();$('documentCategory').value='genel';await refreshEducation();message('msg','PDF güvenli depoya yüklendi. Yayınlamak için belge kartındaki Yayınla düğmesini kullan.','success');}
 catch(err){message('msg',err.message,'error');}finally{$('documentUpload').disabled=false;}
};
$('documentList').onclick=async e=>{
 const b=e.target.closest('button[data-document]');if(!b)return;const id=b.dataset.id,d=documents.find(x=>x.id===id);if(!d)return;
 try{b.disabled=true;const action=b.dataset.document;
 if(action==='publish'){await educationCall('document_publish',{document_id:id,published:b.dataset.published==='true'});await refreshEducation();}
 else if(action==='preview'){const r=await educationCall('document_signed_url',{document_id:id});window.open(r.url,'_blank','noopener');}
 else if(action==='analytics'){const r=await educationCall('document_analytics',{document_id:id}),x=(r.summary||[])[0];message('msg',x?'PDF analizi: '+x.views+' görüntüleme, '+x.downloads+' indirme, '+x.unique_users+' tekil öğrenci.':'Bu PDF için henüz kullanım kaydı yok.','success');}
 else if(action==='edit'){const title=prompt('Belge başlığı:',d.title);if(title===null)return;const description=prompt('Açıklama:',d.description||'');if(description===null)return;const category=prompt('Kategori:',d.category||'genel');if(category===null)return;await educationCall('document_update',{document_id:id,title,description,category});await refreshEducation();message('msg','Belge bilgileri güncellendi. Yeniden yayınlaman gerekir.','success');}
 else if(action==='replace'){const picker=document.createElement('input');picker.type='file';picker.accept='application/pdf,.pdf';picker.onchange=async()=>{const file=picker.files[0];if(!file)return;if((file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))||file.size<1||file.size>52428800){message('msg','Yeni PDF 50 MB sınırını aşmamalı.','error');return;}let path='';try{path=userId+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');await uploadPdf(file,path);await educationCall('document_replace',{document_id:id,storage_path:path,file_name:file.name,file_size:file.size});await refreshEducation();message('msg','PDF yeni sürümle değiştirildi. Yeniden yayınlamalısın.','success');}catch(err){message('msg',err.message,'error');}};picker.click();}
 else if(action==='delete'){if(!confirm('PDF dosyası ve kaydı kalıcı olarak silinsin mi?'))return;await educationCall('document_delete',{document_id:id});await refreshEducation();}}
 catch(err){message('msg',err.message,'error');}finally{b.disabled=false;}
};

logged(false);
})();