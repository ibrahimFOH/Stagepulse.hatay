/* Stagepulse Command Center — visible AI layer + admin approval center. */
(() => {
  'use strict';
  const URL='https://mtjcqqrogjqaxkagwkti.supabase.co';
  const KEY='sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  let client;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sb=()=>client||(client=window.__stagepulseAdminClient||window.supabaseClient||(window.supabase?.createClient?window.supabase.createClient(URL,KEY):null));
  const toast=(msg,ok=true)=>{let e=document.getElementById('spAiToast');if(!e){e=document.createElement('div');e.id='spAiToast';e.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10000;padding:10px 14px;border-radius:10px;background:#12151b;border:1px solid rgba(255,255,255,.12);font-size:12px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35)';document.body.appendChild(e)}e.textContent=msg;e.style.borderColor=ok?'rgba(40,220,155,.35)':'rgba(255,100,100,.4)';clearTimeout(e._t);e._t=setTimeout(()=>e.remove(),2500)};
  const styles=()=>{if(document.getElementById('spAIStyle'))return;const s=document.createElement('style');s.id='spAIStyle';s.textContent='.sp-ai-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.sp-ai-card{padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.sp-ai-card-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.sp-ai-card strong{font-size:11px}.sp-ai-card-top span{font-size:8px;opacity:.55}.sp-ai-card p{font-size:9px;line-height:1.45;opacity:.55;margin:7px 0}.sp-ai-perms{display:flex;gap:4px;flex-wrap:wrap}.sp-ai-perms i{font-style:normal;font-size:8px;padding:3px 5px;border-radius:999px;background:rgba(255,255,255,.05)}.sp-ai-approval-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.sp-ai-approval-actions button{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:inherit;border-radius:8px;padding:7px 10px;font-size:10px;cursor:pointer}.sp-ai-approval-actions .ok{border-color:rgba(40,220,155,.28)}.sp-ai-approval-actions .no{border-color:rgba(255,100,100,.25)}.sp-ai-approval-actions button:disabled{opacity:.45;cursor:not-allowed}.sp-ai-payload{font-size:10px;opacity:.55;margin-top:4px;word-break:break-word;line-height:1.35}@media(max-width:760px){.sp-ai-grid{grid-template-columns:1fr 1fr}}@media(max-width:480px){.sp-ai-grid{grid-template-columns:1fr}}';document.head.appendChild(s)};
  async function load(){
    const c=sb();if(!c)return;
    styles();
    const [agents,runs,requests]=await Promise.all([
      c.from('ai_agents').select('code,name,purpose,active,can_read,can_propose,can_execute').eq('active',true).order('name'),
      c.from('stagepulse_ai_command_view').select('ai_run_id,agent_id,action_type,status,created_at,event_title').order('created_at',{ascending:false}).limit(50),
      c.from('ai_action_requests').select('id,action_type,target_type,target_id,payload,status,approved_by,approved_at,executed_at,created_at').order('created_at',{ascending:false}).limit(50)
    ]);
    if(agents.error||runs.error||requests.error){const err=agents.error||runs.error||requests.error;const host=document.querySelector('.sp-cc');if(host)host.querySelector('#spVisibleAI')?.remove();const old=document.getElementById('spAIDataError');if(old)old.remove();if(host){const box=document.createElement('div');box.id='spAIDataError';box.className='sp-cc-section';box.innerHTML='<h3>AI veri bağlantısı hatası</h3><p style="margin:0;font-size:11px;opacity:.6">'+esc(err.message||err)+'</p>';host.appendChild(box)}return;}
    const host=document.querySelector('.sp-cc');if(!host)return;
    document.getElementById('spAIDataError')?.remove();document.getElementById('spVisibleAI')?.remove();document.getElementById('spAIActions')?.remove();
    const agentsBox=document.createElement('section');agentsBox.id='spVisibleAI';agentsBox.className='sp-cc-section';
    agentsBox.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h3 style="margin:0">Stagepulse AI</h3><small style="opacity:.5">Okuma + öneri · doğrudan yürütme kapalı</small></div><div class="sp-ai-grid">'+(agents.data||[]).map(a=>'<article class="sp-ai-card"><div class="sp-ai-card-top"><strong>'+esc(a.name)+'</strong><span>AKTİF</span></div><p>'+esc(a.purpose)+'</p><div class="sp-ai-perms"><i>Okuma</i><i>Öneri</i><i>İşlem kapalı</i></div></article>').join('')+'</div>';
    host.appendChild(agentsBox);
    const actionBox=document.createElement('section');actionBox.id='spAIActions';actionBox.className='sp-cc-section';
    const pending=(requests.data||[]).filter(r=>r.status==='pending');
    actionBox.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h3 style="margin:0">AI işlem / onay merkezi</h3><small style="opacity:.5">AI önerir; yönetici açıkça onaylar veya reddeder.</small></div><span class="sp-ai-status">Bekleyen '+pending.length+'</span></div><div class="sp-cc-list" style="margin-top:8px">'+(pending.map(r=>{let payload='';try{payload=JSON.stringify(r.payload)}catch{payload=String(r.payload||'')}return '<div class="sp-cc-row"><div class="sp-cc-row-main"><b>'+esc(r.action_type||'AI işlemi')+'</b><small>'+esc([r.target_type,r.target_id].filter(Boolean).join(' · ')||'Genel')+' · '+(r.created_at?new Date(r.created_at).toLocaleString('tr-TR'):'')+'</small><div class="sp-ai-payload">'+esc(payload.slice(0,300))+'</div></div><div class="sp-ai-approval-actions"><button class="ok" data-sp-ai-approve="'+esc(r.id)+'">Onayla</button><button class="no" data-sp-ai-reject="'+esc(r.id)+'">Reddet</button></div></div>'}).join('')||'<div class="sp-cc-empty">Bekleyen AI işlemi yok.</div>')+'</div>';
    host.appendChild(actionBox);
    window.__stagepulseAIRefresh=load;
  }
  async function decide(id,approve){const c=sb();if(!c)throw new Error('Supabase bağlantısı hazır değil.');const r=await c.rpc('approve_ai_action_request',{p_request_id:id,p_approve:approve});if(r.error)throw r.error;toast(approve?'AI işlemi onaylandı.':'AI işlemi reddedildi.');await load()}
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-sp-ai-approve],[data-sp-ai-reject]');if(!b)return;b.disabled=true;try{await decide(b.dataset.spAiApprove||b.dataset.spAiReject,!!b.dataset.spAiApprove)}catch(err){b.disabled=false;toast(err.message||'AI onay işlemi başarısız.',false)}});
  document.addEventListener('click',e=>{if(e.target.closest('[data-sp-tab="ai"]'))setTimeout(load,350)});
  window.addEventListener('hashchange',()=>setTimeout(()=>{if(location.hash==='#command-center')load()},350));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(location.hash==='#command-center')load()},900));
})();