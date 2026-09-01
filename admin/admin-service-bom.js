/* Admin Fiyatlandırma: hizmet altına varsayılan malzeme adedi */
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  async function loadBom(serviceId) {
    const { data } = await sb.from('service_equipment_defaults').select('id,equipment_id,quantity,notes').eq('service_id', serviceId);
    return data || [];
  }

  async function ensureBomPanel() {
    const content = document.querySelector('#content');
    if (!content || !/Fiyatlandırma/.test(content.innerHTML || '')) return;
    if (document.querySelector('#spServiceBomPanel')) return;

    const { data: eq } = await sb.from('equipment').select('id,category,brand,model').eq('active', true).order('category');
    const equipment = eq || [];
    const services = window.services || [];
    if (!services.length) return;

    const host = document.createElement('div');
    host.id = 'spServiceBomPanel';
    host.className = 'panel';
    host.style.marginTop = '16px';
    host.innerHTML = `
      <h3>Hizmet malzeme varsayılanları</h3>
      <p class="muted small">Ses / Işık / Truss için işe gidecek tahmini malzeme. Portal fiyat listesinde görünür.</p>
      <div id="spBomRows"></div>
      <div class="actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <label style="flex:1;min-width:140px">Hizmet
          <select id="spBomSvc">${services.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        </label>
        <label style="flex:1;min-width:160px">Ekipman
          <select id="spBomEq">${equipment.map((e) => `<option value="${e.id}">${esc([e.category, e.brand, e.model].filter(Boolean).join(' · '))}</option>`).join('')}</select>
        </label>
        <label>Adet<input id="spBomQty" type="number" min="0.5" step="0.5" value="1" style="width:80px"></label>
        <button type="button" class="btn btn-primary" id="spBomAdd">Ekle</button>
      </div>`;
    content.appendChild(host);

    async function renderList() {
      const svcId = document.querySelector('#spBomSvc')?.value;
      const rows = await loadBom(svcId);
      const box = document.querySelector('#spBomRows');
      if (!box) return;
      box.innerHTML = rows.map((r) => {
        const e = equipment.find((x) => x.id === r.equipment_id);
        const label = e ? [e.category, e.brand, e.model].filter(Boolean).join(' · ') : r.equipment_id;
        return `<div class="price-row" style="gap:8px"><span style="flex:1">${esc(label)}</span><b>× ${num(r.quantity)}</b>
          <button type="button" class="btn btn-danger" data-del="${r.id}">×</button></div>`;
      }).join('') || '<p class="muted small">Bu hizmet için malzeme yok.</p>';
      box.querySelectorAll('[data-del]').forEach((btn) => {
        btn.onclick = async () => {
          await sb.from('service_equipment_defaults').delete().eq('id', btn.dataset.del);
          if (typeof toast === 'function') toast('Silindi');
          renderList();
        };
      });
    }

    document.querySelector('#spBomSvc')?.addEventListener('change', renderList);
    document.querySelector('#spBomAdd')?.addEventListener('click', async () => {
      const service_id = document.querySelector('#spBomSvc')?.value;
      const equipment_id = document.querySelector('#spBomEq')?.value;
      const quantity = num(document.querySelector('#spBomQty')?.value) || 1;
      if (!service_id || !equipment_id) return;
      const { error } = await sb.from('service_equipment_defaults').upsert(
        { service_id, equipment_id, quantity },
        { onConflict: 'service_id,equipment_id' }
      );
      if (error) return typeof toast === 'function' && toast(error.message, false);
      if (typeof toast === 'function') toast('Malzeme eklendi');
      renderList();
    });
    renderList();
  }

  window.addEventListener('load', () => {
    const c = document.querySelector('#content');
    if (c) new MutationObserver(() => setTimeout(ensureBomPanel, 250)).observe(c, { childList: true, subtree: true });
    setTimeout(ensureBomPanel, 600);
  });
})();
