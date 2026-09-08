/* Stagepulse Admin Jarvis - single canonical live gateway. */
(function(){
'use strict';
if(window.__SP_ADMIN_JARVIS_BOOT__)return;window.__SP_ADMIN_JARVIS_BOOT__=true;
const R=window.STAGEPULSE_RUNTIME||{};
function client(){return window.__stagepulseAdminClient||window.sb||window.supabaseClient||null}
function appReady(){const v=document.getElementById('appView');return v&&!v.classList.contains('is-hidden')}
function css(){if(document.getElementById('sp-admin-jarvis-css'))return;const l=document.createElement('link');l.id='sp-admin-jarvis-css';l.rel='stylesheet';l.href='jarvis/jarvis.css?v=20260908-jarvis6';document.head.appendChild(l)}
function mount(){if(!appReady()||document.getElementById('sp-admin-jarvis'))return;css();const root=document.createElement('div');root.id='sp-admin-jarvis';root.innerHTML='<div class="spj-panel"><div class="spj-head"><div><strong>Stagepulse JARVIS</strong><small>Canonical Patron AI · RBAC</small></div><button type="button" data-close>×</button></div><div class="spj-status" id="spj-status">Hazır</div><div class="spj-msgs" id="spj-msgs"></div><div class="spj-skills" id="spj-skills"></div><form class="spj-form" id="spj-form"><input id="spj-input" maxlength="4000" autocomplete="off" placeholder="JARVIS\'e yaz…"><button type="submit">Gönder</button></form></div><button class="spj-toggle" type="button" aria-label="Stagepulse JARVIS">JARVIS</button>';document.body.appendChild(root);const msgs=root.querySelector('#spj-msgs'),form=root.querySelector('#spj-form'),input=root.querySelector('#spj-input'),status=root.querySelector('#spj-status'),skills=root.querySelector('#spj-skills');
function bubble(role,text){const b=document.createElement('div');b.className='spj-bubble '+role;b.textContent=String(text??'');msgs.appendChild(b);msgs.scrollTop=msgs.scrollHeight}
async function invokeFallback(c,message){
 const r=await c.functions.invoke('patron-ai',{body:{message,history:[]}});
 if(r.error)throw r.error;
 const data=r.data;
 if(!data)throw Error('JARVIS boş yanıt döndürdü.');
 return data;
}
async function call(message){
 const c=client();if(!c?.auth)throw Error('Supabase istemcisi hazır değil.');
 const {data:{session},error:sessionError}=await c.auth.getSession();if(sessionError)throw sessionError;if(!session?.access_token)throw Error('Yönetici oturumu bulunamadı.');
 if(!R.supabaseUrl)throw Error('Supabase URL yapılandırması eksik.');
 const url=(R.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/patron-ai';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  try{
   const res=await fetch(url,{method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','apikey':R.supabasePublishableKey||'','Authorization':'Bearer '+session.access_token},body:JSON.stringify({message,history:[]})});
   const text=await res.text();let data={};try{data=text?JSON.parse(text):{}}catch(_){}if(!res.ok)throw Error(data?.error||data?.message||('Edge Function HTTP '+res.status));if(!data)throw Error('JARVIS boş yanıt döndürdü.');return data;
  }catch(e){
   if(e?.name==='AbortError')throw Error('JARVIS isteği zaman aşımına uğradı.');
   if(e instanceof TypeError || String(e?.message||'').toLowerCase().includes('failed to fetch'))return await invokeFallback(c,message);
   throw e;
  }
 }finally{clearTimeout(timer)}
}
async function send(q){status.textContent='JARVIS çalışıyor…';try{const j=await call(q);let out=j.reply||'Yanıt alınamadı.';if(j.tool?.name)out+='\n\nTool: '+j.tool.name;if(j.provider)out+='\nSağlayıcı: '+j.provider;if(j.version)out+='\nGateway: v'+j.version;bubble('bot',out);status.textContent=j.ai_configured?'CANLI · '+j.provider:'FALLBACK';}catch(e){console.error('[stagepulse-jarvis]',e);status.textContent='HATA';bubble('bot','JARVIS bağlantı hatası: '+(e?.message||'Bilinmeyen hata'));}}
root.querySelector('[data-close]').onclick=()=>root.classList.remove('spj-open');root.querySelector('.spj-toggle').onclick=()=>{root.classList.toggle('spj-open');if(root.classList.contains('spj-open'))input.focus()};form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(!q)return;input.value='';bubble('user',q);send(q)};
((window.SP_ADMIN_KB&&window.SP_ADMIN_KB.skills)||[]).slice(0,10).forEach(s=>{const b=document.createElement('button');b.type='button';b.className='spj-skill';b.textContent=s.label;b.onclick=()=>{input.value=s.sample;form.requestSubmit()};skills.appendChild(b)});bubble('bot','Canonical JARVIS hazır. Canlı AI, şirket verileri, tool ve approval akışı tek endpoint üzerinden çalışır.');}
let tries=0,t=setInterval(()=>{tries++;if(appReady())mount();if(document.getElementById('sp-admin-jarvis')||tries>120)clearInterval(t)},500);window.addEventListener('stagepulse-admin-ready',mount);window.addEventListener('load',()=>setTimeout(mount,500));
})();
