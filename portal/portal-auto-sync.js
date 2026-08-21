/* Stagepulse portal live data sync: permission grants dataset visibility; changes refresh the open view. */
(()=>{
  let channel=null,refreshTimer=null;
  const refresh=()=>{
    const v=(location.hash||'').slice(1);
    if(!v||typeof window.loadView!=='function')return;
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>window.loadView(v),250);
  };
  const start=()=>{
    if(!window.sb||channel)return;
    channel=window.sb.channel('stagepulse-staff-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'customers'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'teklifler'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'jobs'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'equipment'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},refresh)
      .subscribe();
  };
  window.addEventListener('stagepulse:logged-in',start);
  if(window.sb?.auth)window.sb.auth.getSession().then(({data})=>{if(data?.session)start()});
})();
