(function (global) {
  'use strict';

  var STORAGE_KEY = 'sp_consent';
  var GA_ID = 'G-GVS4022KDJ';
  var state = null;

  global.dataLayer = global.dataLayer || [];
  global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };
  global.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function loadAnalytics() {
    global.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    if (document.getElementById('sp-google-analytics')) return;
    global.gtag('js', new Date());
    global.gtag('config', GA_ID, { anonymize_ip: true });
    var script = document.createElement('script');
    script.id = 'sp-google-analytics';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(script);
  }

  function removeBanner() {
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.remove();
    document.body.classList.remove('has-cookie-banner');
  }

  function apply(choice) {
    state = choice;
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (_) {}
    removeBanner();
    if (choice === 'accepted') loadAnalytics();
    else global.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function denyAnalytics() {
    global.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function showBanner() {
    if (document.getElementById('cookie-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'cookie-title');
    banner.innerHTML =
      '<div class="cookie-inner"><div><strong id="cookie-title">Çerez tercihleri</strong>' +
      '<p>İsteğe bağlı analitik çerezleri yalnızca izninizle kullanıyoruz. ' +
      '<a href="/Kvkk.html" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a></p></div>' +
      '<div class="cookie-actions"><button type="button" id="cookie-reject" class="btn btn-outline">Reddet</button>' +
      '<button type="button" id="cookie-accept" class="btn btn-primary">Analitiğe izin ver</button></div></div>';
    document.body.appendChild(banner);
    document.body.classList.add('has-cookie-banner');
    document.getElementById('cookie-accept').addEventListener('click', function () { apply('accepted'); });
    document.getElementById('cookie-reject').addEventListener('click', function () { apply('rejected'); });
  }

  function addResetControl() {
    if (document.getElementById('cookie-preferences-reset')) return;
    var footer = document.querySelector('footer .footer-kvkk') || document.querySelector('footer') || document.body;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'cookie-preferences-reset';
    button.textContent = 'Çerez tercihlerini değiştir';
    button.style.cssText = 'border:0;background:transparent;color:#888;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;margin:8px';
    if (footer === document.body) button.style.cssText += ';display:block;margin:18px auto';
    button.addEventListener('click', function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      state = null;
      denyAnalytics();
      showBanner();
      setTimeout(function () { document.getElementById('cookie-accept')?.focus(); }, 0);
    });
    footer.appendChild(button);
  }

  function init() {
    try { state = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (state === 'accepted') loadAnalytics();
    else if (state !== 'rejected') showBanner();
    addResetControl();
  }

  global.StagepulseConsent = {
    init: init,
    reset: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      state = null;
      denyAnalytics();
      showBanner();
    },
    hasAnalyticsConsent: function () { return state === 'accepted'; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  /* Public Jarvis loader: additive only; no HTML rewrite and no internal/admin data. */
  (function loadPublicJarvis(){
    var path=location.pathname||'/';
    if(/^\/admin\//.test(path)||/^\/portal\//.test(path)||path==='/Kvkk.html')return;
    function add(){
      if(!document.getElementById('sp-site-ai-css')){var css=document.createElement('link');css.id='sp-site-ai-css';css.rel='stylesheet';css.href='/site-ai.css?v=20260905-1';document.head.appendChild(css);}
      if(!document.getElementById('sp-site-ai-js')){var js=document.createElement('script');js.id='sp-site-ai-js';js.src='/site-ai.js?v=20260905-1';js.async=true;document.head.appendChild(js);}
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',add,{once:true});else add();
  })();
})(window);