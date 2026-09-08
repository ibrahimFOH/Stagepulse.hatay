/** Stagepulse Admin Jarvis Pro — local helpers; canonical live agent is patron-ai. */
(function (global) {
  'use strict';
  const NOTES_KEY='sp_admin_jarvis_notes_v2',JOBS_KEY='sp_admin_jarvis_jobs_v1',HIST_KEY='sp_admin_jarvis_hist_v2';
  const kb=()=>global.SP_ADMIN_KB||{};
  const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch(_){return f}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
  const loadNotes=()=>read(NOTES_KEY,[]);
  const saveNote=text=>{const a=loadNotes();a.unshift({t:Date.now(),text:String(text).slice(0,500)});write(NOTES_KEY,a.slice(0,100));};
  const loadJobs=()=>read(JOBS_KEY,[]);
  const saveJob=job=>{const a=loadJobs(),item={id:'job-'+Date.now(),created_at:new Date().toISOString(),status:'taslak',...job};a.unshift(item);write(JOBS_KEY,a.slice(0,100));return item};
  function run(raw){
    const text=String(raw||'').trim(),low=text.toLocaleLowerCase('tr-TR'),K=kb(),actions=[];
    if(!text||/^(yardım|help|komut|beceri)$/.test(low))return{text:'**Admin Jarvis Pro** hazır.\n\nCanlı doğal dil ve şirket verisi için canonical Patron JARVIS kullanılır.\nYerel yardımcılar: not, notlar, işler, checklist, paket, WA taslakları.',actions};
    if(/^not\s*:|^not\s+/.test(low)){const body=text.replace(/^not\s*:?\s*/i,'').trim();if(body)saveNote(body);return{text:body?'Not kaydedildi (bu cihazda):\n• '+body:'Kullanım: not: jeneratör müşteriden',actions};}
    if(/notlar(ım)?$|kayıtlı not/.test(low)){const n=loadNotes();return{text:n.length?'Son notlar:\n'+n.slice(0,10).map(x=>'• '+x.text).join('\n'):'Kayıtlı not yok.',actions};}
    if(/^işler$|iş listesi|^jobs?$/.test(low)){const j=loadJobs();return{text:j.length?'Yerel iş kayıtları:\n'+j.slice(0,15).map((x,i)=>(i+1)+'. '+(x.tur||'İş')+' · '+(x.tarih||'—')+' · '+(x.sehir||'—')+' · '+(x.status||'taslak')).join('\n'):'Yerel iş kaydı yok.',actions};}
    if(/canlı\s*(özet|veri)|live\s*(summary|data)/.test(low))return{text:'LIVE_SUMMARY_REQUEST',actions:[]};
    if(/fiyat not|pricing|fiyatlandırma/.test(low))return{text:'**Fiyat notları**\n'+(K.pricing_notes||[]).map(x=>'• '+x).join('\n'),actions};
    if(/bölge|region/.test(low))return{text:'Onaylı bölgeler: '+(K.regions||[]).join(', '),actions};
    if(/etkinlik checklist|checklist etkinlik/.test(low))return{text:'**Etkinlik checklist**\n'+(K.event_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    if(/foh checklist|checklist foh/.test(low))return{text:'**FOH checklist**\n'+(K.foh_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    if(/ışık checklist|checklist ışık/.test(low))return{text:'**Işık checklist**\n'+(K.light_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    return{text:'Bu istek canonical Patron JARVIS tarafından işlenecek.',actions};
  }
  global.SPAdminAgent={run,loadNotes,saveNote,loadJobs,HIST_KEY,saveJob};
})(window);
