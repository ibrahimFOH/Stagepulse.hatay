/* Stagepulse Command Center final guard: canonical contexts + safe live status. */
(function(){'use strict';
  var URL='https://mtjcqqrogjqaxkagwkti.supabase.co',KEY='sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6',client=null;
  function sb(){if(client)return client;client=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.supabaseClient||window.sb||null;return client}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  async function rows(table,select,filter){var c=sb();if(!c)return {data:[],count:0,error:new Error('client')};var q=c.from(table).select(select,{count:'exact'});if(filter)q=q.eq(filter[0],filter[1]);return await q}
  async function renderGuard(){
    var shell=document.querySelector('.cc-shell'),body=document.getElementById('ccBody');if(!shell||!body)return;document.getElementById('ccFinalGuard')?.remove();
    var r=await Promise.all([
      rows('ai_agents','id,code,name,active',['active',true]),rows('stagepulse_staff_command_view','user_id'),rows('stagepulse_equipment_command_view','id'),rows('stagepulse_vehicle_command_view','id'),rows('event_tasks','id,status'),rows('stagepulse_checklist_command_view','checklist_id'),rows('stagepulse_risk_command_view','id'),rows('stagepulse_automation_command_view','rule_id'),rows('ai_action_requests','id,status',['status','pending'])
    ]);
    var open=(r[4].data||[]).filter(x=>x.status!=='done'&&x.status!=='cancelled').length,approvals=r[8].data||[];
    var items=[['Müşteri','customers','Müşteri ve geçmiş kayıtları'],['Teklif','teklifler','Satış akışı'],['İş','jobs','Tekliften operasyona'],['Etkinlik','event_projects','Event DNA'],['Personel','staff','Beceri · uygunluk · atama'],['Ekipman','equipment','Stok · depo · bakım'],['Görev','tasks',open+' açık görev'],['Kontrol listesi','checklists','Advance · setup · show · closeout'],['Araç / Nakliye','vehicles','Araç · sürücü · etkinlik'],['Finans','event_financials','Tahmini · gerçek · marj'],['Risk','risks','Etkinlik ve işletme riskleri'],['Otomasyon','automations','Kural · çalışma geçmişi'],['AI','ai',(r[0].data||[]).length+' aktif ajan'],['Onay','approvals',approvals.length+' bekleyen']];
    var box=document.createElement('section');box.id='ccFinalGuard';box.className='cc-panel';box.innerHTML='<div class="cc-panel-head"><h3>Sistem kapsamı</h3><small style="opacity:.55">Canlı bağlam kontrolü</small></div><div class="cc-final-grid">'+items.map(x=>'<div class="cc-final-item"><strong>'+esc(x[0])+'</strong><small>'+esc(x[2])+'</small></div>').join('')+'</div>';body.appendChild(box);
    if(!document.getElementById('ccFinalGuardStyle')){var s=document.createElement('style');s.id='ccFinalGuardStyle';s.textContent='.cc-final-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.cc-final-item{border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;background:rgba(255,255,255,.02)}.cc-final-item strong,.cc-final-item small{display:block}.cc-final-item strong{font-size:11px}.cc-final-item small{font-size:9px;opacity:.5;margin-top:4px}@media(max-width:760px){.cc-final-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';document.head.appendChild(s)}
  }
  function active(){return document.querySelector('#sideNav [data-view="command-center"]')?.classList.contains('active')}
  var timer=null;function watch(){clearTimeout(timer);timer=setTimeout(()=>{if(active())renderGuard()},500)}
  document.addEventListener('click',e=>{if(e.target.closest('#sideNav [data-view="command-center"],.cc-tabs button,#ccRefresh'))watch()});window.addEventListener('stagepulse-admin-ready',watch);document.addEventListener('DOMContentLoaded',watch);
})();
