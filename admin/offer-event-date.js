/* Stagepulse Admin — event date editor */
(() => {
  const fmt = v => v ? new Date(`${v}T12:00:00`).toLocaleDateString('tr-TR') : '—';
  const escA = v => String(v ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function wrap() {
    const original = window.offersView;
    if (!original || original.__spEventDateWrapped) return;
    const wrapped = async function() {
      await original();
      const {data,error}=await sb.from('teklifler').select('id,quote_number,name,event_date,valid_until,status').order('event_date',{ascending:true,nullsFirst:false});
      if(error) throw error;
      const rows=(data||[]).filter(x=>!['cancelled','archived','expired','rejected'].includes(x.status));
      const html=`<div class="panel" style="margin-top:16px"><div class="panel-head"><div><h3 style="margin:0">Etkinlik tarihi</h3><p class="muted">Geçerlilik tarihi ayrı tutulur.</p></div></div>${rows.map(o=>`<div class="row-item" style="gap:12px;align-items:center"><div class="row-main"><strong>${escA(o.name||o.quote_number||'Teklif')}</strong><span class="muted">${escA(o.quote_number||'')} · Geçerlilik: ${fmt(o.valid_until)}</span></div><input type="date" value="${escA(o.event_date||'')}" data-admin-event="${o.id}" style="max-width:170px"><button class="btn btn-primary" type="button" data-admin-save-event="${o.id}">Kaydet</button></div>`).join('')||'<p class="muted">Aktif teklif yok</p>'}</div>`;
      document.querySelector('#content')?.insertAdjacentHTML('beforeend',html);
      document.querySelectorAll('[data-admin-save-event]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.adminSaveEvent,input=document.querySelector(`[data-admin-event="${id}"]`);if(!input?.value)return toast('Etkinlik tarihi seçin.',false);btn.disabled=true;try{const {data,error}=await sb.rpc('staff_update_offer_event_date',{p_offer_id:id,p_event_date:input.value});if(error)throw error;toast(`Etkinlik tarihi ${fmt(input.value)} olarak güncellendi.`);if(data?.jobs_shifted)toast(`${data.jobs_shifted} bağlı iş tarihi de kaydırıldı.`);await window.loadView('offers')}catch(e){console.error(e);toast(e.message||'Tarih güncellenemedi.',false)}finally{btn.disabled=false}}));
    };
    wrapped.__spEventDateWrapped=true;
    window.offersView=wrapped;
  }
  const wait=setInterval(()=>{if(typeof window.offersView==='function'){clearInterval(wait);wrap()}},50); setTimeout(()=>clearInterval(wait),10000);
})();