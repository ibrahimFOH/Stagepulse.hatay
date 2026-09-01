/* Stagepulse Admin — personnel operational context. Read-only context layer. */
(() => {
  'use strict';
  const R = window.STAGEPULSE_RUNTIME || {};
  const URL = R.supabaseUrl || window.SUPABASE_URL || '';
  const KEY = R.supabasePublishableKey || window.SUPABASE_KEY || '';
  let client = null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const q=s=>document.querySelector(s);
  function sb(){ if(client)return client; const canonical=window.StagepulseAdminSupabase?.getClient?.()||window.__stagepulseAdminClient||window.sb||window.supabaseClient; if(canonical?.from)return client=canonical; return null; }
  async function count(table){ const c=sb(); if(!c)return 0; const r=await c.from(table).select('*',{count:'exact',head:true}); return r.error?0:(r.count||0); }
  async function load(){
    const c=sb(); if(!c)return;
    const [staff,availability,skills,assignments,vehicleAssignments,tasks]=await Promise.all([
      count('staff_profiles'),count('staff_availability'),count('staff_skills'),count('job_assignments'),count('vehicle_assignments'),count('job_staff')
    ]);
    const root=q('#spPersonnelAdmin'); if(!root)return;
    let panel=q('#spPersonnelOperationalContext');
    if(!panel){ panel=document.createElement('section'); panel.id='spPersonnelOperationalContext'; panel.className='panel sp-poc'; root.insertAdjacentElement('afterbegin',panel); }
    panel.innerHTML=`<div class="sp-poc-head"><div><h3>Personel operasyon bağlamı</h3><p>Personel kaydı artık yalnızca hesap değil; görev, uygunluk, beceri ve saha atamasıyla birlikte yönetilir.</p></div><span class="sp-poc-live">CANLI</span></div><div class="sp-poc-grid">${[['Personel',staff],['Uygunluk kaydı',availability],['Beceri kaydı',skills],['İş ataması',assignments],['Araç ataması',vehicleAssignments],['Personel görevi',tasks]].map(x=>`<div class="sp-poc-card"><strong>${x[1]}</strong><span>${esc(x[0])}</span></div>`).join('')}</div><div class="sp-poc-flow"><span>Profil</span><b>→</b><span>Beceri</span><b>→</b><span>Uygunluk</span><b>→</b><span>İş</span><b>→</b><span>Etkinlik</span><b>→</b><span>Görev</span></div>`;
    if(!q('#spPersonnelOperationalContextStyle')){const s=document.createElement('style');s.id='spPersonnelOperationalContextStyle';s.textContent='.sp-poc{margin-bottom:14px;padding:15px}.sp-poc-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sp-poc-head h3{margin:0 0 5px;font-size:15px}.sp-poc-head p{margin:0;opacity:.55;font-size:11px;max-width:760px}.sp-poc-live{font-size:9px;letter-spacing:.08em;border:1px solid rgba(37,217,153,.25);border-radius:999px;padding:5px 8px;opacity:.8}.sp-poc-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin-top:12px}.sp-poc-card{padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025)}.sp-poc-card strong,.sp-poc-card span{display:block}.sp-poc-card strong{font-size:18px}.sp-poc-card span{font-size:9px;opacity:.5;margin-top:3px}.sp-poc-flow{display:flex;gap:7px;align-items:center;overflow:auto;margin-top:11px;font-size:10px;opacity:.65}.sp-poc-flow span{white-space:nowrap}.sp-poc-flow b{opacity:.4}@media(max-width:760px){.sp-poc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-poc-head{display:block}.sp-poc-live{display:inline-block;margin-top:8px}}';document.head.appendChild(s)}
  }
  let timer; function watch(){clearTimeout(timer);timer=setTimeout(load,350)}
  document.addEventListener('click',e=>{if(e.target.closest('#sideNav [data-view="personnel"],.sp-edit-staff,#spAddStaff'))watch()});
  window.addEventListener('hashchange',()=>{if(location.hash==='#personnel')watch()});
  window.addEventListener('stagepulse-admin-ready',watch); document.addEventListener('DOMContentLoaded',watch);
})();
