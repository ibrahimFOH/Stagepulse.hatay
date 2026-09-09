/* Stagepulse public script — dokumanlar.html bolgeler.html */
(function loadConsentBeforePublicControllers() {
  if (window.StagepulseConsent || document.querySelector('script[src$="/consent.js"],script[src="consent.js"]')) return;
  var consent = document.createElement('script');
  consent.src = '/consent.js';
  consent.async = false;
  document.head.appendChild(consent);
})();
function ensureCoreNavigationLinks() {
  var nav = document.getElementById('navLinks') || document.querySelector('nav .nav-links');
  if (!nav) return;
  if (!nav.id) nav.id = 'navLinks';
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
  ensure('teknik-rehber.html', 'Teknik Rehber', 'referanslar.html');
}
ensureCoreNavigationLinks();

function ensureLanguageSwitcher() {
  var navInner = document.querySelector('nav .nav-inner');
  if (!navInner) return;
  var nr = navInner.querySelector('.nav-right');
  if (!nr) { nr = document.createElement('div'); nr.className = 'nav-right'; navInner.appendChild(nr); }
  var ls = nr.querySelector('.lang-switch');
  if (!ls) { ls = document.createElement('div'); ls.className = 'lang-switch'; var hamburger = nr.querySelector('#hamburger'); if (hamburger) nr.insertBefore(ls, hamburger); else nr.appendChild(ls); }
  var current = document.documentElement.lang === 'en' ? 'en' : 'tr';
  ls.innerHTML = '<button class="lang-btn' + (current === 'tr' ? ' active' : '') + '" type="button" id="btn-tr" aria-label="Türkçe" title="Türkçe" data-sp-lang="tr"><span>TR</span></button><button class="lang-btn' + (current === 'en' ? ' active' : '') + '" type="button" id="btn-en" aria-label="English" title="English" data-sp-lang="en"><span>EN</span></button>';
  ls.querySelectorAll('[data-sp-lang]').forEach(function (btn) { btn.addEventListener('click', function () { var lang = btn.getAttribute('data-sp-lang'); if (typeof window.setLanguage === 'function') window.setLanguage(lang); ls.querySelectorAll('[data-sp-lang]').forEach(function (b) { b.classList.toggle('active', b === btn); }); }); });
}
ensureLanguageSwitcher();

(function () {
  'use strict';
  if (!document.getElementById('sp-public-nav-fix')) { var st = document.createElement('style'); st.id = 'sp-public-nav-fix'; st.textContent = '@media(max-width:899px){.hamburger,#hamburger{display:flex!important;visibility:visible!important;pointer-events:auto!important;width:40px!important;height:40px!important;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:transparent;color:#fff;flex-shrink:0;z-index:10002;opacity:1!important;cursor:pointer;font-size:16px}.nav-right{margin-left:auto!important;display:flex!important;align-items:center;gap:6px;flex-shrink:0}.nav-inner{display:flex!important;align-items:center;gap:8px;width:100%;min-width:0}.nav-links{display:none;position:absolute;top:64px;left:0;width:100%;background:#0a0a0a;flex-direction:column;padding:14px 18px 20px;z-index:10001;border-bottom:1px solid rgba(255,255,255,.08)}.nav-links.active{display:flex!important}.nav-links a{color:#ccc;text-decoration:none;padding:10px 12px;border-radius:8px}}@media (min-width:900px){.hamburger,#hamburger{display:none!important;visibility:hidden!important;pointer-events:none!important}.nav-links{display:flex!important;position:static!important;width:auto!important;background:transparent!important;flex-direction:row!important;padding:0!important}}'; document.head.appendChild(st); }
  function ensureHamburger(){var nr=document.querySelector('.nav-right');if(!nr)return null;var h=document.getElementById('hamburger');if(!h){h=document.createElement('button');h.type='button';h.className='hamburger';h.id='hamburger';h.setAttribute('aria-label','Menü');h.setAttribute('aria-expanded','false');h.innerHTML='<i class="fa-solid fa-bars" id="hamburger-icon"></i>';nr.appendChild(h)}return h}
  function bindMenu(){ensureCoreNavigationLinks();var hamburger=ensureHamburger(),navLinks=document.getElementById('navLinks'),icon=document.getElementById('hamburger-icon');if(!hamburger||!navLinks)return;if(hamburger.dataset.spMenuReady==='1')return;hamburger.dataset.spMenuReady='1';hamburger.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var open=!navLinks.classList.contains('active');navLinks.classList.toggle('active',open);hamburger.classList.toggle('open',open);hamburger.setAttribute('aria-expanded',open?'true':'false');if(icon){icon.classList.toggle('fa-bars',!open);icon.classList.toggle('fa-xmark',open)}});navLinks.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){navLinks.classList.remove('active');hamburger.classList.remove('open');hamburger.setAttribute('aria-expanded','false')})})}
  function boot(){bindMenu();try{new MutationObserver(function(){if(window.innerWidth<1200&&!document.getElementById('hamburger'))bindMenu()}).observe(document.documentElement,{childList:true,subtree:true})}catch(err){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  var ctrl=document.createElement('script');ctrl.src='/script-controller.js?v=20260904-nav5';ctrl.async=true;ctrl.onerror=function(){var s=document.createElement('script');s.src='/core.js?v=20260904-nav5';document.head.appendChild(s)};document.head.appendChild(ctrl);
})();

(function(){if(document.getElementById('sp-public-visual-loader'))return;var s=document.createElement('script');s.id='sp-public-visual-loader';s.src='/public-visual-fix-v1.js?v=20260907-media1';s.async=true;document.head.appendChild(s)})();

/* SEO guard: Google can process JS-generated structured data, while existing
 * page-specific title/description/canonical values are preserved. */
(function(){
  'use strict';
  function meta(name,content){if(!content)return;var el=document.head.querySelector('meta[name="'+name+'"]');if(!el){el=document.createElement('meta');el.name=name;document.head.appendChild(el)}if(!el.content)el.content=content;}
  function link(rel,href){if(!href)return;var el=document.head.querySelector('link[rel="'+rel+'"]');if(!el){el=document.createElement('link');el.rel=rel;document.head.appendChild(el)}if(!el.href)el.href=href;}
  function schema(){
    if(document.head.querySelector('script[data-stagepulse-seo-schema]'))return;
    var path=location.pathname.replace(/\/+/g,'/');
    var canonical=location.origin+(path==='/'?' /'.trim():path).replace(/\/index\.html$/,'/');
    var data={"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":location.origin+'/#organization',"name":"Stagepulse","url":location.origin+'/',"logo":location.origin+'/favicon.svg',"telephone":"+90-532-068-3012","email":"teklifal@stagepulse.com.tr","areaServed":{"@type":"Country","name":"Türkiye"},"sameAs":["https://www.instagram.com/stagepulse.hatay"]},{"@type":"WebSite","@id":location.origin+'/#website',"url":location.origin+'/',"name":"Stagepulse","inLanguage":document.documentElement.lang||'tr-TR',"publisher":{"@id":location.origin+'/#organization'}},{"@type":"WebPage","@id":canonical+'#webpage',"url":canonical,"name":document.title,"inLanguage":document.documentElement.lang||'tr-TR'}]};
    var s=document.createElement('script');s.type='application/ld+json';s.dataset.stagepulseSeoSchema='1';s.textContent=JSON.stringify(data);document.head.appendChild(s);
  }
  function run(){var p=location.pathname;if(/^\/(admin|portal|jarvis)(\/|$)/i.test(p))return;meta('robots','index, follow');link('canonical',location.origin+p.replace(/\/index\.html$/,'/'));schema();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();