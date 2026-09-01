/* Fiyat listesi: kuralları doğru formatla + hizmet malzeme satırları */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const money = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(v) || 0);
  const fmtRule = (r) => {
    const t = r.rule_type || '';
    const v = Number(r.rule_value != null ? r.rule_value : r.base_price) || 0;
    if (t === 'percent' || /marj|mesai|yüzde/i.test(r.name || '')) return `%${v}`;
    if (t === 'per_km' || /km/i.test(r.name || '')) return `${money(v)} / km`;
    if (t === 'per_person' || /kişi başı/i.test(r.name || '')) return `${money(v)} / kişi (ekip)`;
    if (/ekip sayısı/i.test(r.name || '')) return `${v} kişi`;
    return money(v);
  };

  const orig = window.pricingView;
  window.pricingView = async function pricingViewLive() {
    if (typeof can === 'function' && !can('pricing') && !can('pricing.view')) {
      const el = document.querySelector('#content');
      if (el) el.innerHTML = '<div class="panel"><b>Erişim yok</b><p class="muted">Fiyat listesi için yetki gerekli.</p></div>';
      return;
    }
    let rows = [], bom = [];
    try {
      const { data, error } = await sb.from('pricing_staff').select('*').order('sort_order');
      if (error) throw error;
      rows = data || [];
    } catch (e) {
      if (typeof orig === 'function') return orig();
      const el = document.querySelector('#content');
      if (el) el.innerHTML = `<div class="panel"><b>Hata</b><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    try {
      const { data } = await sb.from('service_bom_staff').select('*');
      bom = data || [];
    } catch (_) {}

    const services = rows.filter((r) => r.kind === 'service');
    const rules = rows.filter((r) => r.kind === 'rule');
    const allServices = services.length ? services : rows;
    const allRules = rules.length ? rules : [];

    const bomBySvc = {};
    for (const b of bom) (bomBySvc[b.service_id] = bomBySvc[b.service_id] || []).push(b);

    const svcRows = allServices.map((r) => {
      const mats = bomBySvc[r.id] || [];
      const matHtml = mats.length
        ? `<div class="muted small" style="margin-top:4px">${mats.map((m) => `${esc([m.category, m.brand, m.model].filter(Boolean).join(' · '))}: <b>${Number(m.quantity)}</b>`).join(' · ')}</div>`
        : '';
      return `<tr><td><strong>${esc(r.name)}</strong>${matHtml}</td><td class="muted">${esc(r.description || '—')}</td><td><b>${money(r.base_price)}</b></td></tr>`;
    }).join('');

    const ruleRows = allRules.map((r) =>
      `<tr><td><strong>${esc(r.name)}</strong></td><td class="muted">${esc(r.description || '—')}</td><td>${fmtRule(r)}</td></tr>`
    ).join('');

    const el = document.querySelector('#content');
    if (!el) return;
    el.innerHTML = `
      <div class="page-head"><div><h1>Fiyat listesi</h1>
        <p class="muted">Admin değişince otomatik yenilenir · malzeme hizmet altında</p></div>
        <button type="button" class="btn" id="spPricingRefresh">Yenile</button>
      </div>
      <div class="panel" style="margin-bottom:14px"><h3 style="margin:0 0 10px">Hizmetler</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Hizmet</th><th>Açıklama / malzeme</th><th>Satış</th></tr></thead>
        <tbody>${svcRows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">Hizmet yok</td></tr>'}</tbody></table></div>
      </div>
      <div class="panel"><h3 style="margin:0 0 10px">Kurallar</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Kural</th><th>Not</th><th>Değer</th></tr></thead>
        <tbody>${ruleRows || '<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">Kural yok veya migration bekleniyor</td></tr>'}</tbody></table></div>
        <p class="muted small" style="margin-top:10px">Kâr marjı yüzde. Kişi başı = ekip ücreti (seyirci değil).</p>
      </div>`;
    document.querySelector('#spPricingRefresh')?.addEventListener('click', () => window.pricingView());
  };
})();
