/* Stagepulse Admin — web + Android offer detail stability v5. */
(() => {
  'use strict';
  const VERSION = '20260831-05';
  const client = () => window.sb || window.__stagepulseAdminClient || window.supabaseClient;
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function installStyle() {
    if (document.getElementById('spOfferFinalFixStyleV5')) return;
    const s = document.createElement('style');
    s.id = 'spOfferFinalFixStyleV5';
    s.textContent = `
      .modal.sp-offer-final-fix { align-items:flex-start !important; padding:12px !important; }
      .modal.sp-offer-final-fix .modal-card { max-height:calc(100dvh - 24px) !important; overflow-y:auto !important; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
      .modal.sp-offer-final-fix input, .modal.sp-offer-final-fix select, .modal.sp-offer-final-fix textarea { touch-action:manipulation; }
    `;
    document.head.appendChild(s);
  }

  async function loadInventory(select) {
    const c = client();
    if (!c || !select || select.dataset.spFinalLoaded === VERSION) return;
    select.dataset.spFinalLoaded = VERSION;
    try {
      const { data, error } = await c.from('equipment').select('id,category,brand,model,quantity,available_quantity,active').eq('active', true).order('category').order('brand').order('model');
      if (error) throw error;
      const rows = data || [];
      const current = select.value;
      select.innerHTML = '<option value="">Ekipman seçin</option>' + rows.map(e => {
        const label = [e.category,e.brand,e.model].filter(Boolean).join(' · ');
        const available = Number.isFinite(Number(e.available_quantity)) ? Number(e.available_quantity) : Number(e.quantity) || 0;
        return `<option value="${esc(e.id)}">${esc(label || 'Ekipman')} — mevcut: ${available}</option>`;
      }).join('');
      if (current) select.value = current;
      if (!rows.length) select.innerHTML = '<option value="">Aktif envanter bulunamadı</option>';
    } catch (e) {
      select.dataset.spFinalLoaded = '';
      select.innerHTML = `<option value="">Envanter yüklenemedi</option>`;
      select.title = e.message || String(e);
    }
  }

  function scan() {
    installStyle();
    const modal = document.getElementById('offerModal');
    if (!modal) return;
    modal.classList.add('sp-offer-final-fix');
    const select = modal.querySelector('#spOfferEqSelect');
    if (select) loadInventory(select);
  }

  function boot() {
    scan();
    const observer = new MutationObserver(() => {
      const modal = document.getElementById('offerModal');
      if (modal && !modal.dataset.spFinalObserverBound) {
        modal.dataset.spFinalObserverBound = '1';
        scan();
      }
    });
    observer.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
