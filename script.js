/* Stagepulse public script — dokumanlar.html bolgeler.html */
function ensureCoreNavigationLinks() {
  var nav = document.getElementById('navLinks');
  if (!nav) return;
  function ensure(href, label, beforeHref) {
    var sel = 'a[href="' + href + '"], a[href="../' + href + '"]';
    if (nav.querySelector(sel)) return;
    var a = document.createElement('a');
    a.href = href.indexOf('/') === 0 ? href : href;
    if (location.pathname.split('/').length > 2) a.href = '../' + href;
    a.textContent = label;
    var before = beforeHref ? nav.querySelector('a[href="' + beforeHref + '"], a[href="../' + beforeHref + '"]') : null;
    if (before) nav.insertBefore(a, before);
    else nav.appendChild(a);
  }
  ensure('dokumanlar.html', 'Dokümanlar', 'referanslar.html');
  ensure('bolgeler.html', 'Bölgeler', 'referanslar.html');
}
ensureCoreNavigationLinks();

/* Public TR/EN switcher — bütün bölge sayfalarında tek tip görünüm */
function ensureLanguageSwitcher() {
  var nr = document.querySelector('.nav-right');
  if (!nr) return;
  var ls = nr.querySelector('.lang-switch');
  if (!ls) {
    ls = document.createElement('div');
    ls.className = 'lang-switch';
    var hamburger = nr.querySelector('#hamburger');
    if (hamburger) nr.insertBefore(ls, hamburger);
    else nr.appendChild(ls);
  }
  var current = document.documentElement.lang === 'en' ? 'en' : 'tr';
  ls.innerHTML =
    '<button class="lang-btn' + (current === 'tr' ? ' active' : '') + '" type="button" id="btn-tr" aria-label="Türkçe" title="Türkçe" data-sp-lang="tr">' +
      '<svg class="flag-icon" viewBox="0 0 1200 800" aria-hidden="true" focusable="false"><rect width="1200" height="800" fill="#e30a17"/><circle cx="400" cy="400" r="200" fill="#fff"/><circle cx="450" cy="400" r="160" fill="#e30a17"/><polygon points="575,400 633,419 611,357 669,376 619,412 642,471 599,435 556,471 579,412 529,376 587,357 565,419" fill="#fff"/></svg><span>TR</span>' +
    '</button>' +
    '<button class="lang-btn' + (current === 'en' ? ' active' : '') + '" type="button" id="btn-en" aria-label="English" title="English" data-sp-lang="en">' +
      '<svg class="flag-icon" viewBox="0 0 60 30" aria-hidden="true" focusable="false"><rect width="60" height="30" fill="#012169"/><path d="M0 0L60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" stroke-width="3"/><path d="M30 0V30M0 15H60" stroke="#fff" stroke-width="10"/><path d="M30 0V30M0 15H60" stroke="#C8102E" stroke-width="6"/></svg><span>EN</span>' +
    '</button>';
  if (!document.getElementById('sp-language-switcher-css')) {
    var style = document.createElement('style');
    style.id = 'sp-language-switcher-css';
    style.textContent =
      '.lang-switch{display:flex!important;align-items:center!important;gap:6px!important;flex-shrink:0!important;white-space:nowrap!important}' +
      '.lang-switch .lang-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-width:58px!important;height:34px!important;padding:5px 9px!important;box-sizing:border-box!important;white-space:nowrap!important;flex:0 0 auto!important}' +
      '.lang-switch .flag-icon{display:block!important;width:22px!important;height:14px!important;min-width:22px!important;max-width:22px!important;flex:0 0 22px!important;border-radius:2px!important;overflow:hidden!important}' +
      '@media(max-width:899px){.lang-switch .lang-btn{min-width:52px!important;height:36px!important;padding:5px 7px!important}.lang-switch .flag-icon{width:20px!important;height:13px!important;min-width:20px!important;flex-basis:20px!important}.nav-right{gap:6px!important}}';
    document.head.appendChild(style);
  }
  ls.querySelectorAll('[data-sp-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lang = btn.getAttribute('data-sp-lang');
      if (typeof window.setLanguage === 'function') window.setLanguage(lang);
      ls.querySelectorAll('[data-sp-lang]').forEach(function (b) { b.classList.toggle('active', b === btn); });
    });
  });
}
ensureLanguageSwitcher();

