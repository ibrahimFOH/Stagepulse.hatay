(function (global) {
  'use strict';

  var STORAGE_KEY = 'sp_consent';
  var GA_ID = 'G-4BFSFS0SGM';
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
    global.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    if (document.getElementById('sp-google-analytics')) return;
    global.gtag('js', new Date());
    global.gtag('config', GA_ID, { anonymize_ip: true });
    var script = document.createElement('script');
    script.id = 'sp-google-analytics';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(script);
  }

  function removeBanner() { var banner = document.getElementById('cookie-banner'); if (banner) banner.remove(); document.body.classList.remove('has-cookie-banner'); }
  function apply(choice) {
    state = choice;
    try { localStorage.setItem(STORAGE_KEY, choice); } catch (_) {}
    removeBanner();
    if (choice === 'accepted') loadAnalytics();
    else denyAnalytics();
  }
  function denyAnalytics() { global.gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }); }
  function showBanner() {
    if (document.getElementById('cookie-banner')) return;
    var banner = document.createElement('div');
    banner.id = 'cookie-banner'; banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-modal', 'false'); banner.setAttribute('aria-labelledby', 'cookie-title');
    banner.innerHTML = '<div class="cookie-inner"><div><strong id="cookie-title">Çerez tercihleri</strong><p>İsteğe bağlı analitik çerezleri yalnızca izninizle kullanıyoruz. <a href="/Kvkk.html" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a></p></div><div class="cookie-actions"><button type="button" id="cookie-reject" class="btn btn-outline">Reddet</button><button type="button" id="cookie-accept" class="btn btn-primary">Analitiğe izin ver</button></div></div>';
    document.body.appendChild(banner); document.body.classList.add('has-cookie-banner');
    document.getElementById('cookie-accept').addEventListener('click', function () { apply('accepted'); });
    document.getElementById('cookie-reject').addEventListener('click', function () { apply('rejected'); });
  }
  function addResetControl() {
    if (document.getElementById('cookie-preferences-reset')) return;
    var footer = document.querySelector('footer .footer-kvkk') || document.querySelector('footer') || document.body;
    var button = document.createElement('button'); button.type = 'button'; button.id = 'cookie-preferences-reset'; button.textContent = 'Çerez tercihlerini değiştir';
    button.style.cssText = 'border:0;background:transparent;color:#888;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;margin:8px';
    if (footer === document.body) button.style.cssText += ';display:block;margin:18px auto';
    button.addEventListener('click', function () { try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} state = null; denyAnalytics(); showBanner(); setTimeout(function () { document.getElementById('cookie-accept')?.focus(); }, 0); });
    footer.appendChild(button);
  }
  function init() {
    try { state = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (state === 'accepted') loadAnalytics(); else if (state !== 'rejected') showBanner();
    addResetControl();
  }

  global.StagepulseConsent = { init: init, reset: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (_) {} state = null; denyAnalytics(); showBanner(); }, hasAnalyticsConsent: function () { return state === 'accepted'; } };

  /* Public AI fallback: keeps the customer flow useful when the optional LLM key is unavailable. */
  (function installPublicAiFallback() {
    if (global.__spPublicAiFallback) return;
    global.__spPublicAiFallback = true;
    var originalFetch = global.fetch.bind(global);
    global.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/functions/v1/site-ai') === -1) return originalFetch(input, init);
      var body = {};
      try { body = JSON.parse((init && init.body) || '{}'); } catch (_) {}
      return originalFetch(input, init).then(function (response) {
        return response.clone().json().then(function (data) {
          if (!data || data.mode !== 'fallback') return response;
          var message = String(body.message || '').trim();
          var low = message.toLocaleLowerCase('tr-TR');
          var lead = body.lead && typeof body.lead === 'object' ? body.lead : {};
          var missing = [];
          if (!lead.event_type) missing.push('etkinlik türü');
          if (!lead.date) missing.push('tarih');
          if (!lead.city) missing.push('şehir / bölge');
          if (!lead.people) missing.push('tahmini kişi / seyirci');
          if (!lead.services) missing.push('hizmet kapsamı');
          if (!lead.indoor) missing.push('açık alan / kapalı salon');
          var reply;
          if (/merhaba|selam|hello|hey\\b/.test(low)) reply = 'Merhaba — Stagepulse Jarvis. Ses, FOH, ışık ve teklif sürecinde yardımcı olabilirim. ' + (missing.length ? 'Önce ' + missing[0] + ' bilgisini alayım.' : 'Talep bilgilerinizi kontrol edelim.');
          else if (/personel|canlı destek|birisiyle|görüşmek|konuşmak/.test(low)) reply = 'Sizi Stagepulse ekibine yönlendirebilirim. WhatsApp: https://wa.me/905320683012';
          else if (/fiyat|ücret|kaç para|bütçe|teklif|rezervasyon/.test(low)) reply = 'Net fiyat; etkinlik, tarih, şehir, mekan, kapasite ve hizmet kapsamına göre hazırlanır. ' + (missing.length ? 'Eksik bilgi: ' + missing[0] + '.' : 'Talep bilgileriniz tamam. /teklif.html üzerinden devam edebilirsiniz.');
          else if (/foh|miks|mix|tonmaister|tonmeister/.test(low)) reply = 'FOH hizmeti canlı miks, soundcheck/line check ve etkinlik günü operasyonunu kapsar. ' + (missing.length ? 'Planlama için ' + missing[0] + ' bilgisini de alayım.' : 'Talep bilgilerinizi aldım.');
          else if (/ses sistemi|line array|sub|monitor|monitör|hoparlör/.test(low)) reply = 'Ses sistemi kapsamı etkinliğe göre Line Array, Point Source, subwoofer ve monitor çözümlerini içerebilir. ' + (missing.length ? 'Önce ' + missing[0] + ' bilgisini alayım.' : 'Talep bilgilerinizi aldım.');
          else if (/ışık|light|moving|wash|beam|led/.test(low)) reply = 'Sahne ışığı kapsamında Moving Head, Wash, Beam ve LED çözümleri proje bazlı planlanır. ' + (missing.length ? 'Önce ' + missing[0] + ' bilgisini alayım.' : 'Talep bilgilerinizi aldım.');
          else reply = 'Not aldım. Stagepulse; ses sistemi, FOH, sahne ışığı ve teknik etkinlik hizmetleri sunar. ' + (missing.length ? 'Devam etmek için ' + missing[0] + ' bilgisini paylaşabilirsiniz.' : 'Talep bilgilerinizi aldım. /teklif.html üzerinden devam edebilirsiniz.');
          return new Response(JSON.stringify({ reply: reply, mode: 'fallback-local', lead: lead }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
        }).catch(function () { return response; });
      });
    };
  })();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();

  /* Public Jarvis loader: additive only; no HTML rewrite and no internal/admin data. */
  (function loadPublicJarvis() {
    var path = location.pathname || '/';
    if (/^\/admin\//.test(path) || /^\/portal\//.test(path) || path === '/Kvkk.html') return;
    function add() {
      if (!document.getElementById('sp-site-ai-css')) { var css = document.createElement('link'); css.id = 'sp-site-ai-css'; css.rel = 'stylesheet'; css.href = '/site-ai.css?v=20260905-2'; document.head.appendChild(css); }
      if (!document.getElementById('sp-site-ai-js')) { var js = document.createElement('script'); js.id = 'sp-site-ai-js'; js.src = '/site-ai.js?v=20260905-2'; js.async = true; document.head.appendChild(js); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add, { once: true }); else add();
  })();
})(window);