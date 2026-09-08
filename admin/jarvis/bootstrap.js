/* Stagepulse Admin JARVIS v39 - single canonical live gateway. */
(function(){
'use strict';
if(window.__SP_ADMIN_JARVIS_BOOT_V39__)return;
window.__SP_ADMIN_JARVIS_BOOT_V39__=true;
const R=window.STAGEPULSE_RUNTIME||{};
function client(){return window.__stagepulseAdminClient||window.sb||window.supabaseClient||null}
function appReady(){const v=document.getElementById('appView');return v&&!v.classList.contains('is-hidden')}
function css(){if(document.getElementById('sp-admin-jarvis-css'))return;const l=document.createElement('link');l.id='sp-admin-jarvis-css';l.rel='stylesheet';l.href='jarvis/jarvis.css?v=20260908-jarvis39';document.head.appendChild(l)}
function mount(){if(!appReady()||document.getElementById('sp-admin-jarvis'))return;css();const root=document.createElement('div');root.id='sp-admin-jarvis';root.dataset.gateway='patron-ai-v39';root.innerHTML='<div class="spj-panel"><div class="spj-head"><div><strong>Stagepulse JARVIS</strong><small>Canonical Patron AI · v39</small></div><button type="button" data-close>×</button></div><div class="spj-status" id="spj-status">Hazır · Gateway v39</div><div class="spj-msgs" id="spj-msgs"></div><div class="spj-skills" id="spj-skills"></div><form class="spj-form" id="spj-form"><input id="spj-input" maxlength="4000" autocomplete="off" placeholder="JARVIS\'e yaz…"><button type="submit">Gönder</button></form></div><button class="spj-toggle" type="button" aria-label="Stagepulse JARVIS">JARVIS</button>';document.body.appendChild(root);const msgs=root.querySelector('#spj-msgs'),form=root.querySelector('#spj-form'),input=root.querySelector('#spj-input'),status=root.querySelector('#spj-status'),skills=root.querySelector('#spj-skills');
function bubble(role,text){const b=document.createElement('div');b.className='spj-bubble '+role;b.textContent=String(text??'');msgs.appendChild(b);msgs.scrollTop=msgs.scrollHeight}
async function call(message){
 const c=client();if(!c?.auth)throw Error('JARVIS v39: Supabase istemcisi hazır değil.');
 const sessionResult=await c.auth.getSession();
 if(sessionResult.error)throw Error('JARVIS v39 Auth: '+sessionResult.error.message);
 const session=sessionResult?.data?.session;
 if(!session?.access_token)throw Error('JARVIS v39: Yönetici oturumu bulunamadı.');
 if(!R.supabaseUrl)throw Error('JARVIS v39: Supabase URL yapılandırması eksik.');
 const url=R.supabaseUrl.replace(/\/$/,'')+'/functions/v1/patron-ai';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const res=await fetch(url,{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','apikey':R.supabasePublishableKey||'','Authorization':'Bearer '+session.access_token,'X-Stagepulse-Jarvis':'v39'},body:JSON.stringify({message,history:[]})});
  const text=await res.text();let data={};try{data=text?JSON.parse(text):{}}catch(_){data={raw:text}};
  if(!res.ok)throw Error('JARVIS v39 HTTP '+res.status+': '+(data?.error||data?.message||data?.raw||'Edge Function yanıtı alınamadı'));
  return data;
 }catch(e){
  if(e?.name==='AbortError')throw Error('JARVIS v39: Edge Function zaman aşımına uğradı.');
  throw e;
 }finally{clearTimeout(timer)}
}
async function send(q){status.textContent='JARVIS v39 çalışıyor…';try{const j=await call(q);let out=j.reply||'Yanıt alınamadı.';if(j.provider)out+='\nSağlayıcı: '+j.provider;if(j.version)out+='\nGateway: v'+j.version;if(j.provider_error)out+='\nProvider fallback: '+j.provider_error;bubble('bot',out);status.textContent=j.ai_configured?'CANLI · '+j.provider:'FALLBACK';}catch(e){console.error('[stagepulse-jarvis-v39]',e);status.textContent='HATA · v39';bubble('bot',e?.message||'JARVIS v39 bağlantı hatası');}}
root.querySelector('[data-close]').onclick=()=>root.classList.remove('spj-open');root.querySelector('.spj-toggle').onclick=()=>{root.classList.toggle('spj-open');if(root.classList.contains('spj-open'))input.focus()};form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(!q)return;input.value='';bubble('user',q);send(q)};
((window.SP_ADMIN_KB&&window.SP_ADMIN_KB.skills)||[]).slice(0,10).forEach(s=>{const b=document.createElement('button');b.type='button';b.className='spj-skill';b.textContent=s.label;b.onclick=()=>{input.value=s.sample;form.requestSubmit()};skills.appendChild(b)});bubble('bot','JARVIS v39 hazır. Canonical gateway: patron-ai.');}
let tries=0,t=setInterval(()=>{tries++;if(appReady())mount();if(document.getElementById('sp-admin-jarvis')||tries>120)clearInterval(t)},500);window.addEventListener('stagepulse-admin-ready',mount);window.addEventListener('load',()=>setTimeout(mount,500));
})();
