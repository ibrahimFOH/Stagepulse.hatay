/* Stagepulse Admin — unified delete compatibility for Web + Android WebView. */
(() => {
  const getClient = () => {
    try { return typeof sb !== 'undefined' ? sb : null; } catch (_) { return null; }
  };

  function finishOfferDelete(id, ok, message) {
    if (!ok) return window.toast(message || 'Teklif silinemedi.', false);
    window.toast('Teklif silindi');
    document.getElementById('offerModal')?.remove();
    if (typeof window.getOffers === 'function') window.getOffers();
    if (typeof window.loadView === 'function') window.loadView('offers');
  }

  async function performOfferDelete(id) {
    if (!id) return;
    if (window.StagepulseAndroid && typeof window.StagepulseAndroid.deleteOffer === 'function') {
      const expectedId = String(id);
      let handled = false;
      const timeout = window.setTimeout(() => {
        if (!handled) {
          handled = true;
          window.removeEventListener('stagepulse:native-delete-result', handler);
          window.toast('APK silme işlemi zaman aşımına uğradı. İnternet ve oturum bağlantısını kontrol edin.', false);
        }
      }, 20000);
      function handler(event) {
        if (event.detail?.id !== expectedId || handled) return;
        handled = true;
        window.clearTimeout(timeout);
        window.removeEventListener('stagepulse:native-delete-result', handler);
        const detail = event.detail || {};
        finishOfferDelete(id, detail.ok === true, detail.ok ? '' : (detail.response || 'APK üzerinden teklif silinemedi.'));
      }
      window.addEventListener('stagepulse:native-delete-result', handler);
      try {
        const accepted = window.StagepulseAndroid.deleteOffer(expectedId);
        if (accepted === false && !handled) {
          handled = true;
          window.clearTimeout(timeout);
          window.removeEventListener('stagepulse:native-delete-result', handler);
          window.toast('APK oturumu hazır değil. Admin hesabından tekrar giriş yapın.', false);
        }
      } catch (e) {
        handled = true;
        window.clearTimeout(timeout);
        window.removeEventListener('stagepulse:native-delete-result', handler);
        window.toast(e?.message || 'APK silme işlemi başlatılamadı.', false);
      }
      return;
    }

    if (!window.confirm('Kalıcı olarak silinsin mi?')) return;
    const client = getClient();
    if (!client) return window.toast('Supabase bağlantısı hazır değil.', false);
    try {
      const { data, error } = await client.rpc('admin_delete_offer', { p_offer_id: id });
      if (error) {
        console.error('admin_delete_offer:', error);
        return window.toast(error.message || 'Teklif silinemedi.', false);
      }
      finishOfferDelete(id, data === true, data === true ? '' : 'Teklif bulunamadı veya silme yetkisi yok.');
    } catch (e) {
      console.error('Offer delete failed:', e);
      window.toast(e?.message || 'Teklif silinemedi.', false);
    }
  }

  function replayWithoutConfirm(button) {
    if (window.__stagepulseDeleteReplay) return false;
    window.__stagepulseDeleteReplay = true;
    const originalConfirm = window.confirm;
    try {
      window.confirm = () => true;
      button.click();
      return true;
    } finally {
      window.confirm = originalConfirm;
      window.__stagepulseDeleteReplay = false;
    }
  }

  function looksLikeDeleteButton(button) {
    const text = [
      button.textContent,
      button.getAttribute('aria-label'),
      button.getAttribute('title'),
      button.getAttribute('data-action'),
      button.getAttribute('onclick')
    ].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    return /\bsil\b|silme|delete|remove|\bsil\(/i.test(text);
  }

  function install() {
    if (!getClient()) return false;
    if (!window.__stagepulseUnifiedDeleteCapture) {
      document.addEventListener('click', (event) => {
        const button = event.target?.closest?.('button, [role="button"]');
        if (!button || window.__stagepulseDeleteReplay) return;

        const code = button.getAttribute('onclick') || '';
        const offerMatch = code.match(/deleteOffer\(['\"]([^'\"]+)['\"]\)/);
        if (offerMatch) {
          event.preventDefault();
          event.stopImmediatePropagation();
          performOfferDelete(offerMatch[1]);
          return;
        }

        // APK/WebView only: all admin delete buttons across all views bypass
        // browser confirm(), then execute their existing handler unchanged.
        // The normal Web UI keeps its confirmation dialog.
        if (window.StagepulseAndroid && looksLikeDeleteButton(button)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          replayWithoutConfirm(button);
        }
      }, true);
      window.__stagepulseUnifiedDeleteCapture = true;
    }
    window.deleteOffer = performOfferDelete;
    return true;
  }

  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 100);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