(function () {
  'use strict';

  /* 1) Hemen mobil CSS — CDN beklemeden */
  if (!document.getElementById('sp-public-nav-fix')) {
    var st = document.createElement('style');
    st.id = 'sp-public-nav-fix';
    st.textContent =
      '@media (max-width:899px){' +
      '.hamburger,#hamburger{display:flex!important;visibility:visible!important;pointer-events:auto!important;' +
      'width:40px!important;height:40px!important;align-items:center;justify-content:center;' +
      'border:1px solid rgba(255,255,255,.18);border-radius:8px;background:transparent;color:#fff;' +
      'flex-shrink:0;z-index:10002;opacity:1!important;cursor:pointer;font-size:16px}' +
      '.nav-right{margin-left:auto!important;display:flex!important;align-items:center;gap:6px;flex-shrink:0}' +
      '.nav-inner{display:flex!important;align-items:center;gap:8px;width:100%;min-width:0}' +
      '.nav-links{display:none;position:absolute;top:64px;left:0;width:100%;background:#0a0a0a;' +
      'flex-direction:column;padding:14px 18px 20px;z-index:10001;border-bottom:1px solid rgba(255,255,255,.08)}' +
      '.nav-links.active{display:flex!important}' +
      '.nav-links a{color:#ccc;text-decoration:none;padding:10px 12px;border-radius:8px}' +
      '}' +
      '@media (min-width:900px){' +
      '.hamburger,#hamburger{display:none!important;visibility:hidden!important;pointer-events:none!important}' +
      '.nav-links{display:flex!important;position:static!important;width:auto!important;background:transparent!important;' +
      'flex-direction:row!important;padding:0!important;border:none!important}' +
      '}';
    document.head.appendChild(st);
  }

  if (!document.getElementById('sp-mobile-nav-css')) {
    var link = document.createElement('link');
    link.id = 'sp-mobile-nav-css';
    link.rel = 'stylesheet';
    link.href = '/mobile-nav-fix.css?v=20260827-nav3';
    document.head.appendChild(link);
  }

  function ensureHamburger() {
    var nr = document.querySelector('.nav-right');
    if (!nr) return null;
    var h = document.getElementById('hamburger');
    if (!h) {
      h = document.createElement('button');
      h.type = 'button';
      h.className = 'hamburger';
      h.id = 'hamburger';
      h.setAttribute('aria-label', 'Menü');
      h.setAttribute('aria-expanded', 'false');
      h.innerHTML = '<i class="fa-solid fa-bars" id="hamburger-icon"></i>';
      nr.appendChild(h);
    }
    return h;
  }

  function bindMenu() {
    ensureCoreNavigationLinks();
    var hamburger = ensureHamburger();
    var navLinks = document.getElementById('navLinks');
    var icon = document.getElementById('hamburger-icon');
    if (!hamburger || !navLinks) return;
    if (hamburger.dataset.spMenuReady === '1') return;
    hamburger.dataset.spMenuReady = '1';
    hamburger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = !navLinks.classList.contains('active');
      navLinks.classList.toggle('active', open);
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (icon) {
        icon.classList.toggle('fa-bars', !open);
        icon.classList.toggle('fa-xmark', open);
      }
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('active');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function boot() {
    bindMenu();
    try {
      new MutationObserver(function () {
        if (window.innerWidth < 900 && !document.getElementById('hamburger')) {
          var h = document.querySelector('.hamburger');
          if (h && h.dataset) h.dataset.spMenuReady = '';
          bindMenu();
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (err) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Teklif / form controller — ayrı yükle (nav'ı bozmaz) */
  var ctrl = document.createElement('script');
  ctrl.src = '/script-controller.js?v=20260827-nav3';
  ctrl.async = true;
  ctrl.onerror = function () {
    var s = document.createElement('script');
    s.src = '/core.js?v=20260827-nav3';
    document.head.appendChild(s);
  };
  document.head.appendChild(ctrl);
})();

/* Public visual/media resilience — loaded on every public page. */
(function(){
  if(document.getElementById('sp-public-visual-loader')) return;
  var s=document.createElement('script');
  s.id='sp-public-visual-loader';
  s.src='/public-visual-fix-v1.js?v=20260830-01';
  s.async=true;
  document.head.appendChild(s);
})();
