/* Stagepulse Admin — cross-module workflow integration. */
(() => {
  'use strict';
  const MAP = {
    customers: [['customers','Müşteriler'],['offers','Teklifler'],['calendar','İşler / Etkinlikler']],
    offers: [['customers','Müşteriler'],['offers','Teklifler'],['calendar','İşler / Etkinlikler'],['settlements','Gelir · Gider']],
    calendar: [['offers','Teklifler'],['personnel','Personel'],['equipment','Ekipman'],['finance','Ödemeler'],['settlements','Gelir · Gider']],
    personnel: [['calendar','İşler / Etkinlikler'],['equipment','Ekipman'],['notifications','Bildirimler']],
    equipment: [['calendar','İşler / Etkinlikler'],['personnel','Personel'],['finance','Ödemeler']],
    finance: [['calendar','İşler / Etkinlikler'],['settlements','Gelir · Gider'],['offers','Teklifler']],
    settlements: [['finance','Ödemeler'],['calendar','İşler / Etkinlikler'],['offers','Teklifler']],
    notifications: [['calendar','İşler / Etkinlikler'],['personnel','Personel'],['activity','Aktivite']],
    settings: [['personnel','Personel'],['notifications','Bildirimler']]
  };
  const ID='spWorkflowBar';
  function style(){if(document.getElementById(ID+'Style'))return;const s=document.createElement('style');s.id=ID+'Style';s.textContent='#'+ID+'{display:flex;gap:7px;flex-wrap:wrap;margin:-6px 0 14px;padding:9px;border:1px solid rgba(127,127,127,.14);border-radius:13px;background:rgba(127,127,127,.035)}#'+ID+' span{font-size:10px;opacity:.45;align-self:center;margin-right:3px}#'+ID+' button{border:1px solid rgba(127,127,127,.14);background:transparent;color:inherit;border-radius:9px;padding:7px 10px;font-size:11px;cursor:pointer}#'+ID+' button:hover{background:rgba(127,127,127,.08)}@media(max-width:760px){#'+ID+'{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#'+ID+' span{grid-column:1/-1}}';document.head.appendChild(s)}
  function render(view){
    const content=document.getElementById('content'); if(!content)return;
    document.getElementById(ID)?.remove();
    const items=MAP[view]; if(!items)return;
    const head=content.querySelector('.page-head'); if(!head)return;
    style();
    const bar=document.createElement('div');bar.id=ID;
    bar.innerHTML='<span>Akış:</span>'+items.map(([v,t])=>`<button type="button" data-sp-route="${v}">${t}</button>`).join('');
    head.insertAdjacentElement('afterend',bar);
    bar.querySelectorAll('[data-sp-route]').forEach(b=>b.addEventListener('click',()=>window.loadView?.(b.dataset.spRoute)));
  }
  function bind(){
    if(window.__spWorkflowIntegrationBound)return;window.__spWorkflowIntegrationBound=true;style();
    const original=window.loadView;if(typeof original!=='function')return;
    window.loadView=async function(view){const r=await original.apply(this,arguments);requestAnimationFrame(()=>render(view));return r};
    setTimeout(()=>render((location.hash||'#dashboard').slice(1)),250);
  }
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(bind,100));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,300),{once:true});else setTimeout(bind,300);
})();
