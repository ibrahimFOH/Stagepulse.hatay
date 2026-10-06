/* Stagepulse consent + recovery router */
(function () {
  'use strict';
  try {
    const hash = window.location.hash || '';
    const type = new URLSearchParams(hash.replace(/^#/, '')).get('type');
    if (type === 'recovery') {
      window.location.replace('/jarvis/admin/' + window.location.search + hash);
      return;
    }
  } catch (_) {}
})(function (global) {
  'use strict';
  const KEY = 'sp_consent';
  const GA = 'G-4BFSFS0SGM';
  let state = null;
  global.dataLayer = global.dataLayer || [];
  global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };
  global.gtag('consent', 'default', {analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});

  function analytics() {
    global.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    if (document.getElementById('sp-google-analytics')) return;
    global.gtag('js',new Date());
    global.gtag('config',GA,{anonymize_ip:true});
    const script=document.createElement('script');
    script.id='sp-google-analytics';
    script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(GA);
    document.head.appendChild(script);
  }

  function deny() {
    global.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  }

  function removeBanner() {
    const banner=document.getElementById('cookie-banner');
    if (banner) banner.remove();
    document.body.classList.remove('has-cookie-banner');
  }

  function apply(value) {
    state=value;
    try { localStorage.setItem(KEY,value); } catch (_) {}
    removeBanner();
    if (value==='accepted') analytics(); else deny();
  }

  function banner() {
    if (document.getElementById('cookie-banner')) return;
    const banner=document.createElement('div');
    banner.id='cookie-banner';
    banner.setAttribute('role','dialog');
    banner.setAttribute('aria-label','Çerez tercihleri');
    banner.innerHTML='<div class="cookie-inner"><div><strong>Çerez tercihleri</strong><p>İsteğe bağlı analitik çerezleri yalnızca izninizle kullanıyoruz. <a href="/Kvkk.html" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a></p></div><div class="cookie-actions"><button type="button" id="cookie-reject" class="btn btn-outline" data-cookie-action="reject">Reddet</button><button type="button" id="cookie-accept" class="btn btn-primary" data-cookie-action="accept">Kabul Et</button></div></div>';
    document.body.appendChild(banner);
    document.body.classList.add('has-cookie-banner');
    const accept=document.getElementById('cookie-accept');
    const reject=document.getElementById('cookie-reject');
    if (accept) accept.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();apply('accepted');},{once:true});
    if (reject) reject.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();apply('rejected');},{once:true});
  }

  function addResetControl() {
    if (document.getElementById('cookie-preferences-reset') || location.pathname.startsWith('/admin/') || location.pathname.startsWith('/portal/')) return;
    const button=document.createElement('button');
    button.id='cookie-preferences-reset';
    button.type='button';
    button.textContent='Çerez tercihleri';
    button.setAttribute('aria-label','Çerez tercihlerini değiştir');
    button.style.cssText='position:fixed;left:14px;bottom:14px;z-index:9998;border:1px solid #555;background:#111;color:#fff;border-radius:8px;padding:8px 11px;font-size:12px;cursor:pointer';
    button.addEventListener('click',function(){global.StagepulseConsent.reset();});
    document.body.appendChild(button);
  }

  function loadJarvis() {
    const path=location.pathname||'/';
    if (/^\/admin\//.test(path) || /^\/portal\//.test(path) || path==='/Kvkk.html') return;
    if (!document.getElementById('sp-site-ai-js')) {
      const siteAi=document.createElement('script');
      siteAi.id='sp-site-ai-js';
      siteAi.src='/site-ai.js?v=20261007-1';
      siteAi.async=true;
      document.head.appendChild(siteAi);
    }
    if (!document.getElementById('sp-stagepulse-jarvis')) {
      const jarvis=document.createElement('script');
      jarvis.id='sp-stagepulse-jarvis';
      jarvis.src='/jarvis/public/site-jarvis.js?v=20261007-1';
      jarvis.defer=true;
      document.head.appendChild(jarvis);
    }
  }

  function init() {
    try { state=localStorage.getItem(KEY); } catch (_) { state=null; }
    if (state==='accepted') analytics();
    else if (state!=='rejected') banner();
    addResetControl();
    loadJarvis();
  }

  global.StagepulseConsent={
    init:init,
    reset:function(){try{localStorage.removeItem(KEY);}catch(_){}state=null;deny();banner();},
    hasAnalyticsConsent:function(){return state==='accepted';}
  };

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(window);