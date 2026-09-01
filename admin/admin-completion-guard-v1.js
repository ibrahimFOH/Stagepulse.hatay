/* Stagepulse Admin — final module wiring/health indicator. */
(() => {
  'use strict';
  const MODULES = [
    ['customers','Müşteriler'], ['offers','Teklifler'], ['calendar','İşler / Etkinlikler'],
    ['personnel','Personel'], ['equipment','Ekipman'], ['finance','Finans'],
    ['notifications','Bildirimler'], ['approvals','Onaylar'], ['ai','AI'], ['settings','Ayarlar / Yetkiler']
  ];
  const aliases = { approvals:'command-center', ai:'command-center' };
  function buttonFor(v){ return document.querySelector(`#sideNav button[data-view="${v}"]`); }
  function mark(){
    const nav=document.getElementById('sideNav'); if(!nav)return;
    let box=document.getElementById('spAdminHealth');
    if(!box){box=document.createElement('section');box.id='spAdminHealth';box.className='sp-admin-health';nav.appendChild(box)}
    const checks=MODULES.map(([v,t])=>{
      const target=buttonFor(v)||buttonFor(aliases[v]);
      return `<span class="${target?'ok':'missing'}"><i></i>${t}</span>`;
    });
    box.innerHTML='<strong>Admin kapsamı</strong><div>'+checks.join('')+'</div>';
    if(!document.getElementById('spAdminHealthStyle')){const s=document.createElement('style');s.id='spAdminHealthStyle';s.textContent='#spAdminHealth{margin:14px 12px 0;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.02)}#spAdminHealth strong{display:block;font-size:9px;opacity:.55;margin-bottom:7px}#spAdminHealth div{display:grid;grid-template-columns:1fr 1fr;gap:5px}#spAdminHealth span{font-size:8px;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#spAdminHealth i{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:5px;background:currentColor}.ok{color:#79d6a5}.missing{color:#d97878}@media(max-width:760px){#spAdminHealth{display:none}}';document.head.appendChild(s)}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(mark,800));
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(mark,250));
})();
