/* Stagepulse Admin — unified navigation and workflow layer. */
(() => {
  'use strict';
  const nav = () => document.getElementById('sideNav');
  const button = (view, label, cls = '') => { const b=document.createElement('button'); b.type='button'; b.dataset.view=view; b.textContent=label; b.className=cls; return b; };

  function rebuildNavigation() {
    const n=nav(); if(!n || n.dataset.spUnifiedNav==='1') return;
    n.dataset.spUnifiedNav='1'; n.innerHTML='';
    const groups=[
      ['YÖNETİM',[['command-center','Komuta Merkezi','sp-cc-nav'],['dashboard','Genel Bakış'],['analytics','Analitik']]],
      ['SATIŞ',[['customers','Müşteriler'],['offers','Teklifler'],['pricing','Fiyatlandırma'],['settlements','Gelir · Gider']]],
      ['OPERASYON',[['calendar','İşler · Takvim'],['equipment','Ekipman'],['personnel','Personel'],['finance','Ödemeler']]],
      ['SİSTEM',[['notifications','Bildirimler'],['activity','Aktivite'],['media','Medya'],['settings','Ayarlar']]]
    ];
    groups.forEach(([title,items])=>{const l=document.createElement('p');l.className='nav-label';l.textContent=title;n.appendChild(l);items.forEach(x=>n.appendChild(button(x[0],x[1],x[2]||'')));});
    const logout=button('logout','Çıkış','nav-logout');logout.id='logoutBtn';n.appendChild(logout);
    if(!document.getElementById('sp-unified-nav-style')){const s=document.createElement('style');s.id='sp-unified-nav-style';s.textContent='#sideNav .nav-label{margin-top:18px}#sideNav .nav-label:first-child{margin-top:4px}#sideNav button[data-view="command-center"]{font-weight:800;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055)}#sideNav button[data-view="command-center"].active{background:rgba(255,255,255,.12)}.sp-quick-actions{margin:12px 0 16px}.sp-quick-title{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px}.sp-quick-title span{opacity:.5;font-size:12px}.sp-quick-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.sp-quick-grid button{border:1px solid rgba(127,127,127,.16);background:transparent;color:inherit;border-radius:10px;padding:10px 8px;cursor:pointer}@media(max-width:760px){.sp-quick-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(s)}
    n.querySelectorAll('button[data-view]').forEach(b=>{b.addEventListener('click',()=>{if(b.dataset.view==='command-center'){window.openStagepulseCommandCenter?.('overview');return;}window.loadView?.(b.dataset.view);});});
    logout.addEventListener('click',async()=>{try{const c=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient;await c?.auth.signOut();}finally{location.reload();}});
  }

  function quickActions(){
    if((location.hash||'#dashboard')!=='#dashboard')return;
    const content=document.getElementById('content');if(!content||content.querySelector('#spQuickActions'))return;
    const head=content.querySelector('.page-head');if(!head)return;
    const box=document.createElement('div');box.id='spQuickActions';box.className='panel sp-quick-actions';
    box.innerHTML='<div class="sp-quick-title"><strong>Hızlı işlemler</strong><span>Günlük işleri tek tıkla aç</span></div><div class="sp-quick-grid">'+[['offers','Yeni teklif'],['customers','Yeni müşteri'],['calendar','Yeni iş'],['equipment','Ekipman'],['personnel','Personel'],['settlements','Gelir · Gider'],['finance','Ödeme'],['command-center','Komuta Merkezi']].map(([v,t])=>`<button type="button" data-quick="${v}">${t}</button>`).join('')+'</div>';
    head.insertAdjacentElement('afterend',box);
    box.querySelectorAll('[data-quick]').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.quick;if(v==='offers')window.newOffer?.();else if(v==='customers')window.customerModal?.(null);else if(v==='calendar')window.jobModal?.(null);else if(v==='command-center')window.openStagepulseCommandCenter?.('overview');else window.loadView?.(v);}));
  }
  function watch(){rebuildNavigation();setTimeout(quickActions,100)}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(watch,500));
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(watch,150));
  window.addEventListener('hashchange',()=>setTimeout(watch,100));
  new MutationObserver(()=>setTimeout(watch,0)).observe(document.body,{childList:true,subtree:true});
})();
