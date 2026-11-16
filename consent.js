/* Stagepulse tekil çerez tercih yöneticisi v2 */
(function (global) {
  'use strict';
  const KEY = 'sp_consent';
  const GA_ID = 'G-4BFSFS0SGM';
  const CONSENT_VERSION = '2';
  let current = null;

  global.dataLayer = global.dataLayer || [];
  global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };
  global.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function readChoice() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === 'accepted') return { version: '1', analytics: true };
      if (raw === 'rejected') return { version: '1', analytics: false };
      const parsed = JSON.parse(raw || 'null');
      return parsed && parsed.version === CONSENT_VERSION ? parsed : null;
    } catch (_) { return null; }
  }

  function updateConsent(enabled) {
    global.gtag('consent', 'update', {
      analytics_storage: enabled ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    if (!enabled) {
      const analyticsScript = document.getElementById('sp-google-analytics');
      if (analyticsScript) analyticsScript.remove();
      return;
    }
    if (document.getElementById('sp-google-analytics')) return;
    global.gtag('js', new Date());
    global.gtag('config', GA_ID, { anonymize_ip: true });
    const script = document.createElement('script');
    script.id = 'sp-google-analytics';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(script);
  }

  function closeBanner() {
    const node = document.getElementById('cookie-banner');
    if (node) node.remove();
    document.body.classList.remove('has-cookie-banner');
  }

  function saveChoice(analytics) {
    current = { version: CONSENT_VERSION, necessary: true, analytics: !!analytics, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch (_) {}
    updateConsent(!!analytics);
    closeBanner();
  }

  function showPreferences() {
    if (document.getElementById('sp-cookie-preferences')) return;
    const panel = document.createElement('div');
    panel.id = 'sp-cookie-preferences';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'sp-cookie-title');
    panel.innerHTML = '<div class="sp-cookie-panel"><h2 id="sp-cookie-title">Çerez tercihleri</h2>' +
      '<p>Zorunlu depolama site ve tercihlerin çalışması için kullanılır. Analitik çerezleri yalnızca izin verirseniz etkinleştirilir.</p>' +
      '<label class="sp-cookie-option"><input type="checkbox" checked disabled> Zorunlu depolama <span>Her zaman etkin</span></label>' +
      '<label class="sp-cookie-option"><input id="sp-analytics-choice" type="checkbox"> Analitik çerezleri <span>İsteğe bağlı</span></label>' +
      '<div class="sp-cookie-actions"><button type="button" id="sp-cookie-cancel" class="btn btn-outline">Vazgeç</button>' +
      '<button type="button" id="sp-cookie-save" class="btn btn-primary">Tercihlerimi kaydet</button></div></div>';
    document.body.appendChild(panel);
    const choice = document.getElementById('sp-analytics-choice');
    if (choice) choice.checked = !!(current && current.analytics);
    document.getElementById('sp-cookie-cancel').addEventListener('click', () => panel.remove());
    document.getElementById('sp-cookie-save').addEventListener('click', () => {
      saveChoice(!!(choice && choice.checked));
      panel.remove();
    });
  }

  function showBanner() {
    if (document.getElementById('cookie-banner')) return;
    const node = document.createElement('section');
    node.id = 'cookie-banner';
    node.setAttribute('role', 'region');
    node.setAttribute('aria-label', 'Çerez tercihleri');
    node.innerHTML = '<div class="cookie-inner"><div><strong>Gizlilik tercihleriniz</strong>' +
      '<p>Zorunlu depolama site işlevleri için kullanılır. Analitik çerezleri yalnızca izninizle etkinleştirilir. ' +
      '<a href="/cerezler.html">Çerez Politikası</a> · <a href="/gizlilik.html">Gizlilik Politikası</a></p></div>' +
      '<div class="cookie-actions"><button type="button" id="cookie-reject" class="btn btn-outline">Tümünü reddet</button>' +
      '<button type="button" id="cookie-manage" class="btn btn-outline">Tercihleri yönet</button>' +
      '<button type="button" id="cookie-accept" class="btn btn-primary">Analitiği kabul et</button></div></div>';
    document.body.appendChild(node);
    document.body.classList.add('has-cookie-banner');
    document.getElementById('cookie-reject').addEventListener('click', () => saveChoice(false));
    document.getElementById('cookie-accept').addEventListener('click', () => saveChoice(true));
    document.getElementById('cookie-manage').addEventListener('click', showPreferences);
  }

  function addResetControl() {
    if (document.getElementById('cookie-preferences-reset') || /^\/(admin|portal)\//.test(location.pathname)) return;
    const button = document.createElement('button');
    button.id = 'cookie-preferences-reset';
    button.type = 'button';
    button.textContent = 'Gizlilik tercihleri';
    button.setAttribute('aria-label', 'Çerez tercihlerini değiştir');
    button.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:9998;border:1px solid #555;background:#111;color:#fff;border-radius:8px;padding:8px 11px;font-size:12px;cursor:pointer';
    button.addEventListener('click', showPreferences);
    document.body.appendChild(button);
  }

  function init() {
    current = readChoice();
    if (current) updateConsent(!!current.analytics);
    else showBanner();
    addResetControl();
  }

  global.StagepulseConsent = {
    init,
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (_) {}
      current = null;
      updateConsent(false);
      showBanner();
    },
    hasAnalyticsConsent: function () { return !!(current && current.analytics); },
    getPreferences: function () { return current ? { necessary: true, analytics: !!current.analytics } : null; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
