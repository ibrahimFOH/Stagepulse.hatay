/* Stagepulse Admin — canonical dashboard renderer.
 * Replaces stale/legacy dashboard content and uses the current Supabase client.
 */
(() => {
  'use strict';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v) => Number(v) || 0;
  const money = (v) => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }).format(num(v));
  const client = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;

  async function read(table, select='*') {
    const c = client();
    if (!c) throw new Error('Supabase bağlantısı hazır değil.');
    const { data, error } = await c.from(table).select(select);
    if (error) throw error;
    return data || [];
  }

  function rowOffer(o) {
    const status = {new:'Yeni',reviewing:'İnceleniyor',preparing:'Hazırlanıyor',sent:'Gönderildi',accepted:'Kabul',rejected:'Red',cancelled:'İptal',archived:'Arşiv',expired:'Süresi doldu'}[o.status] || o.status || '—';
    return `<div class="row-item"><div class="row-main"><strong>${esc(o.quote_number || 'Teklif')}</strong><span class="muted">${esc(o.name || '')} · ${esc(o.location || '-')} · ${esc(o.event_date || '-')}</span></div><div class="row-side"><span class="status ${esc(o.status || '')}">${esc(status)}</span><span class="row-price">${money(o.total)}</span><button class="btn" type="button" data-dashboard-offer="${esc(o.id)}">Aç</button></div></div>`;
  }

  function renderError(error) {
    const c = document.getElementById('content');
    if (!c) return;
    c.innerHTML = `<div class="notice"><b>Genel Bakış yüklenemedi</b><p>${esc(error?.message || error || 'Bilinmeyen hata')}</p><p class="muted">Supabase bağlantısı veya bu hesabın erişim kapsamı kontrol edilmeli.</p></div>`;
  }

  async function dashboard() {
    const c = document.getElementById('content');
    if (!c) return;
    c.replaceChildren();
    try {
      const [offers, settlements] = await Promise.all([
        read('teklifler','*'),
        read('settlements','*')
      ]);
      const active = settlements.filter(s => s.status !== 'cancelled');
      const agreed = active.reduce((a,s)=>a+num(s.agreed_amount),0);
      const expense = active.reduce((a,s)=>a+num(s.expense_amount),0);
      const ownerRevenue = active.reduce((a,s)=>a+num(s.owner_revenue ?? (num(s.agreed_amount)*num(s.owner_pct)/100)),0);
      const ownerProfit = active.reduce((a,s)=>a+num(s.owner_share),0);
      const supplier = active.reduce((a,s)=>a+num(s.supplier_share),0);
      const potential = offers.filter(x=>!['archived','cancelled','expired','rejected'].includes(x.status)).reduce((a,x)=>a+num(x.total ?? x.estimated_price),0);
      const revenue = offers.filter(x=>x.status==='accepted').reduce((a,x)=>a+num(x.total),0);

      c.innerHTML = `<div class="page-head"><div><h1>Genel Bakış</h1><p class="muted">Tüm operasyon tek ekranda</p></div><div class="actions"><button class="btn btn-primary" type="button" data-dashboard-new-offer>+ Teklif</button><button class="btn" type="button" data-dashboard-settlements>Gelir · Gider</button></div></div>
      <div class="cards">
        <div class="card kpi-accent"><span class="card-label">Yeni lead</span><div class="metric">${offers.filter(x=>x.status==='new').length}</div></div>
        <div class="card"><span class="card-label">Potansiyel teklif</span><div class="metric">${money(potential)}</div></div>
        <div class="card"><span class="card-label">Kabul ciro</span><div class="metric">${money(revenue)}</div></div>
        <div class="card"><span class="card-label">Senin ciro</span><div class="metric">${money(ownerRevenue)}</div></div>
        <div class="card"><span class="card-label">Senin kârın</span><div class="metric">${money(ownerProfit)}</div></div>
      </div>
      <div class="grid2" style="margin-top:16px">
        <div class="panel"><div class="panel-head"><h3>Son teklifler</h3><button class="btn" type="button" data-dashboard-offers>Tümü</button></div>${offers.slice(0,8).map(rowOffer).join('') || '<p class="muted empty">Teklif yok</p>'}</div>
        <div class="panel"><div class="panel-head"><h3>Gelir · Gider özeti</h3><button class="btn" type="button" data-dashboard-settlements>Aç</button></div><div class="settle-kpi"><div><span>Anlaşılan</span><b>${money(agreed)}</b></div><div><span>Gider</span><b>${money(expense)}</b></div><div><span>Senin ciro</span><b class="ok">${money(ownerRevenue)}</b></div><div><span>Senin kârın</span><b class="ok">${money(ownerProfit)}</b></div><div><span>Diğer pay</span><b>${money(supplier)}</b></div></div>${active.slice(0,5).map(s=>`<div class="row-item"><div class="row-main"><strong>${esc(s.title || 'Mutabakat')}</strong><span class="muted">${esc(s.event_date || '-')} · ${esc(s.location || '-')}</span></div><div class="row-side"><span class="status ${esc(s.status || '')}">${esc(s.status || 'Açık')}</span><span class="row-price">${money(s.agreed_amount)}</span></div></div>`).join('') || '<p class="muted empty">Gelir/gider kaydı yok</p>'}</div>
      </div>`;

      c.querySelectorAll('[data-dashboard-offer]').forEach(b => b.addEventListener('click',()=>window.openOffer?.(b.dataset.dashboardOffer)));
      c.querySelectorAll('[data-dashboard-new-offer]').forEach(b => b.addEventListener('click',()=>window.newOffer?.()));
      c.querySelectorAll('[data-dashboard-offers]').forEach(b => b.addEventListener('click',()=>window.loadView?.('offers')));
      c.querySelectorAll('[data-dashboard-settlements]').forEach(b => b.addEventListener('click',()=>window.loadView?.('settlements')));
    } catch (e) { renderError(e); }
  }

  window.dashboard = dashboard;
  window.StagepulseAdminDashboard = { render: dashboard };
})();
