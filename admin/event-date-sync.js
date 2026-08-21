/* Stagepulse Admin — event date sync */
(() => {
  const URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
  const KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
  const client = window.supabase?.createClient(URL, KEY);
  if (!client) return;

  let lastOfferId = null;
  let originalSaveOffer = null;

  async function getOffer(id) {
    const { data, error } = await client.from('teklifler').select('id,event_date').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  function addDateField(modal, offer) {
    if (!modal || !offer || modal.querySelector('#editEventDate')) return;
    const validity = modal.querySelector('#editValid');
    const label = document.createElement('label');
    label.innerHTML = 'Etkinlik tarihi<input type="date" id="editEventDate" value="' + String(offer.event_date || '') + '">';
    if (validity?.closest('label')) validity.closest('label').before(label);
    else modal.querySelector('.panel')?.appendChild(label);
  }

  async function enhanceModal() {
    const modal = document.getElementById('offerModal');
    if (!modal || modal.dataset.eventDateReady === '1') return;
    const match = modal.querySelector('[onclick*="saveOffer(\'"]');
    const onclick = match?.getAttribute('onclick') || '';
    const m = onclick.match(/saveOffer\('([^']+)'\)/);
    const id = m?.[1];
    if (!id) return;
    try {
      const offer = await getOffer(id);
      addDateField(modal, offer);
      modal.dataset.eventDateReady = '1';
      lastOfferId = id;
    } catch (e) {
      console.error('event date load', e);
    }
  }

  function installSaveWrapper() {
    if (typeof window.saveOffer !== 'function' || window.saveOffer.__eventDateWrapped) return;
    originalSaveOffer = window.saveOffer;
    const wrapped = async function(id) {
      const input = document.getElementById('editEventDate');
      let changed = false;
      if (input?.value) {
        try {
          const current = await getOffer(id);
          changed = current?.event_date !== input.value;
          if (changed) {
            const { error } = await client.rpc('staff_update_offer_event_date', {
              p_offer_id: id,
              p_event_date: input.value
            });
            if (error) throw error;
          }
        } catch (e) {
          const toastFn = window.toast;
          if (typeof toastFn === 'function') toastFn(e.message || 'Etkinlik tarihi değiştirilemedi.', false);
          else alert(e.message || 'Etkinlik tarihi değiştirilemedi.');
          return;
        }
      }
      await originalSaveOffer(id);
      if (changed) {
        const toastFn = window.toast;
        if (typeof toastFn === 'function') toastFn('Etkinlik tarihi güncellendi; bağlı işler yeni tarihe taşındı.');
      }
    };
    wrapped.__eventDateWrapped = true;
    window.saveOffer = wrapped;
  }

  const observer = new MutationObserver(() => {
    enhanceModal();
    installSaveWrapper();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => {
    installSaveWrapper();
    enhanceModal();
  });
})();