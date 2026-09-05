/* Stagepulse Admin — service save repair */
(function(){
  'use strict';
  if(window.__STAGEPULSE_SERVICE_SAVE_REPAIR_V1__) return;
  window.__STAGEPULSE_SERVICE_SAVE_REPAIR_V1__=true;
  function client(){return window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb||window.supabaseClient||null}
  function message(w,text,error){
    var el=w.querySelector('[data-sp-save-status]');
    if(!el){el=document.createElement('div');el.setAttribute('data-sp-save-status','1');el.setAttribute('role','status');el.style.cssText='margin-top:10px;font-size:13px;font-weight:800;color:#aeb5c0';w.querySelector('.sp-runtime-modal-actions')?.before(el)}
    el.textContent=text;el.style.color=error?'#ff7777':'#6ee7a0';
  }
  async function save(button){
    var w=button.closest('#spPricingNewService');
    if(!w)return;
    var db=client();
    if(!db){message(w,'Supabase bağlantısı hazır değil.',true);return}
    var name=w.querySelector('[data-sp-name]')?.value.trim()||'';
    var desc=w.querySelector('[data-sp-desc]')?.value.trim()||null;
    var price=Math.max(0,Number(w.querySelector('[data-sp-price]')?.value)||0);
    var sort=Math.max(0,Math.floor(Number(w.querySelector('[data-sp-sort]')?.value)||0));
    if(!name){message(w,'Hizmet adı gerekli.',true);w.querySelector('[data-sp-name]')?.focus();return}
    button.disabled=true;button.setAttribute('aria-busy','true');var old=button.textContent;button.textContent='Kaydediliyor…';message(w,'Hizmet kaydediliyor…',false);
    try{
      var res=await db.rpc('staff_upsert_service',{p_id:null,p_name:name,p_description:desc,p_base_price:price,p_sort_order:sort});
      if(res.error)throw res.error;
      message(w,'Hizmet başarıyla kaydedildi.',false);
      if(typeof window.toast==='function')window.toast('Hizmet eklendi.',true);
      setTimeout(function(){location.reload()},250);
    }catch(e){
      console.error('[stagepulse-admin] service save failed',e);
      message(w,e?.message||'Hizmet eklenemedi.',true);
      if(typeof window.toast==='function')window.toast(e?.message||'Hizmet eklenemedi.',false);
      button.disabled=false;button.removeAttribute('aria-busy');button.textContent=old;
    }
  }
  document.addEventListener('click',function(e){
    var b=e.target?.closest?.('#spPricingNewService [data-sp-save]');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();save(b);
  },true);
})();
