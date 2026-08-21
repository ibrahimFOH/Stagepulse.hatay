/* Stagepulse incoming offers UI — live Supabase RPC */
(() => {
  const URL='https://mtjcqqrogjqaxkagwkti.supabase.co';
  const KEY='sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  const client=window.supabase?.createClient(URL,KEY);
  if(!client)return;
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=d=>d?new Date(d).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';
  const toast=(m,ok=true)=>window.toast?window.toast(m,ok):alert(m);
  const permission=async key=>{const {data}=await client.rpc('staff_capability',{p_permission_key:key});return data===true};
  async function render(){
    const {data,error}=await client.rpc('staff_incoming_offers');
    if(error){document.querySelector('#content').innerHTML=`<div class="panel"><b>Teklifler yüklenemedi</b><p class="muted">${esc(error.message)}</p></div>`;return;}
    const canEvaluate=await permission('offer_evaluate');
    const rows=(data||[]).map(o=>{
      const evaluating=o.evaluation_status==='evaluating';
      return `<article class="incoming-offer-card">
        <div class="incoming-offer-top"><div><strong>${esc(o.quote_number||'Teklif')}</strong><div class="muted">${esc(o.name||'')} ${o.company?`· ${esc(o.company)}`:''}</div></div><span class="status">${esc(o.status||'Yeni')}</span></div>
        <div class="incoming-offer-grid"><span>📍 ${esc(o.location||'—')}</span><span>📅 ${esc(fmt(o.event_start_at||o.event_date))}</span><span>⏳ Geçerlilik: ${esc(fmt(o.validity_until))}</span></div>
        <div class="incoming-offer-actions">${evaluating?`<span class="evaluation-badge">🔎 Değerlendiriliyor</span>${o.evaluated_by?`<span class="muted">Kullanıcı: ${esc(o.evaluated_by)}</span>`:''}`:canEvaluate?`<button class="btn btn-primary" data-evaluate="${o.offer_id}">Değerlendir</button>`:'<span class="muted">Değerlendirme yetkiniz yok</span>'}</div>
      </article>`;
    }).join('');
    document.querySelector('#content').innerHTML=`<div class="page-head"><div><h1>Gelen Teklifler</h1><p class="muted">Tüm gelen teklifler · değerlendirmeye alma</p></div></div><div class="incoming-offers-list">${rows||'<div class="panel"><p class="muted">Gelen teklif yok.</p></div>'}</div>`;
    document.querySelectorAll('[data-evaluate]').forEach(btn=>btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='Alınıyor…';
      const {error}=await client.rpc('staff_evaluate_offer',{p_offer_id:btn.dataset.evaluate});
      if(error){toast(error.message,false);btn.disabled=false;btn.textContent='Değerlendir';return;}
      toast('Teklif değerlendirmeye alındı.');render();
    });
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('#sideNav button[data-view="offers"]');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    render();
  },true);
  const style=document.createElement('style');
  style.textContent='.incoming-offers-list{display:grid;gap:12px}.incoming-offer-card{background:var(--panel,#111);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:16px}.incoming-offer-top{display:flex;justify-content:space-between;gap:12px}.incoming-offer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0;color:#c8c8c8;font-size:13px}.incoming-offer-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.evaluation-badge{padding:7px 10px;border-radius:999px;background:rgba(255,180,0,.12);color:#ffd166}@media(max-width:700px){.incoming-offer-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);
})();