/** Stagepulse Admin Jarvis — token-free rule agent. No secrets, no write actions. */
(function (global) {
  'use strict';
  const NOTES_KEY = 'sp_admin_jarvis_notes_v1';
  const HIST_KEY = 'sp_admin_jarvis_hist_v1';
  function kb(){ return global.SP_ADMIN_KB || {}; }
  function loadNotes(){ try{return JSON.parse(localStorage.getItem(NOTES_KEY)||'[]');}catch(_){return [];} }
  function saveNote(text){ const list=loadNotes(); list.unshift({t:Date.now(),text:String(text).slice(0,500)}); try{localStorage.setItem(NOTES_KEY,JSON.stringify(list.slice(0,50)));}catch(_){} }
  function parseSlots(text){
    const low=String(text||'').toLocaleLowerCase('tr-TR'), out={};
    const types=[[/düğün/,'düğün'],[/kına/,'kına'],[/nişan/,'nişan'],[/konser/,'konser'],[/festival/,'festival'],[/kurumsal|lansman/,'kurumsal'],[/fuar|kongre/,'kurumsal'],[/otel/,'otel']];
    for(const [re,v] of types){if(re.test(low)){out.tur=v;break;}}
    const cities=[[/hatay|antakya/,'Hatay'],[/adana/,'Adana'],[/gaziantep|antep/,'Gaziantep'],[/mersin/,'Mersin'],[/şanlıurfa|urfa/,'Şanlıurfa'],[/antalya/,'Antalya']];
    for(const [re,v] of cities){if(re.test(low)){out.sehir=v;break;}}
    const d1=low.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/), d2=low.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
    if(d1)out.tarih=d1[1].padStart(2,'0')+'.'+d1[2].padStart(2,'0')+'.'+d1[3]; else if(d2)out.tarih=d2[3].padStart(2,'0')+'.'+d2[2].padStart(2,'0')+'.'+d2[1];
    const p=low.match(/(\d{2,5})\s*(kişi|kişilik|misafir|seyirci)/); if(p)out.kisi=p[1];
    const svc=[]; if(/ses|array|pa\b/.test(low))svc.push('ses'); if(/foh|miks/.test(low))svc.push('FOH'); if(/ışık|light/.test(low))svc.push('ışık'); if(/stage\s*plot|rider|spl/.test(low))svc.push('Stage Plot/SPL'); if(svc.length)out.hizmetler=svc.join('+');
    return out;
  }
  function pickPack(s){const p=kb().pack_templates||{},k=parseInt(s.kisi||'0',10);if(s.tur==='konser'||s.tur==='festival')return p.konser;if(s.tur==='kurumsal'||s.tur==='otel')return p.kurumsal;if(k&&k<=250)return p.dugun_kucuk;if(k&&k<=500)return p.dugun_orta;if(s.tur==='düğün'||s.tur==='kına')return p.dugun_orta;return p.dugun_kucuk;}
  function fill(t,m){return String(t||'').replace(/\{(\w+)\}/g,(_,k)=>m[k]!=null&&m[k]!==''?m[k]:'…');}
  function wa(text){return 'https://wa.me/905320683012?text='+encodeURIComponent(text);}
  function run(raw){
    const K=kb(), text=String(raw||'').trim(), low=text.toLocaleLowerCase('tr-TR'), slots=parseSlots(text), actions=[];
    if(!text||/^(yardım|help|komut|beceri)/.test(low))return{text:'**Admin Jarvis** — yerel kural ajanı hazır.\n\nKomut örnekleri:\n'+(K.skills||[]).map(s=>'• '+s.label+' → `'+s.sample+'`').join('\n')+'\n\nCanlı panel verisi için `canlı özet` komutunu kullanabilirsiniz.',actions};
    if(/^not\s*:|^not\s+/.test(low)){const body=text.replace(/^not\s*:?\s*/i,'').trim();if(body)saveNote(body);return{text:body?'Not kaydedildi (bu cihazda):\n• '+body:'Kullanım: not: jeneratör müşteriden',actions};}
    if(/notlar(ım)?$|kayıtlı not/.test(low)){const n=loadNotes();return{text:n.length?'Son notlar:\n'+n.slice(0,10).map(x=>'• '+x.text).join('\n'):'Kayıtlı not yok.',actions};}
    if(/canlı\s*(özet|veri)|live\s*(summary|data)/.test(low))return{text:'LIVE_SUMMARY_REQUEST',actions:[{type:'live-summary',label:'Canlı özeti getir'}]};
    if(/bölge|region/.test(low))return{text:'Onaylı bölgeler: '+(K.regions||[]).join(', ')+'\nSite: '+K.site+'/bolgeler.html',actions:[{type:'link',label:'Bölgeler',href:K.site+'/bolgeler.html'}]};
    if(/etkinlik checklist|checklist etkinlik|iş listesi/.test(low))return{text:'**Etkinlik checklist**\n'+(K.event_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    if(/foh checklist|checklist foh/.test(low))return{text:'**FOH checklist**\n'+(K.foh_checklist||[]).map((x,i)=>(i+1)+'. '+x).join('\n'),actions};
    if(/süreç|sop|yeni teklif süreci|show günü/.test(low)){const key=/show/.test(low)?'show_gunu':'yeni_teklif',steps=(K.sop&&K.sop[key])||[];return{text:'**Süreç: '+key+'**\n'+steps.join('\n'),actions};}
    if(/paket/.test(low)){let pack=pickPack(slots);if(/konser|festival/.test(low))pack=K.pack_templates.konser;if(/kurumsal/.test(low))pack=K.pack_templates.kurumsal;if(/küçük|kucuk/.test(low))pack=K.pack_templates.dugun_kucuk;if(!pack)pack=K.pack_templates.dugun_orta;return{text:'**'+pack.title+'**\n'+pack.items.map(x=>'• '+x).join('\n')+'\n\nNot: Şablondur; keşif/rider sonrası netleşir. Fiyat üretilmez.',actions};}
    if(/whatsapp|wa mesaj|mesaj yaz|taslak/.test(low)){const key=/teyit/.test(low)?'teyit':/kurulum/.test(low)?'kurulum':'teklif_talep',tpl=(K.message_templates&&K.message_templates[key])||K.message_templates.teklif_talep,map={ad:'…',telefon:K.phone,tarih:slots.tarih||'…',sehir:slots.sehir||'…',tur:slots.tur||'…',hizmetler:slots.hizmetler||'…',kisi:slots.kisi||'…',mekan:'…',saat:'…',elektrik:'…',foh:'…'},msg=fill(tpl,map);actions.push({type:'copy',label:'Kopyala',payload:msg},{type:'wa',label:'WhatsApp aç',href:wa(msg)});return{text:'**WhatsApp taslağı ('+key+')**\n\n'+msg,actions};}
    if(/brifing|brief|saha/.test(low)){const body=['**Saha brifingi**','Tarih: '+(slots.tarih||'—'),'Şehir: '+(slots.sehir||'—'),'Tür: '+(slots.tur||'—'),'Kişi: '+(slots.kisi||'—'),'Hizmet: '+(slots.hizmetler||'—'),'','Kontrol:',...(K.event_checklist||[]).slice(0,6).map(x=>'☐ '+x)].join('\n');actions.push({type:'copy',label:'Kopyala',payload:body},{type:'wa',label:'WhatsApp',href:wa(body)});return{text:body,actions};}
    if(/teklif|özet|quote/.test(low)||Object.keys(slots).length>=2){const pack=pickPack(slots),missing=[];if(!slots.tur)missing.push('etkinlik türü');if(!slots.tarih)missing.push('tarih');if(!slots.sehir)missing.push('şehir');if(!slots.kisi)missing.push('kişi sayısı');const body=['**Teklif / kapsam özeti (taslak)**','Tür: '+(slots.tur||'—'),'Tarih: '+(slots.tarih||'—'),'Şehir: '+(slots.sehir||'—'),'Kişi: '+(slots.kisi||'—'),'Hizmet: '+(slots.hizmetler||'—'),'','Önerilen şablon: '+(pack?pack.title:'—'),...(pack?pack.items.map(x=>'• '+x):[]),'','Eksik alanlar: '+(missing.length?missing.join(', '):'yok (rider/mekan yine netleştir)'), 'Sonraki adım: müşteri teyidi veya panel kaydı.', 'Fiyat bu asistanda üretilmez.'].join('\n');actions.push({type:'copy',label:'Kopyala',payload:body},{type:'wa',label:'Müşteri WA taslağı',href:wa(fill(K.message_templates.teyit,{ad:'…',tarih:slots.tarih||'…',sehir:slots.sehir||'…',tur:slots.tur||'…',hizmetler:slots.hizmetler||'…',kisi:slots.kisi||'…',telefon:K.phone}))},{type:'link',label:'Public teklif formu',href:K.site+'/teklif.html'});return{text:body,actions};}
    return{text:'Anladım. `yardım` yazabilir veya teklif özeti / checklist / paket / brifing komutlarından birini kullanabilirsiniz.',actions};
  }
  global.SPAdminAgent={run,loadNotes,saveNote,parseSlots,HIST_KEY};
})(window);
