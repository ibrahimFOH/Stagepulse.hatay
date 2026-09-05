/* Stagepulse Admin Jarvis integration — advisory UI + capability-gated read-only live summary. */
(function(){
  'use strict';
  if(window.__SP_ADMIN_JARVIS_BOOT__)return;
  window.__SP_ADMIN_JARVIS_BOOT__=true;
  var CAP_KEYS=['ai.usage.manage','reports.manage','kpi.manage','jobs.manage','customers.manage','equipment.manage','finance.manage'];
  var LIVE_TABLES={
    offers:{table:'teklifler',cap:['reports.manage','ai.usage.manage']},
    jobs:{table:'jobs',cap:['jobs.manage','reports.manage','ai.usage.manage']},
    customers:{table:'customers',cap:['customers.manage','reports.manage','ai.usage.manage']},
    equipment:{table:'equipment',cap:['equipment.manage','reports.manage','ai.usage.manage']},
    payments:{table:'payments',cap:['finance.manage']},
    settlements:{table:'settlements',cap:['finance.manage']}
  };
  function client(){var s=window.StagepulseAdminSupabase||window.AdminSupabase;return s&&typeof s.getClient==='function'?s.getClient():(window.sb||null)}
  function appReady(){var v=document.getElementById('appView');return v&&!v.classList.contains('is-hidden')}
  function safe(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}
  function addCss(){if(document.getElementById('sp-admin-jarvis-css'))return;var l=document.createElement('link');l.id='sp-admin-jarvis-css';l.rel='stylesheet';l.href='jarvis/jarvis.css?v=20260905-1';document.head.appendChild(l)}
  function hasAnyCap(sb,keys){if(!sb||!sb.rpc)return Promise.resolve(false);return Promise.all(keys.map(function(k){return sb.rpc('admin_has_capability',{p_capability_key:k}).then(function(r){return !r.error&&r.data===true}).catch(function(){return false})})).then(function(a){return a.some(Boolean)})}
  function canLive(sb){return hasAnyCap(sb,CAP_KEYS)}
  function getTable(sb,table,cap){return hasAnyCap(sb,cap).then(function(ok){if(!ok)return null;return sb.functions.invoke('admin-data',{body:{action:'list',table:table,order:{column:'created_at',ascending:false}}}).then(function(r){if(r.error||!r.data||r.data.ok!==true)return null;return r.data.data||[]}).catch(function(){return null})})}
  function summarize(rows){
    rows=rows||[];var status={};var total=0;rows.forEach(function(r){var s=String(r.status||r.state||'belirsiz').toLocaleLowerCase('tr-TR');status[s]=(status[s]||0)+1;var n=Number(r.total||r.amount||r.grand_total||r.price||0);if(Number.isFinite(n))total+=n});
    var top=Object.keys(status).sort(function(a,b){return status[b]-status[a]}).slice(0,5).map(function(k){return '• '+k+': '+status[k]}).join('\n');
    return {count:rows.length,total:total,status:top||'• kayıt yok'};
  }
  function mount(){
    if(!appReady()||document.getElementById('sp-admin-jarvis'))return;
    addCss();
    var root=document.createElement('div');root.id='sp-admin-jarvis';
    root.innerHTML='<div class="spj-panel"><div class="spj-head"><div><strong>Stagepulse Jarvis</strong><small>RBAC kontrollü yönetim asistanı</small></div><button type="button" data-spj-close aria-label="Kapat">×</button></div><div class="spj-status" id="spj-status">Yetki kontrol ediliyor…</div><div class="spj-msgs" id="spj-msgs"></div><div class="spj-skills" id="spj-skills"></div><form class="spj-form" id="spj-form"><input id="spj-input" maxlength="1200" autocomplete="off" placeholder="Örn: teklif özeti, saha brifingi…"><button type="submit">Çalıştır</button></form></div><button class="spj-toggle" type="button" aria-label="Stagepulse Jarvis">✦</button>';
    document.body.appendChild(root);
    var msgs=root.querySelector('#spj-msgs'),form=root.querySelector('#spj-form'),input=root.querySelector('#spj-input'),status=root.querySelector('#spj-status'),skills=root.querySelector('#spj-skills');
    function bubble(role,text,actions){var b=document.createElement('div');b.className='spj-bubble '+role;b.innerHTML=safe(text);if(actions&&actions.length){var bar=document.createElement('div');bar.className='spj-actions';actions.forEach(function(a){if(a.type==='copy'){var x=document.createElement('button');x.className='spj-copy';x.textContent=a.label;x.onclick=function(){navigator.clipboard?.writeText(a.payload||'').catch(function(){});};bar.appendChild(x)}else if(a.type==='wa'||a.type==='link'){var x=document.createElement('a');x.className=a.type==='wa'?'spj-wa':'spj-link';x.textContent=a.label;x.href=a.href;x.target='_blank';x.rel='noopener';bar.appendChild(x)}});b.appendChild(bar)}msgs.appendChild(b);msgs.scrollTop=msgs.scrollHeight}
    function run(q){var r=window.SPAdminAgent.run(q);if(r.text==='LIVE_SUMMARY_REQUEST'){liveSummary();return}bubble('bot',r.text,r.actions)}
    function liveSummary(){var sb=client();if(!sb){bubble('bot','Admin oturumu hazır değil. Sayfayı yenileyip tekrar deneyin.');return}status.textContent='Canlı veri yetkisi kontrol ediliyor…';canLive(sb).then(function(ok){if(!ok){status.innerHTML='<span class="spj-denied">Canlı özet yetkisi yok.</span> Yerel Jarvis komutları kullanılabilir.';bubble('bot','Bu hesap için canlı yönetim verisi yetkisi verilmemiş. Yetki merkezi üzerinden uygun AI/rapor yetkisi tanımlanabilir.');return}status.innerHTML='<span class="spj-ok">Canlı özet açık.</span> Yalnızca izin verilen alanlar okunur.';return Promise.all(Object.keys(LIVE_TABLES).map(function(k){var x=LIVE_TABLES[k];return getTable(sb,x.table,x.cap).then(function(rows){return[k,rows]})})).then(function(parts){var out=['**Canlı yönetim özeti**',''];parts.forEach(function(p){var s=summarize(p[1]);if(s.count||p[0]==='offers')out.push('**'+p[0]+'**: '+s.count+' kayıt');if(s.total)out.push('Toplam değer: '+s.total.toLocaleString('tr-TR'));if(s.status!=='• kayıt yok')out.push(s.status);out.push('')});bubble('bot',out.join('\n'))})}).catch(function(){bubble('bot','Canlı özet alınamadı. Yerel Jarvis çalışmaya devam ediyor.')})}
    (window.SP_ADMIN_KB&&window.SP_ADMIN_KB.skills||[]).slice(0,7).forEach(function(s){var b=document.createElement('button');b.className='spj-skill';b.type='button';b.textContent=s.label;b.onclick=function(){input.value=s.sample;form.requestSubmit()};skills.appendChild(b)});
    root.querySelector('[data-spj-close]').onclick=function(){root.classList.remove('spj-open')};root.querySelector('.spj-toggle').onclick=function(){root.classList.toggle('spj-open');if(root.classList.contains('spj-open'))input.focus()};
    form.onsubmit=function(e){e.preventDefault();var q=input.value.trim();if(!q)return;input.value='';bubble('user',q);run(q)};
    bubble('bot','Admin Jarvis hazır. `yardım` ile komutları, `canlı özet` ile RBAC kontrollü canlı özeti kullanabilirsiniz.');
    var sb=client();if(sb){canLive(sb).then(function(ok){status.innerHTML=ok?'<span class="spj-ok">AI/rapor canlı veri yetkisi hazır.</span>':'Yerel mod · canlı veri yetkisi yok.'}).catch(function(){status.textContent='Yerel mod · yetki doğrulanamadı.'})}else status.textContent='Yerel mod · admin istemcisi bekleniyor.';
  }
  var tries=0;var timer=setInterval(function(){tries++;if(appReady())mount();if(document.getElementById('sp-admin-jarvis')||tries>120)clearInterval(timer)},500);
  window.addEventListener('stagepulse-admin-ready',mount);window.addEventListener('load',function(){setTimeout(mount,1000)});
})();
