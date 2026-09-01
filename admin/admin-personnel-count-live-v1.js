/* Stagepulse Admin — live organization member count */
(() => {
  'use strict';
  const R=window.STAGEPULSE_RUNTIME||{};
  const URL=R.supabaseUrl||''; const KEY=R.supabasePublishableKey||'';
  let client=null;
  function getClient(){if(client)return client;client=window.StagepulseAdminSupabase?.getClient?.()||window.sb||window.supabase?.createClient?.(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}})||null;return client;}
  async function getPersonnelCount(){const c=getClient();if(!c)return null;const {count,error}=await c.from('org_memberships').select('user_id',{count:'exact',head:true}).eq('active',true);if(error){console.warn('Stagepulse personnel count:',error.message);return null;}return Number(count||0)}
  function setCommandCenterCount(count){document.querySelectorAll('.sp-cc-card').forEach(card=>{const label=card.querySelector('span'),value=card.querySelector('strong');if(label&&value&&label.textContent.trim()==='Personel')value.textContent=String(count)})}
  async function refresh(){const count=await getPersonnelCount();if(count!=null)setCommandCenterCount(count)}
  function bind(){refresh();setInterval(refresh,10000);window.addEventListener('hashchange',()=>setTimeout(refresh,150));window.addEventListener('stagepulse-admin-ready',()=>setTimeout(refresh,150));const content=document.getElementById('content');if(content)new MutationObserver(()=>{if(location.hash==='#command-center')refresh()}).observe(content,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
