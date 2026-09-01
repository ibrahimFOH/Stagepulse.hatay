/* Stagepulse Admin — canonical offer photo attachment editor */
(() => {
  'use strict';
  const state = { offerId: null, bound: null };
  const client = () => window.StagepulseAdminSupabase?.getClient?.() || window.sb || window.supabaseClient;
  const toast = (m, ok = true) => typeof window.toast === 'function' ? window.toast(m, ok) : console[ok ? 'log' : 'error'](m);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const modal = () => document.getElementById('offerModal');
  const card = m => m?.querySelector('.modal-card') || m;
  const offerId = m => m?.dataset.offerId || m?.dataset.spOfferId || m?.querySelector('[data-sp-offer-id]')?.dataset.spOfferId || window.__spLastOfferModalId || window.__spLastOfferId || null;
  const api = () => { const c = client(); if (!c?.rpc || !c?.storage) throw new Error('Admin bağlantısı hazır değil.'); return c; };
  const bucket = 'offer-assets';
  function ensurePanel(m) {
    let p = m.querySelector('#spCanonicalOfferMedia');
    if (p) return p;
    p = document.createElement('section');
    p.id = 'spCanonicalOfferMedia';
    p.className = 'panel';
    p.innerHTML = `<h3>Teklif fotoğrafları</h3><p class="muted small">PDF içinde ve müşteriye gösterilecek görselleri buradan ekleyin. JPG ve PNG doğrudan, WebP ise PDF uyumluluğu için otomatik PNG olarak yüklenir.</p><div class="sp-media-upload"><input id="spOfferMediaFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><button type="button" class="btn btn-primary" id="spOfferMediaUpload">Fotoğrafları yükle</button></div><div id="spOfferMediaStatus" class="muted small" style="margin-top:8px"></div><div id="spOfferMediaGrid" class="sp-media-grid" style="margin-top:12px"></div>`;
    const actions = card(m)?.querySelector('.modal-actions');
    actions ? card(m).insertBefore(p, actions) : card(m)?.appendChild(p);
    p.querySelector('#spOfferMediaUpload').onclick = () => uploadSelected(m);
    return p;
  }
  async function list(m, id) {
    const { data, error } = await api().rpc('admin_get_offer_attachments', { p_offer_id: id });
    if (error) throw error;
    return data || [];
  }
  async function signedUrl(path) {
    const { data, error } = await api().storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data?.signedUrl || '';
  }
  async function render(m, id) {
    const p = ensurePanel(m), grid = p.querySelector('#spOfferMediaGrid'), status = p.querySelector('#spOfferMediaStatus');
    if (!grid) return;
    status.textContent = 'Fotoğraflar yükleniyor…';
    try {
      const items = await list(m, id);
      if (!items.length) grid.innerHTML = '<div class="muted small">Bu teklife henüz fotoğraf eklenmemiş.</div>';
      else {
        grid.innerHTML = items.map(a => `<article class="sp-media-item" data-att-id="${esc(a.id)}"><div class="sp-media-image"><div class="muted small" data-loading>Yükleniyor…</div></div><div class="sp-media-meta"><div class="sp-media-name">${esc(a.file_name)}</div><div class="small muted">${Number(a.size_bytes||0) ? Math.round(Number(a.size_bytes)/1024)+' KB' : ''}</div><div class="sp-media-actions"><button type="button" class="btn" data-visible>${a.customer_visible ? 'Müşteri: Açık' : 'Müşteri: Kapalı'}</button><button type="button" class="btn btn-danger" data-delete>Sil</button></div></div></article>`).join('');
        for (const a of items) {
          const url = await signedUrl(a.storage_path).catch(() => '');
          const item = grid.querySelector(`[data-att-id="${a.id}"]`);
          if (!item) continue;
          const box = item.querySelector('.sp-media-image');
          if (url) box.innerHTML = `<img class="sp-media-thumb" src="${esc(url)}" alt="${esc(a.file_name)}" loading="lazy">`;
          else box.innerHTML = '<div class="form-error small">Önizleme alınamadı.</div>';
          item.querySelector('[data-visible]').onclick = async () => {
            const c = api();
            const r = await c.rpc('admin_set_offer_attachment_visibility', { p_attachment_id: a.id, p_visible: !a.customer_visible });
            if (r.error) return toast(r.error.message || String(r.error), false);
            await render(m, id);
            window.stagepulseRegenerateOfferPdf?.(id);
          };
          item.querySelector('[data-delete]').onclick = async () => {
            if (!confirm(`“${a.file_name}” silinsin mi?`)) return;
            const c = api();
            const r = await c.rpc('admin_delete_offer_attachment', { p_attachment_id: a.id });
            if (r.error) return toast(r.error.message || String(r.error), false);
            await c.storage.from(bucket).remove([a.storage_path]);
            toast('Fotoğraf silindi.');
            await render(m, id);
            window.stagepulseRegenerateOfferPdf?.(id);
          };
        }
      }
      status.textContent = `${items.length} fotoğraf`;
    } catch (e) { status.textContent = ''; grid.innerHTML = `<div class="form-error">${esc(e.message || e)}</div>`; }
  }
  async function normalizeForPdf(file) {
    if (file.type !== 'image/webp') return file;
    let source;
    if (typeof createImageBitmap === 'function') source = await createImageBitmap(file);
    else {
      const url = URL.createObjectURL(file);
      try {
        source = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('WebP görseli açılamadı.'));
          image.src = url;
        });
      } finally { URL.revokeObjectURL(url); }
    }
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('WebP dönüştürme başlatılamadı.');
    context.drawImage(source, 0, 0);
    if (typeof source.close === 'function') source.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('WebP, PNG biçimine dönüştürülemedi.');
    return new File([blob], file.name.replace(/\.webp$/i, '') + '.png', { type:'image/png', lastModified:file.lastModified });
  }
  async function uploadSelected(m) {
    const id = offerId(m), p = ensurePanel(m), input = p.querySelector('#spOfferMediaFiles');
    if (!id || !input?.files?.length) return toast('Önce fotoğraf seçin.', false);
    const files = [...input.files].filter(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
    if (!files.length) return toast('JPG, PNG veya WebP dosyası seçin.', false);
    const c = api(), status = p.querySelector('#spOfferMediaStatus');
    let done = 0;
    for (const originalFile of files) {
      try {
        const file = await normalizeForPdf(originalFile);
        const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-90) || 'image';
        const path = `${id}/${crypto.randomUUID()}-${safe}`;
        const up = await c.storage.from(bucket).upload(path, file, { upsert:false, contentType:file.type, cacheControl:'3600' });
        if (up.error) throw up.error;
        const reg = await c.rpc('admin_register_offer_attachment', { p_offer_id:id, p_storage_path:path, p_file_name:file.name, p_mime_type:file.type, p_size_bytes:file.size, p_sort_order:999, p_customer_visible:true });
        if (reg.error) { await c.storage.from(bucket).remove([path]); throw reg.error; }
        done++;
        status.textContent = `${done}/${files.length} fotoğraf yüklendi…`;
      } catch (e) { toast(`${originalFile.name}: ${e.message || e}`, false); }
    }
    input.value = '';
    toast(done ? `${done} fotoğraf eklendi.` : 'Fotoğraf yüklenemedi.', !!done);
    await render(m, id);
    window.stagepulseRegenerateOfferPdf?.(id);
  }
  function bind() {
    const m = modal();
    if (!m || m.classList.contains('is-hidden')) { state.offerId = null; return; }
    const id = offerId(m); if (!id) return;
    if (state.offerId !== id) { state.offerId = id; state.bound = null; }
    const p = ensurePanel(m);
    if (state.bound !== id) { state.bound = id; render(m, id); }
  }
  function watch() {
    bind();
    const root = document.getElementById('content') || document.body;
    new MutationObserver(() => bind()).observe(root, { childList:true, subtree:true });
    window.addEventListener('stagepulse-admin-ready', bind);
    window.addEventListener('hashchange', () => setTimeout(bind, 80));
    setInterval(bind, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once:true }); else watch();
})();
