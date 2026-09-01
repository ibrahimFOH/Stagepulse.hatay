/* Stagepulse Portal — canonical shell bootstrap */
(() => {
  'use strict';
  const ready=()=>{
    const R=window.STAGEPULSE_RUNTIME||{};
    if(!window.StagepulsePortalSupabase){
      const client=window.supabase?.createClient?.(R.supabaseUrl,R.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'stagepulse-staff-auth-v2',storage:window.sessionStorage}});
      if(client){window.StagepulsePortalSupabase={getClient:()=>client};window.sb=window.sb||client;}
    } else if(!window.sb) window.sb=window.StagepulsePortalSupabase.getClient();
    window.dispatchEvent(new CustomEvent('stagepulse-portal-ready'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
