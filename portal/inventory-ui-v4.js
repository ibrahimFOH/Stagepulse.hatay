/* Final inventory boot hook: ensure direct #equipment opens the overridden UI. */
(() => {
  let bootPending=false;
  const boot=()=>{
    if(location.hash!=='#equipment'||bootPending)return;
    bootPending=true;
    const attempt=()=>{
      if(location.hash!=='#equipment'){bootPending=false;return;}
      if(typeof window.loadView==='function'&&typeof window.equipmentView==='function'){
        Promise.resolve(window.loadView('equipment')).finally(()=>{bootPending=false});
        return;
      }
      setTimeout(attempt,50);
    };
    attempt();
  };
  window.addEventListener('hashchange',boot);
  window.addEventListener('pageshow',boot);
  window.addEventListener('load',boot);
  document.addEventListener('DOMContentLoaded',boot);
  boot();
})();
