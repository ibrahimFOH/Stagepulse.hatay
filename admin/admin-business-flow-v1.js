/* Stagepulse Admin — canonical business workflow navigation. */
(() => {
  'use strict';
  const FLOW=[
    ['customers','Müşteriler'],['offers','Teklifler'],['calendar','İşler / Takvim'],['personnel','Personel'],['equipment','Ekipman'],['finance','Finans'],['command-center','Komuta Merkezi']
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function go(view){document.querySelector(`#sideNav button[data-view="${view}"]`)?.click();}
  function render(){
    const content=document.getElementById('content'); if(!content)return;
    const hash=(location.hash||'#dashboard').slice(1); const i=FLOW.findIndex(x=>x[0]===hash); if(i<0)return;
    let bar=document.getElementById('spBusinessFlow');
    if(!bar){bar=document.createElement('section');bar.id='spBusinessFlow';bar.className='panel';const head=content.querySelector('.page-head');if(head)head.insertAdjacentElement('afterend',bar);else content.prepend(bar);}
    bar.innerHTML=`<div class="sp-bf-head"><strong>İş akışı</strong><span>${i+1}/${FLOW.length}</span></div><div class="sp-bf-steps">${FLOW.map((x,k)=>`<button type="button" class="${k===i?'active':''}" data-sp-bf="${esc(x[0])}"><small>${k+1}</small>${esc(x[1])}</button>`).join('')}</div>`;
    bar.querySelectorAll('[data-sp-bf]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.spBf)));
    if(!document.getElementById('spBusinessFlowStyle')){const s=document.createElement('style');s.id='spBusinessFlowStyle';s.textContent='#spBusinessFlow{padding:11px 12px;margin:0 0 14px;border-radius:14px}#spBusinessFlow .sp-bf-head{display:flex;justify-content:space-between;margin-bottom:8px;font-size:11px}#spBusinessFlow .sp-bf-head span{opacity:.45}#spBusinessFlow .sp-bf-steps{display:flex;gap:5px;overflow:auto}#spBusinessFlow button{border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);color:inherit;border-radius:9px;padding:7px 9px;white-space:nowrap;font-size:10px;cursor:pointer}#spBusinessFlow button.active{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15)}#spBusinessFlow small{opacity:.45;margin-right:5px}';document.head.appendChild(s)}
  }
  let t;function watch(){clearTimeout(t);t=setTimeout(render,250)}
  window.addEventListener('hashchange',watch);window.addEventListener('stagepulse-admin-ready',watch);document.addEventListener('DOMContentLoaded',watch);
  document.addEventListener('click',e=>{if(e.target.closest('#sideNav button[data-view]'))watch()},true);
})();
