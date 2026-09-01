/* Stagepulse Portal — permission-driven navigation integrity. */
(() => {
  const CORE = new Set(['home','jobs','equipment','offers','customers','finance','pricing']);
  const VIEW_RULES = {
    home:{perm:'dashboard.view',fn:'homeView'}, jobs:{perm:'schedule.view',fn:'jobsView'},
    equipment:{perm:'equipment.view',fn:'equipmentView'}, offers:{perm:'offers.view',fn:'offersView'},
    customers:{perm:'customers.view',fn:'customersView'}, finance:{perm:'payments.view',fn:'financeView'},
    settlements:{perm:'settlements.view',fn:'settlementsView'}, pricing:{perm:'pricing.view',fn:'pricingView'},
    analytics:{perm:'analytics.view',fn:'analyticsView'}, activity:{perm:'activity.view',fn:'activityView'},
    notifications:{perm:'notifications.view',fn:'notificationsView'}, settings:{perm:'settings.view',fn:'settingsView'}
  };
  const hasPermission=(permission)=>{try{return typeof can==='function'&&can(permission)===true;}catch(_){return false;}};
  const hasHandler=(view,rule)=>CORE.has(view)||typeof window[rule.fn]==='function';
  const allowed=(view)=>{const rule=VIEW_RULES[view];return !!rule&&hasPermission(rule.perm)&&hasHandler(view,rule);};
  function route(view){
    if(!allowed(view)){const fallback=Object.keys(VIEW_RULES).find(allowed);if(fallback)return route(fallback);const content=document.querySelector('#content');if(content)content.innerHTML='<div class="panel"><b>Aktif bölüm bulunamadı.</b><p class="muted">Bu hesap için henüz bir portal yetkisi açılmamış.</p></div>';return;}
    if(CORE.has(view)){if(typeof loadView==='function')return loadView(view);return;}
    const fn=window[VIEW_RULES[view].fn];history.replaceState(null,'','#'+view);document.querySelectorAll('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelector('#sidebar')?.classList.remove('open');const overlay=document.querySelector('#mobileOverlay');if(overlay){overlay.hidden=true;overlay.classList.remove('open');}return fn();
  }
  function reconcile(){
    const nav=document.querySelector('#sideNav');if(!nav)return;
    nav.querySelectorAll('button[data-view]').forEach(btn=>{const view=btn.dataset.view,ok=allowed(view);btn.hidden=!ok;btn.style.display=ok?'':'none';btn.setAttribute('aria-hidden',ok?'false':'true');if(ok)btn.onclick=(event)=>{event.preventDefault();route(view);};else btn.onclick=null;});
    nav.querySelectorAll('.portal-nav-label').forEach(label=>{let next=label.nextElementSibling,hasItem=false;while(next&&!next.classList.contains('portal-nav-label')){if(next.matches?.('button[data-view]')&&!next.hidden){hasItem=true;break;}next=next.nextElementSibling;}label.hidden=!hasItem;});
    const current=(location.hash||'').slice(1);if(current&&!allowed(current)){const fallback=Object.keys(VIEW_RULES).find(allowed);if(fallback)route(fallback);}
  }
  function install(){reconcile();setTimeout(reconcile,150);setTimeout(reconcile,700);setTimeout(reconcile,1500);}
  document.addEventListener('DOMContentLoaded',install,{once:true});
  const observer=new MutationObserver(()=>{if(document.querySelector('#sideNav button[data-view]'))reconcile();});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),30000);
})();
