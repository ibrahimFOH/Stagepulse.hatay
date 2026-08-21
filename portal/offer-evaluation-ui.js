/* Stagepulse — Offer Evaluation UI
 * Connect this module to the existing Teklifler view.
 * It expects the existing Supabase client as `window.supabaseClient` or `window.supabase`.
 */
(function () {
  'use strict';

  const state = { offers: [], loading: false };

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  function dateText(value) {
    if (!value) return 'Tarih belirtilmemiş';
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function statusText(status) {
    return ({new:'Yeni',pending:'Bekliyor',evaluating:'Değerlendiriliyor',accepted:'Kabul edildi',rejected:'Reddedildi',cancelled:'İptal',expired:'Süresi doldu'})[status] || status || 'Yeni';
  }

  function card(offer) {
    const evaluating = offer.evaluation_status === 'evaluating';
    const mine = offer.evaluated_by === offer.current_user_id;
    const closed = ['accepted','rejected','cancelled','expired'].includes(offer.status);
    return `
      <article class="sp-offer-card" data-offer-id="${esc(offer.id)}">
        <div class="sp-offer-card__head">
          <div><strong>${esc(offer.quote_number || 'Teklif')}</strong><span class="sp-offer-status">${esc(statusText(offer.status))}</span></div>
          <span class="sp-offer-date">${esc(dateText(offer.event_start_at || offer.event_date))}</span>
        </div>
        <div class="sp-offer-card__body">
          <h3>${esc(offer.company || offer.name || 'Müşteri belirtilmemiş')}</h3>
          <p>${esc(offer.event_type || offer.type || 'Etkinlik')} · ${esc(offer.location || 'Konum belirtilmemiş')}</p>
          ${evaluating ? `<div class="sp-offer-evaluating">🔎 ${mine ? 'Bu teklifi siz değerlendiriyorsunuz.' : `👤 ${esc(offer.evaluator_name || 'Başka bir personel')} değerlendiriyor.`}</div>` : ''}
        </div>
        <div class="sp-offer-actions">
          ${!closed && !evaluating ? '<button type="button" class="sp-btn sp-btn-primary" data-action="evaluate">Değerlendir</button>' : ''}
          ${evaluating && mine ? '<button type="button" class="sp-btn sp-btn-primary" data-action="accept">Kabul Et</button><button type="button" class="sp-btn sp-btn-danger" data-action="reject">Reddet</button>' : ''}
          <button type="button" class="sp-btn sp-btn-secondary" data-action="detail">Detay</button>
        </div>
      </article>`;
  }

  async function rpc(name, args) {
    const client = window.supabaseClient || window.supabase;
    if (!client || typeof client.rpc !== 'function') throw new Error('Supabase istemcisi bulunamadı.');
    const result = await client.rpc(name, args || {});
    if (result.error) throw result.error;
    return result.data;
  }

  async function load(root) {
    state.loading = true;
    root.innerHTML = '<div class="sp-offers-loading">Teklifler yükleniyor…</div>';
    try {
      state.offers = await rpc('staff_incoming_offers', {}) || [];
      root.innerHTML = `<div class="sp-offers-toolbar"><h2>Gelen Teklifler</h2><span>${state.offers.length} teklif</span></div><div class="sp-offers-list">${state.offers.map(card).join('') || '<div class="sp-offers-empty">Bekleyen teklif yok.</div>'}</div>`;
    } catch (error) {
      root.innerHTML = `<div class="sp-offers-error">Teklifler yüklenemedi: ${esc(error.message || error)}</div>`;
    } finally { state.loading = false; }
  }

  async function action(root, button) {
    const item = button.closest('[data-offer-id]');
    if (!item) return;
    const id = item.dataset.offerId;
    const action = button.dataset.action;
    if (action === 'detail') {
      const offer = state.offers.find(x => String(x.id) === String(id));
      if (offer && typeof window.showOfferDetail === 'function') window.showOfferDetail(offer);
      return;
    }
    button.disabled = true;
    try {
      if (action === 'evaluate') await rpc('staff_evaluate_offer', { p_offer_id: id });
      if (action === 'accept') await rpc('staff_offer_response_safe', { p_offer_id: id, p_response: 'accepted', p_note: null });
      if (action === 'reject') await rpc('staff_offer_response_safe', { p_offer_id: id, p_response: 'rejected', p_note: null });
      await load(root);
    } catch (error) {
      window.alert(error.message || 'İşlem gerçekleştirilemedi.');
      button.disabled = false;
    }
  }

  function mount(root) {
    if (!root || root.dataset.spOfferUi === '1') return;
    root.dataset.spOfferUi = '1';
    root.addEventListener('click', e => { const btn = e.target.closest('[data-action]'); if (btn) action(root, btn); });
    load(root);
  }

  window.StagepulseOfferEvaluationUI = { mount, load };
})();
