/* Stagepulse — canonical offer evaluation UI */
(function () {
  'use strict';

  const state = { offers: [], currentUserId: null, loading: false };

  function client() {
    const c = window.supabaseClient || window.supabase;
    if (!c || typeof c.from !== 'function' || typeof c.rpc !== 'function') throw new Error('Supabase istemcisi bulunamadı.');
    return c;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  function dateText(value) {
    if (!value) return 'Tarih belirtilmemiş';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? esc(value) : new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  }

  function statusText(status) {
    return ({new:'Yeni',reviewing:'İnceleniyor',preparing:'Hazırlanıyor',sent:'Gönderildi',accepted:'Kabul edildi',rejected:'Reddedildi',cancelled:'İptal',expired:'Süresi doldu'})[status] || status || 'Yeni';
  }

  function card(offer) {
    const evaluating = offer.evaluation_status === 'evaluating';
    const mine = offer.evaluated_by === state.currentUserId;
    const closed = ['accepted','rejected','cancelled','expired'].includes(offer.status);
    const lockedByOther = evaluating && !mine;
    return `
      <article class="sp-offer-card" data-offer-id="${esc(offer.id)}">
        <div class="sp-offer-card__head">
          <div><strong>${esc(offer.quote_number || 'Teklif')}</strong><span class="sp-offer-status">${esc(statusText(offer.status))}</span></div>
          <span class="sp-offer-date">${esc(dateText(offer.event_start_at || offer.event_date))}</span>
        </div>
        <div class="sp-offer-card__body">
          <h3>${esc(offer.company || offer.name || 'Müşteri belirtilmemiş')}</h3>
          <p>${esc(offer.event_type || offer.type || 'Etkinlik')} · ${esc(offer.location || 'Konum belirtilmemiş')}</p>
          ${evaluating ? `<div class="sp-offer-evaluating">🔎 ${mine ? 'Bu teklifi siz değerlendiriyorsunuz.' : 'Başka bir personel değerlendiriyor.'}</div>` : ''}
        </div>
        <div class="sp-offer-actions">
          ${!closed && !evaluating ? '<button type="button" class="sp-btn sp-btn-primary" data-action="evaluate">Değerlendir</button>' : ''}
          ${evaluating && mine ? '<button type="button" class="sp-btn sp-btn-primary" data-action="accept">Kabul Et</button><button type="button" class="sp-btn sp-btn-danger" data-action="reject">Reddet</button>' : ''}
          ${lockedByOther ? '<span class="muted">Değerlendirme kilitli</span>' : ''}
          <button type="button" class="sp-btn sp-btn-secondary" data-action="detail">Detay</button>
        </div>
      </article>`;
  }

  async function load(root) {
    state.loading = true;
    root.innerHTML = '<div class="sp-offers-loading">Teklifler yükleniyor…</div>';
    try {
      const c = client();
      const [{ data: userData }, { data, error }] = await Promise.all([
        c.auth.getUser(),
        c.from('teklifler').select('*').order('created_at', { ascending: false })
      ]);
      if (error) throw error;
      state.currentUserId = userData?.user?.id || null;
      state.offers = data || [];
      root.innerHTML = `<div class="sp-offers-toolbar"><h2>Gelen Teklifler</h2><span>${state.offers.length} teklif</span></div><div class="sp-offers-list">${state.offers.map(card).join('') || '<div class="sp-offers-empty">Gelen teklif yok.</div>'}</div>`;
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
      const c = client();
      if (action === 'evaluate') {
        await c.rpc('offer_claim_for_review', { p_offer_id: id });
      } else if (action === 'accept' || action === 'reject') {
        const note = window.prompt(action === 'accept' ? 'Kabul notu (opsiyonel):' : 'Red notu (opsiyonel):', '') || null;
        await c.rpc('offer_evaluate', {
          p_offer_id: id,
          p_status: action === 'accept' ? 'accepted' : 'rejected',
          p_note: note
        });
      }
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
