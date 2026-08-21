/* Stagepulse portal live data sync + password recovery bootstrap. */
(()=>{
  let channel=null,refreshTimer=null;
  const refresh=()=>{const v=(location.hash||'').slice(1);if(!v||typeof window.loadView!=='function')return;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>window.loadView(v),250)};
  const ensureRecoveryUi=()=>{
    const form=document.querySelector('#loginForm'); if(!form||document.querySelector('#forgotPasswordBtn'))return;
    const b=document.createElement('button'); b.type='button'; b.className='btn'; b.id='forgotPasswordBtn'; b.textContent='Şifremi unuttum';
    const err=document.querySelector('#loginErr'); form.insertBefore(b,err||null);
  };
  const loadRecovery=()=>{ensureRecoveryUi();if(document.querySelector('script[data-stagepulse-recovery]'))return;const s=document.createElement('script');s.src=`password-recovery.js?v=20260822-01`;s.dataset.stagepulseRecovery='1';document.head.appendChild(s)};
  const start=()=>{loadRecovery();if(!window.sb||channel)return;channel=window.sb.channel('stagepulse-staff-live').on('postgres_changes',{event:'*',schema:'public',table:'customers'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'teklifler'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'jobs'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'equipment'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'notifications'},refresh).subscribe()};
  window.addEventListener('stagepulse:logged-in',start);
  document.addEventListener('DOMContentLoaded',()=>{ensureRecoveryUi();loadRecovery()},{once:true});
  if(window.sb?.auth)window.sb.auth.getSession().then(({data})=>{loadRecovery();if(data?.session)start()});
})();
