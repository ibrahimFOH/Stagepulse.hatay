/** Stagepulse Admin Jarvis Pro — token-free local operations agent. */
(function (global) {
  'use strict';
  const NOTES_KEY = 'sp_admin_jarvis_notes_v2';
  const JOBS_KEY = 'sp_admin_jarvis_jobs_v1';
  const HIST_KEY = 'sp_admin_jarvis_hist_v2';
  function kb(){ return global.SP_ADMIN_KB || {}; }
  function read(key, fallback){ try { const v=JSON.parse(localStorage.getItem(key)||'null'); return v==null?fallback:v; } catch(_){ return fallback; } }
  function write(key,value){ try { localStorage.setItem(key,JSON.stringify(value)); } catch(_){} }
  function loadNotes(){ return read(NOTES_KEY,[]); }
  function saveNote(text){ const list=loadNotes(); list.unshift({t:Date.now(),text:String(text).slice(0,500)}); write(NOTES_KEY,list.slice(0,100)); }
  function loadJobs(){ return read(JOBS_KEY,[]); }
  function saveJob(job){ const list=loadJobs(); const item={id:'job-'+Date.now(),created_at:new Date().toISOString(),status:'taslak',...job}; list.unshift(item); write(JOBS_KEY,list.slice(0,100)); return item; }
  function parseSlots(text){
    const low=String(text||'').toLocaleLowerCase('tr-TR'), out={};
    const types=[[/düğün/,'düğün'],[/kına/,'kına'],[/nişan/,'nişan'],[/konser/,'konser'],[/festival/,'festival'],[/kurumsal|lansman|toplantı/,'kurumsal'],[/fuar|kongre/,'kurumsal'],[/tiyatro/,'tiyatro'],[/otel/,'otel'],[/\bdj\b/,'DJ']];
    for(const [re,v] of types){if(re.test(low)){out.tur=v;break;}}
    const cities=[[/hatay|antakya|defne|iskenderun/,'Hatay'],[/adana/,'Adana'],[/gaziantep|antep/,'Gaziantep'],[/mersin/,'Mersin'],[/şanlıurfa|sanliurfa|urfa/,'Şanlıurfa'],[/antalya/,'Antalya']];
    for(const [re,v] of cities){if(re.test(low)){out.sehir=v;break;}}
    const d1=low.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/), d2=low.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
    if(d1)out.tarih=d1[1].padStart(2,'0')+'.'+d1[2].padStart(2,'0')+'.'+d1[3]; else if(d2)out.tarih=d2[3].padStart(2,'0')+'.'+d2[2].padStart(2,'0')+'.'+d2[1];
    const p=low.match(/(\d{2,5})\s*(kişi|kişilik|misafir|seyirci|kapasite)/)||low.match(/(kişi|kişilik|misafir|seyirci)\s*[:=]?\s*(\d{2,5})/);
    if(p){const n=parseInt(/\d/.test(p[1])?p[1]:p[2],10);if(n>=10&&n<=100000)out.kisi=String(n);}
    const time=low.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);if(time)out.saat=time[1].padStart(2,'0')+':'+time[2];
    if(/açık\s*alan|outdoor|dışarı/.test(low))out.alan='açık alan'; if(/kapalı|salon|indoor|iç\s*mekan/.test(low))out.alan='kapalı';
    const svc=[]; if(/ses|array|pa\b|hoparlör|sub/.test(low))svc.push('ses'); if(/foh|miks|tonmaister|tonmeister/.test(low))svc.push('FOH'); if(/ışık|light|moving|wash|beam|led/.test(low))svc.push('ışık'); if(/stage\s*plot|rider|spl/.test(low))svc.push('Stage Plot/SPL'); if(svc.length)out.hizmetler=[...new Set(svc)].join('+');
    return out;
  }
  function pickPack(s){const p=kb().pack_templates||{},k=parseInt(s.kisi||'0',10);if(s.tur==='festival')return p.festival||p.konser;if(s.tur==='konser')return p.konser;if(s.tur==='kurumsal'||s.tur==='otel')return p.kurumsal;if(k&&k<=250)return p.dugun_kucuk;if(k&&k<=500)return p.dugun_orta;if(s.tur==='düğün'||s.tur==='kına')return p.dugun_orta;return p.dugun_kucuk;}
  function fill(t,m){return String(t||'').replace(/\{(\w+)\}/g,(_,k)=>m[k]!=null&&m[k]!==''?m[k]:'…');}
  function waLink(text){return 'https://wa.me/905320683012?text='+encodeURIComponent(text);}
  function actionCopy(actions,label,payload){actions.push({type:'copy',label,payload});}
  function run(raw){
    const K=kb(), text=String(raw||'').trim(), low=text.toLocaleLowerCase('tr-TR'), slots=parseSlots(text), actions=[];
    if(!text||/^(yardım|help|komut|beceri)/.test(low))return{text:'**Admin Jarvis Pro** hazır.\n\nKomutlar:\n'+(K.skills||[]).map(s=>'• '+s.label+' → `'+s.sample+'`').join('\n')+'\n\nEk: `işler`, `fiyat notları`, `canlı özet`.',actions};
    if(/^not\s*:|^not\s+/.test(low)){const body=text.replace(/^not\s*:?\s*/i,'').trim();if(body)saveNote(body);return{text:body?'Not kaydedildi (bu cihazda):\n• '+body:'Kullanım: not: jeneratör müşteriden',actions};}
    if(/notlar(ım)?$|kayıtlı not/.test(low)){const n=loadNotes();return{text:n.length?'Son notlar:\n'+n.slice(0,10).map(x=>'• '+x.text).join('\n'):'Kayıtlı not yok.',actions};}
    if(/^işler$|iş listesi|job(s)?$/.test(low)){const jobs=loadJobs();return{text:jobs.length?'Yerel iş kayıtları:\n'+jobs.slice(0,15).map((j,i)=>(i+1)+'. '+(j.tur||'İş')+' · '+(j.tarih||'—')+' · '+(j.sehir||'—')+' · '+(j.status||'taslak')).join('\n'):'Yerel iş kaydı yok.',actions};}
    if(/canlı\s*(özet|veri)|live\s*(summary|data)/.test(low))return{text:'LIVE_SUMMARY_REQUEST',actions:[{type:'live-summary',label:'Canlı özeti getir'}]};
    if(/fiyat not|pricing|fiyatlandırma/.test(low))return{text:'**Fiyat notları**\n'+(K.pricing_notes||[]).map(x=>'• '+x).join('\n'),actions};
    if(/bölge|region/.test(low))return{text:'Onaylı bölgeler: '+(K.regions||[]).join(', ')+'\nSite: '+K.site+'/bolgeler.html',actions:[{type:'link',label:'Bölgeler',href:K.site+'/bolgeler.html'}]};
    if(/etkinlik checklist|checklist etkinlik|iş listesi/.test(low))return{text:'**Etkinlik checklist**\n'+(K.event_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    if(/foh checklist|checklist foh/.test(low))return{text:'**FOH checklist**\n'+(K.foh_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    if(/ışık checklist|checklist ışık/.test(low))return{text:'**Işık checklist**\n'+(K.light_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    if(/süreç|sop|yeni teklif süreci|show günü|saha acil/.test(low)){const key=/saha\s*acil/.test(low)?'saha_acil':/show/.test(low)?'show_gunu':'yeni_teklif',steps=(K.sop&&K.sop[key])||[];return{text:'**Süreç: '+key+'**\n'+steps.join('\n'),actions};}
    if(/paket/.test(low)){let pack=pickPack(slots);if(/festival/.test(low))pack=K.pack_templates.festival||pack;if(/konser/.test(low))pack=K.pack_templates.konser;if(/kurumsal/.test(low))pack=K.pack_templates.kurumsal;if(/küçük|kucuk/.test(low))pack=K.pack_templates.dugun_kucuk;if(!pack)pack=K.pack_templates.dugun_orta;return{text:'**'+pack.title+'**\n'+pack.items.map(x=>'• '+x).join('\n')+'\n\nKeşif/rider sonrası netleşir. Fiyat üretilmez.',actions};}
    if(/^wa\b|whatsapp|mesaj|taslak|takip|teyit|kurulum mesaj/.test(low)){let key='teklif_talep';if(/teyit/.test(low))key='teyit';if(/kurulum/.test(low))key='kurulum';if(/takip/.test(low))key='takip';if(/red|ret|uygun değil/.test(low))key='red_nazik';const tpl=(K.message_templates&&K.message_templates[key])||K.message_templates.teklif_talep;const msg=fill(tpl,{ad:'…',telefon:K.phone,tarih:slots.tarih||'…',sehir:slots.sehir||'…',tur:slots.tur||'…',hizmetler:slots.hizmetler||'…',kisi:slots.kisi||'…',mekan:'…',saat:slots.saat||'…',elektrik:'…',foh:'…'});actionCopy(actions,'Kopyala',msg);actions.push({type:'wa',label:'WhatsApp',href:waLink(msg)});return{text:'**WA · '+key+'**\n\n'+msg,actions};}
    if(/brifing|brief|saha/.test(low)&&!/acil/.test(low)){const body=['**Saha brifingi**','Tarih: '+(slots.tarih||'—'),'Saat: '+(slots.saat||'—'),'Şehir: '+(slots.sehir||'—'),'Tür: '+(slots.tur||'—'),'Kişi: '+(slots.kisi||'—'),'Alan: '+(slots.alan||'—'),'Hizmet: '+(slots.hizmetler||'—'),'','☐ '+(K.event_checklist||[]).slice(0,8).join('\n☐ ')].join('\n');actionCopy(actions,'Kopyala',body);actions.push({type:'wa',label:'WhatsApp',href:waLink(body)});return{text:body,actions};}
    if(/gün planı|gun plani|day plan/.test(low)){const body=['**Gün planı**','Tarih: '+(slots.tarih||'—'),'Şehir: '+(slots.sehir||'—'),'Tür: '+(slots.tur||'—'),'','09:00  Load-in / güç','11:00  Patch / line check','14:00  Soundcheck',(slots.saat?slots.saat:'18:00')+'  Show call','Show sonrası  Söküm + sayım','','FOH: '+(K.foh_checklist||[]).slice(0,4).map(x=>'☐ '+x).join(' | ')].join('\n');actionCopy(actions,'Kopyala',body);return{text:body,actions};}
    if(/teklif|özet|quote/.test(low)||Object.keys(slots).length>=2){const pack=pickPack(slots),missing=[];if(!slots.tur)missing.push('tür');if(!slots.tarih)missing.push('tarih');if(!slots.sehir)missing.push('şehir');if(!slots.kisi)missing.push('kişi');if(Object.keys(slots).length>=2)saveJob({tur:slots.tur,tarih:slots.tarih,sehir:slots.sehir,kisi:slots.kisi,hizmetler:slots.hizmetler,alan:slots.alan});const lines=['**Teklif / kapsam taslağı**','Tür: '+(slots.tur||'—'),'Tarih: '+(slots.tarih||'—'),'Şehir: '+(slots.sehir||'—'),'Kişi: '+(slots.kisi||'—'),'Alan: '+(slots.alan||'—'),'Hizmet: '+(slots.hizmetler||'—'),'','Şablon: '+(pack?pack.title:'—')];if(pack)lines.push(...pack.items.map(x=>'• '+x));lines.push('','Eksik: '+(missing.length?missing.join(', '):'temel alanlar dolu'),'Sonraki: WA teyit · rider · panel kaydı','Fiyat üretilmez.');const body=lines.join('\n');actionCopy(actions,'Kopyala',body);actions.push({type:'wa',label:'Teyit WA',href:waLink(fill(K.message_templates.teyit,{ad:'…',tarih:slots.tarih||'…',sehir:slots.sehir||'…',tur:slots.tur||'…',hizmetler:slots.hizmetler||'…',kisi:slots.kisi||'…',telefon:K.phone}))},{type:'link',label:'Teklif formu',href:K.site+'/teklif.html'});return{text:body,actions};}
    return{text:'Netleştirmek için `yardım` veya örnek:\n`teklif: Hatay düğün 400 kişi 20.09.2026 ses+FOH açık alan`',actions};
  }
  global.SPAdminAgent={run,loadNotes,saveNote,loadJobs,parseSlots,HIST_KEY};
})(window);
