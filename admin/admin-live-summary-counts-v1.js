/* Stagepulse Admin — live organization/equipment totals. */
(() => {
  'use strict';
  const R=window.STAGEPULSE_RUNTIME||{};
  const URL=R.supabaseUrl||'';const KEY=R.supabasePublishableKey||'';
  let client=null,refreshRunning=false;
  function getClient(){if(client)return client;client=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;return client;}
  async function totals(){const c=getClient();if(!c)return null;const [p,e]=await Promise.all([c.from('org_memberships').select('user_id,active',{count:'exact'}),c.from('equipment').select('id,quantity,active')]);if(p.error||e.error)return null;const staff=p.data||[],equipment=(e.data||[]).filter(x=>x.active!==false);return {personnel:staff.filter(x=>x.active===true).length,equipmentRows:equipment.length,equipmentQuantity:equipment.reduce((s,x)=>s+Math.max(0,Number(x.quantity)||0),0)};}
  function setValue(label,value){if(value==null)return;const needle=label.toLocaleLowerCase('tr-TR');document.querySelectorAll('.sp-cc-card,.card,.kpi-card,.metric-card').forEach(card=>{const text=card.querySelector('span,.card-label,.metric-label,.label'),valueEl=card.querySelector('strong,.metric,.value,b');if(!text||!valueEl)return;const t=text.textContent.trim().toLocaleLowerCase('tr-TR');if(t===needle||t.includes(needle))valueEl.textContent=String(value);});}
  async function refresh(){if(refreshRunning)return;refreshRunning=true;try{const t=await totals();if(!t)return;setValue('Personel',t.personnel);setValue('Ekipman',t.equipmentQuantity);setValue('Envanter',t.equipmentQuantity);document.querySelectorAll('[data-sp-live-personnel]').forEach(e=>e.textContent=String(t.personnel));document.querySelectorAll('[data-sp-live-equipment]').forEach(e=>e.textContent=String(t.equipmentQuantity));}finally{refreshRunning=false;}}
  function bind(){if(window.__stagepulseLiveSummaryCountsV4)return;window.__stagepulseLiveSummaryCountsV4=true;refresh();setInterval(refresh,10000);window.addEventListener('hashchange',()=>setTimeout(refresh,150));window.addEventListener('stagepulse-admin-ready',()=>setTimeout(refresh,150));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
