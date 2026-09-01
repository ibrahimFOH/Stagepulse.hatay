/* Stagepulse Portal — jobs loader. Uses the authenticated jobs RPC when available. */
(() => {
  'use strict';
  const getClient=()=>window.StagepulsePortalSupabase?.getClient?.()||window.StagepulseAdminSupabase?.getClient?.()||window.sb;
  async function fetchJobsSolid(){
    const sb=getClient();if(!sb)throw new Error('Supabase bağlantısı hazırlanamadı.');
    const {data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error('Oturum gerekli.');
    const r=await sb.rpc('staff_list_jobs');
    if(!r.error){window.jobs=Array.isArray(r.data)?r.data:[];return window.jobs;}
    try{const q=await sb.from('jobs').select('*').order('event_at',{ascending:true,nullsFirst:false});if(!q.error){window.jobs=q.data||[];return window.jobs;}}catch(_){ }
    throw r.error;
  }
  function install(){window.fetchJobs=fetchJobsSolid;window.fetchJobs.__spSolid=true;}
  install();document.addEventListener('DOMContentLoaded',install);window.addEventListener('stagepulse:permissions-ready',install);
})();
