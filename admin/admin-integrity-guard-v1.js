/* Stagepulse Admin — integrity guard for the canonical business workflow. */
(() => {
  'use strict';
  const FLOW=['customers','offers','calendar','personnel','equipment','finance','notifications','activity','settings','command-center'];
  const expected={customers:'Müşteriler',offers:'Teklifler',calendar:'İşler · Takvim',personnel:'Personel',equipment:'Ekipman',finance:'Ödemeler',notifications:'Bildirimler',activity:'Aktivite',settings:'Ayarlar', 'command-center':'Komuta Merkezi'};
  function check(){
    const nav=document.getElementById('sideNav'); if(!nav)return;
    const buttons=[...nav.querySelectorAll('button[data-view]')];
    const seen=new Set();
    buttons.forEach(b=>{const v=b.dataset.view;if(expected[v]){seen.add(v);b.setAttribute('aria-label',expected[v]);}});
    FLOW.forEach(v=>{if(!seen.has(v))console.warn('[Stagepulse Admin] Missing route:',v);});
    // Never allow an accidental duplicate command-center entry.
    const cc=buttons.filter(b=>b.dataset.view==='command-center');
    cc.slice(1).forEach(b=>b.remove());
    // The canonical workflow bar is allowed only on business modules, never on dashboard/CC.
    const hash=(location.hash||'#dashboard').slice(1);
    const bar=document.getElementById('spBusinessFlow');
    if(bar)bar.hidden=!['customers','offers','calendar','personnel','equipment','finance'].includes(hash);
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(check,900));
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(check,250));
  window.addEventListener('hashchange',()=>setTimeout(check,150));
  new MutationObserver(()=>setTimeout(check,50)).observe(document.body,{childList:true,subtree:true});
})();
