/* Stagepulse Personel Portal — operational modules */
(() => {
  const fmtDate = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('tr-TR') : '—';
  const escLocal = (v) => String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const moneyLocal = (v) => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const can = (key) => typeof window.can === 'function' && window.can(key);
  const toastLocal = (msg, ok=true) => typeof window.toast === 'function' ? window.toast(msg, ok) : alert(msg);
  async function eventDatePanel() {
    if (!can('offers.manage') && !can('schedule.manage')) return '';
    const { data, error } = await sb.from('teklifler').select('id,quote_number,name,event_date,status,valid_until').in('status',['new','reviewing','preparing','sent','accepted']).order('event_date',{ascending:true,nullsFirst:false});
    if (error) throw error;
    if (!(data||[]).length) return '';
    return `<div class="panel" style="margin-top:16px"><div class="panel-head"><div><h3 style="margin:0">Etkinlik tarihi</h3><p class="muted">Teklif geçerlilik tarihiyle aynı değildir.</p></div></div>${data.map(o=>`<div class="row-item" style="gap:12px;align-items:center"><div class="row-main"><strong>${escLocal(o.name||o.quote_number||'Teklif')}</strong><span class="muted">${escLocal(o.quote_number||'')} · Geçerlilik: ${fmtDate(o.valid_until)}</span></div><label style="display:flex;align-items:center;gap:8px">${fmtDate(o.event_date)}<input type="date" value="${escLocal(o.event_date||'')}" data-sp-event-offer="${o.id}" style="max-width:160px"></label><button class="btn btn-primary" type="button" data-sp-save-event="${o.id}">Kaydet</button></div>`).join('')}</div>`;
  }
  function enhanceOffersView() {
    const original = window.__spOriginalOffersView || window.offersView;
    if (!original || original.__spWrapped) return;
    window.__spOriginalOffersView = original;
    const wrapped = async function() {
      await original();
      const panel = await eventDatePanel();
      if (!panel) return;
      document.querySelector('#content')?.insertAdjacentHTML('beforeend', panel);
      document.querySelectorAll('[data-sp-save-event]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.spSaveEvent, input = document.querySelector(`[data-sp-event-offer="${id}"]`);
        if (!input?.value) return toastLocal('Etkinlik tarihi seçin.', false);
        btn.disabled = true;
        try { const {data,error}=await sb.rpc('staff_update_offer_event_date',{p_offer_id:id,p_event_date:input.value}); if(error) throw error; toastLocal(`Etkinlik tarihi ${fmtDate(input.value)} olarak güncellendi.`); if(data?.jobs_shifted) toastLocal(`${data.jobs_shifted} bağlı iş tarihi de kaydırıldı.`); if(typeof window.loadView==='function') await window.loadView('offers'); }
        catch(e){ console.error(e); toastLocal(e.message||'Tarih güncellenemedi.',false); }
        finally{ btn.disabled=false; }
      }));
    };
    wrapped.__spWrapped = true;
    window.offersView = wrapped;
  }
  window.analyticsView = async function() {
    const [{data:offers,error:oe},{data:jobs,error:je}] = await Promise.all([sb.from('offers_staff').select('status,event_date,agreed_amount'),sb.from('my_jobs_staff').select('status,event_at')]);
    if(oe) throw oe; if(je) throw je;
    const accepted=(offers||[]).filter(x=>x.status==='accepted');
    const counts=['new','sent','accepted','rejected','cancelled'].map(s=>[s,(offers||[]).filter(x=>x.status===s).length]);
    document.querySelector('#content').innerHTML=`<div class="page-head"><div><h1>Analitik</h1><p class="muted">Personelin erişebildiği operasyon verileri</p></div></div><div class="cards"><div class="card"><span class="card-label">Teklif</span><div class="metric">${(offers||[]).length}</div></div><div class="card"><span class="card-label">Kabul</span><div class="metric">${accepted.length}</div></div><div class="card"><span class="card-label">Atanmış iş</span><div class="metric">${(jobs||[]).length}</div></div><div class="card"><span class="card-label">Kabul tutarı</span><div class="metric">${moneyLocal(accepted.reduce((a,x)=>a+Number(x.agreed_amount||0),0))}</div></div></div><div class="panel" style="margin-top:16px"><h3>Teklif durumları</h3>${counts.map(([s,n])=>`<div class="row-item"><strong>${escLocal(s)}</strong><span class="status">${n}</span></div>`).join('')}</div>`;
  };
  window.activityView = async function() {
    const {data,error}=await sb.from('activity_logs').select('id,action,entity_type,entity_id,metadata,created_at').order('created_at',{ascending:false}).limit(100); if(error) throw error;
    document.querySelector('#content').innerHTML=`<div class="page-head"><div><h1>Aktivite</h1><p class="muted">Son sistem işlemleri</p></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Tarih</th><th>İşlem</th><th>Alan</th><th>Detay</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('tr-TR')}</td><td><strong>${escLocal(x.action)}</strong></td><td>${escLocal(x.entity_type)}</td><td>${escLocal(JSON.stringify(x.metadata||{}))}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">Aktivite yok</td></tr>'}</tbody></table></div></div>`;
  };
  window.notificationsView = async function() {
    const {data,error}=await sb.from('notifications').select('id,kind,title,body,offer_id,read_at,created_at').order('created_at',{ascending:false}).limit(50); if(error) throw error;
    document.querySelector('#content').innerHTML=`<div class="page-head"><div><h1>Bildirimler</h1><p class="muted">Sistem bildirimleri</p></div></div><div class="panel">${(data||[]).map(x=>`<div class="row-item"><div class="row-main"><strong>${escLocal(x.title||x.kind||'Bildirim')}</strong><span class="muted">${escLocal(x.body||'')}</span></div><span class="status">${new Date(x.created_at).toLocaleString('tr-TR')}</span></div>`).join('')||'<p class="muted">Bildirim yok</p>'}</div>`;
  };
  window.settingsView = async function() {
    const {data,error}=await sb.rpc('get_my_staff_profile'); if(error) throw error; const p=data||{};
    document.querySelector('#content').innerHTML=`<div class="page-head"><div><h1>Ayarlar</h1><p class="muted">Personel hesabı</p></div></div><div class="panel"><div class="cards"><div class="card"><span class="card-label">Ad Soyad</span><div class="metric" style="font-size:18px">${escLocal(p.display_name||'—')}</div></div><div class="card"><span class="card-label">Rol</span><div class="metric" style="font-size:18px">${escLocal(p.role||'—')}</div></div><div class="card"><span class="card-label">Telefon</span><div class="metric" style="font-size:18px">${escLocal(p.phone||'—')}</div></div></div></div>`;
  };
  const wait=setInterval(()=>{if(typeof window.offersView==='function'){clearInterval(wait);enhanceOffersView();}},50); setTimeout(()=>clearInterval(wait),10000);
})();