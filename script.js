/* ============================================
   STAGEPULSE – script.js (Güvenlik güçlendirmeli)
   - Network-first uyumlu
   - Proper GA Consent Mode v2
   - Supabase dinamik yükleme
   - Honeypot + Turnstile + client rate-limit
   - Daha sağlam cookie / form yönetimi
   - Her türlü dosya adı (Türkçe, boşluk, özel karakter) destekli
   ============================================ */

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xrpzeegb';

/* ===== Cloudflare Turnstile =====
   Cloudflare Dashboard → Turnstile → Site Key buraya yaz.
   Boş bırakılırsa widget gösterilmez; honeypot + rate-limit aktif kalır.
*/
const TURNSTILE_SITE_KEY = '0x4AAAAAAENv1kw4YHXe-Gih';

/* ===== Supabase ===== */
const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';

let supabase = null;

// Supabase kütüphanesini dinamik yükle (sadece gerektiğinde)
function loadSupabase() {
  return new Promise((resolve) => {
    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      resolve(supabase);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => {
      if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }
      resolve(supabase);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/* ===== Dil Yönetimi ===== */
function t(key, fallbackTr, vars) {
  const lang = localStorage.getItem('lang') || 'tr';
  let str = (typeof translations !== 'undefined' && translations[lang] && translations[lang][key] !== undefined)
    ? translations[lang][key]
    : fallbackTr;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      str = str.replace('{' + k + '}', vars[k]);
    });
  }
  return str;
}

function setLanguage(lang) {
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key] !== undefined) {
      el.innerHTML = translations[lang][key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[lang] && translations[lang][key] !== undefined) {
      el.placeholder = translations[lang][key];
    }
  });

  document.querySelectorAll('select option[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key] !== undefined) {
      el.textContent = translations[lang][key];
    }
  });

  const btnTr = document.getElementById('btn-tr');
  const btnEn = document.getElementById('btn-en');
  if (btnTr) btnTr.classList.toggle('active', lang === 'tr');
  if (btnEn) btnEn.classList.toggle('active', lang === 'en');
}

/* ===== Cookie / KVKK Consent + GA Consent Mode v2 ===== */
function initCookieConsent() {
  const consent = localStorage.getItem('sp_consent');

  if (consent === 'accepted') {
    updateGAConsent(true);
    return;
  }

  if (consent === 'rejected') {
    updateGAConsent(false);
    return;
  }

  // Banner göster
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Çerez onayı');
  banner.innerHTML = `
    <div class="cookie-inner">
      <p data-i18n="cookie_text">Bu site deneyimi iyileştirmek ve teklif süreçlerini yönetmek için çerezler kullanır. Devam ederek <a href="Kvkk.html" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a>’ni kabul etmiş olursunuz.</p>
      <div class="cookie-actions">
        <button id="cookie-accept" class="btn btn-primary" data-i18n="cookie_accept">Kabul Et</button>
        <button id="cookie-reject" class="btn btn-outline" data-i18n="cookie_reject">Reddet</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  document.body.classList.add('has-cookie-banner');

  // Dil uygula
  setLanguage(localStorage.getItem('lang') || 'tr');

  const dismissCookie = (accepted) => {
    localStorage.setItem('sp_consent', accepted ? 'accepted' : 'rejected');
    banner.remove();
    document.body.classList.remove('has-cookie-banner');
    updateGAConsent(accepted);
  };

  document.getElementById('cookie-accept').addEventListener('click', () => dismissCookie(true));
  document.getElementById('cookie-reject').addEventListener('click', () => dismissCookie(false));
}

function updateGAConsent(granted) {
  if (typeof gtag === 'function') {
    gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }
}

function trackEvent(name, params = {}) {
  if (typeof gtag === 'function' && localStorage.getItem('sp_consent') === 'accepted') {
    gtag('event', name, params);
  }
}

/* ===== ROBUST MEDIA URL (Türkçe + boşluk + özel karakter destekli) ===== */
function safeMediaUrl(path) {
  if (!path) return '';
  // Zaten absolute URL ise dokunma
  if (/^https?:\/\//i.test(path)) return path;

  // Her path parçasını ayrı ayrı encode et
  return path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

/* ===== Ana Başlatma ===== */
document.addEventListener('DOMContentLoaded', () => {
  // Dil
  setLanguage(localStorage.getItem('lang') || 'tr');

  // Sticky mobile CTA varsa body class
  if (document.getElementById('stickyCta')) {
    document.body.classList.add('has-sticky-cta');
  }

  // Cookie + GA
  initCookieConsent();

  // Supabase'i arka planda yükle (form varsa)
  if (document.getElementById('offerForm')) {
    loadSupabase();
  }

  // ===== Hamburger Menü =====
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  const icon = document.getElementById('hamburger-icon');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('active');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (icon) {
        icon.classList.toggle('fa-bars', !isOpen);
        icon.classList.toggle('fa-xmark', isOpen);
      }
    });

    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('active');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-xmark');
        }
      });
    });
  }

  // ===== Aktif Menü =====
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const clean = href.replace('./', '').replace(/^\//, '') || 'index.html';
    if (clean === currentPath || (currentPath === '' && clean === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ===== Lightbox =====
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbClose = document.getElementById('lightbox-close');

  function openLightbox(src) {
    if (!lightbox || !lbImg) return;
    lbImg.src = src;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    if (lbImg) lbImg.src = '';
    document.body.style.overflow = '';
  }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });

  // ===== Media Loader (güçlendirilmiş) =====
  const gallery = document.getElementById('gallery');
  const heroBg = document.getElementById('heroBg');
  const videoBox = document.getElementById('videos');
  const docList = document.getElementById('documentsList');

  const galleryAlts = [
    'Sahne line array kurulumu',
    'FOH konsol ve miks noktası',
    'Açık alan ses sistemi',
    'Truss ve ışık kurulumu',
    'Monitör ve sahne düzeni',
    'Canlı etkinlik ses operasyonu',
    'Sahne ve PA sistemi kurulumu',
    'FOH mühendisliği saha çalışması'
  ];

  (async function loadMedia() {
    try {
      // Cache'i kırmak için timestamp ekle
      const res = await fetch('media.json?_=' + Date.now());
      if (!res.ok) return;
      const data = await res.json();

      const photos = Array.isArray(data.photos) ? data.photos : [];

      if (gallery) {
        gallery.innerHTML = '';
        if (!photos.length) {
          gallery.innerHTML = '<p style="color:#666;text-align:center;padding:40px 0">Henüz fotoğraf eklenmedi.</p>';
        } else {
          photos.forEach((src, i) => {
            const img = document.createElement('img');
            const url = safeMediaUrl(src);
            img.src = url;
            img.loading = 'lazy';
            img.alt = galleryAlts[i % galleryAlts.length];
            img.addEventListener('click', () => openLightbox(url));
            gallery.appendChild(img);
          });
        }
      }

      if (heroBg && photos.length) {
        let i = 0;
        const setBg = n => {
          const url = safeMediaUrl(photos[n]);
          heroBg.style.backgroundImage =
            'linear-gradient(110deg,rgba(0,0,0,.93),rgba(0,0,0,.5)), url("' + url + '")';
        };
        setBg(0);
        setInterval(() => {
          i = (i + 1) % photos.length;
          setBg(i);
        }, 5500);
      }

      const videos = Array.isArray(data.videos) ? data.videos : [];
      if (videoBox) {
        videoBox.innerHTML = '';
        if (!videos.length) {
          const section = videoBox.closest('section') || videoBox.closest('.section');
          if (section) section.style.display = 'none';
        } else {
          videos.forEach(src => {
            const v = document.createElement('video');
            v.src = safeMediaUrl(src);
            v.controls = true;
            v.preload = 'metadata';
            v.playsInline = true;
            videoBox.appendChild(v);
          });
        }
      }

      const docs = Array.isArray(data.documents) ? data.documents : [];
      if (docList) {
        docList.innerHTML = '';
        if (!docs.length) {
          docList.innerHTML =
            '<div class="doc-card"><i class="fa-solid fa-file-pdf"></i><h3 data-i18n="d_empty_title">Henüz doküman eklenmedi</h3><p data-i18n="d_empty_desc">PDF documents klasörüne yükleyin</p></div>';
          setLanguage(localStorage.getItem('lang') || 'tr');
        } else {
          docs.forEach(d => {
            // media.json objects use "path" / "name"; older code expected "file" / "title"
            const rawPath = (typeof d === 'string') ? d : (d.path || d.file || d.url || '');
            const rawName = (typeof d === 'string')
              ? d
              : (d.title || d.name || rawPath || 'Doküman');
            const displayName = String(rawName)
              .split('/')
              .pop()
              .replace(/\.pdf$/i, '')
              .replace(/[-_]+/g, ' ')
              .replace(/\bStagepulse\b/gi, 'Stagepulse')
              .trim() || 'Doküman';
            const a = document.createElement('a');
            a.href = safeMediaUrl(rawPath);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'doc-card';
            if (!rawPath) {
              a.removeAttribute('href');
              a.style.pointerEvents = 'none';
              a.style.opacity = '0.6';
            }
            // Güvenlik: iconClass sadece harf/rakam/tire içerebilir (class attribute injection önlenir)
            const rawIcon = (d && typeof d.icon === 'string') ? d.icon : '';
            const safeIcon = /^[a-zA-Z0-9-]+$/.test(rawIcon) ? rawIcon : 'fa-file-pdf';
            const iconClass = 'fa-solid ' + safeIcon;

            // Güvenlik: displayName kullanıcı/CI kaynaklı olabileceğinden innerHTML yerine
            // textContent ile güvenli şekilde DOM'a ekleniyor (stored XSS önlemi)
            const iconEl = document.createElement('i');
            iconEl.className = iconClass;

            const titleEl = document.createElement('h3');
            titleEl.textContent = displayName;

            const descEl = document.createElement('p');
            descEl.setAttribute('data-i18n', 'd_view');
            descEl.textContent = 'PDF görüntüle / indir';

            a.appendChild(iconEl);
            a.appendChild(titleEl);
            a.appendChild(descEl);
            docList.appendChild(a);
          });
          setLanguage(localStorage.getItem('lang') || 'tr');
        }
      }
    } catch (e) {
      console.warn('Media load error', e);
    }
  })();

  // ===== Turnstile + rate-limit yardımcıları =====
  let turnstileWidgetId = null;
  let turnstileLoadFailed = false;
  let lastSubmitTs = 0;
  const SUBMIT_COOLDOWN_MS = 15000; // 15 sn client-side rate limit

  function initTurnstile(attempt) {
    attempt = attempt || 0;
    const el = document.getElementById('cfTurnstile');
    const wrap = document.getElementById('turnstileWrap');
    if (!el || !TURNSTILE_SITE_KEY) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (typeof turnstile === 'undefined') {
      // API henüz yüklenmediyse kısa gecikmeyle tekrar dene (en fazla ~6 saniye)
      if (attempt >= 15) {
        // Widget yüklenemedi — sessizce geçmek yerine kullanıcıyı bilgilendir
        // ve gönderim sırasında net bir uyarı gösterilmesi için işaretle.
        turnstileLoadFailed = true;
        console.warn('Turnstile script did not load in time.');
        return;
      }
      setTimeout(() => initTurnstile(attempt + 1), 400);
      return;
    }
    try {
      turnstileWidgetId = turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        size: 'normal',
        'error-callback': () => { turnstileLoadFailed = true; }
      });
    } catch (err) {
      console.warn('Turnstile render error', err);
      turnstileLoadFailed = true;
    }
  }

  // ===== Teklif Formu =====
  const form = document.getElementById('offerForm');
  if (form) {
    initTurnstile();

    function getTodayStr() {
      const now = new Date();
      return now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    }

    // Etkinlik tarihi: geçmiş seçilemesin
    const eventDateEl = form.querySelector('[name="date"]') || document.getElementById('eventDate');
    if (eventDateEl) {
      const applyMinDate = () => {
        const todayStr = getTodayStr();
        eventDateEl.setAttribute('min', todayStr);
        // Manuel / otomatik geçmiş tarih girildiyse temizle
        if (eventDateEl.value && eventDateEl.value < todayStr) {
          eventDateEl.value = '';
        }
      };
      applyMinDate();
      eventDateEl.addEventListener('change', applyMinDate);
      eventDateEl.addEventListener('input', applyMinDate);
      // Sayfa uzun açık kalırsa min'i güncelle (gece yarısı vs.)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') applyMinDate();
      });
    }

    // Hata sınıfını temizle
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', () => el.classList.remove('field-error'));
      el.addEventListener('change', () => el.classList.remove('field-error'));
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Double-submit koruması
      if (form.dataset.submitting === '1') return;

      // Client-side rate limit (spam / hızlı tıklama)
      const now = Date.now();
      if (now - lastSubmitTs < SUBMIT_COOLDOWN_MS) {
        const wait = Math.ceil((SUBMIT_COOLDOWN_MS - (now - lastSubmitTs)) / 1000);
        const errMsg = t('form_rate_limit', 'Lütfen ' + wait + ' saniye bekleyip tekrar deneyin.', { seconds: wait });
        // showFormError henüz tanımlı değil; geçici basit uyarı
        let err = document.getElementById('formError');
        if (!err) {
          err = document.createElement('div');
          err.id = 'formError';
          err.setAttribute('role', 'alert');
          err.style.cssText = 'background:#ff3333;color:#fff;padding:12px 16px;border-radius:8px;margin:12px 0;font-size:14px;text-align:center;';
          form.insertBefore(err, form.querySelector('button[type="submit"]'));
        }
        err.textContent = errMsg;
        return;
      }

      // Alanları güvenli şekilde al
      const nameEl     = this.querySelector('[name="name"]')     || document.getElementById('name');
      const companyEl  = this.querySelector('[name="company"]')  || document.getElementById('company');
      const emailEl    = this.querySelector('[name="email"]')    || document.getElementById('email');
      const eventTypeEl= this.querySelector('[name="event_type"]') || document.getElementById('eventType');
      const phoneEl    = this.querySelector('[name="phone"]')    || document.getElementById('phone');
      const typeEl     = this.querySelector('[name="type"]')     || document.getElementById('type');
      const locationEl = this.querySelector('[name="location"]') || document.getElementById('location');
      const peopleEl   = this.querySelector('[name="people"]')   || document.getElementById('people');
      const dateEl     = this.querySelector('[name="date"]')     || document.getElementById('eventDate');
      const messageEl  = this.querySelector('[name="message"]')  || document.getElementById('message');
      const kvkkEl     = this.querySelector('[name="kvkk"]')     || document.getElementById('kvkk');
      const hpEl       = this.querySelector('[name="website"]');

      // Honeypot: görünmez alan doluysa bot — sessizce reddet
      if (hpEl && hpEl.value.trim() !== '') {
        return;
      }

      // Turnstile token — widget gerçekten görünür ve yanıt verdiyse zorunlu
      let turnstileToken = '';
      if (TURNSTILE_SITE_KEY) {
        if (turnstileLoadFailed) {
          showFormError(
            t('form_err_turnstile_unavailable', 'Güvenlik doğrulaması yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin veya WhatsApp üzerinden ulaşın.')
          );
          return;
        }
        if (typeof turnstile !== 'undefined' && turnstileWidgetId !== null) {
          try {
            turnstileToken = turnstile.getResponse(turnstileWidgetId) || '';
          } catch (_) {}
          const tw = document.getElementById('turnstileWrap');
          const widgetVisible = tw && tw.offsetParent !== null && tw.style.display !== 'none';
          if (widgetVisible && !turnstileToken) {
            showFormError(t('form_err_turnstile', 'Lütfen güvenlik doğrulamasını tamamlayın.'));
            return;
          }
        }
      }

      const name     = nameEl     ? nameEl.value.trim()     : '';
      const company  = companyEl  ? companyEl.value.trim()  : '';
      const email    = emailEl    ? emailEl.value.trim()    : '';
      const eventType= eventTypeEl? eventTypeEl.value       : '';
      const phone    = phoneEl    ? phoneEl.value.trim()    : '';
      const type     = typeEl     ? typeEl.value            : '';
      const location = locationEl ? locationEl.value.trim() : '';
      const people   = peopleEl   ? peopleEl.value.trim()   : '';
      const date     = dateEl     ? dateEl.value            : '';
      const message  = messageEl  ? messageEl.value.trim()  : '';
      const kvkk     = kvkkEl     ? kvkkEl.checked          : false;

      function showFormError(msg, focusEl) {
        form.dataset.submitting = '0';
        form.querySelectorAll('.field-error').forEach((el) => el.classList.remove('field-error'));

        let err = document.getElementById('formError');
        if (!err) {
          err = document.createElement('div');
          err.id = 'formError';
          err.setAttribute('role', 'alert');
          err.style.cssText = 'background:#ff3333;color:#fff;padding:12px 16px;border-radius:8px;margin:12px 0;font-size:14px;text-align:center;';
        }

        // Hata her zaman sarı butonun ÜSTÜNDE görünsün (akordeon içinde kaybolmasın)
        const submitBtnEl = form.querySelector('button[type="submit"]');
        if (submitBtnEl && submitBtnEl.parentNode) {
          submitBtnEl.parentNode.insertBefore(err, submitBtnEl);
        } else if (!err.parentNode) {
          form.appendChild(err);
        }

        err.textContent = msg;
        err.style.display = 'block';

        if (focusEl) {
          focusEl.classList.add('field-error');
          // Kapalı bölümü aç
          const section = focusEl.closest('.sp-offer-section');
          if (section) {
            form.querySelectorAll('.sp-offer-section').forEach((x) => x.classList.remove('is-open'));
            section.classList.add('is-open');
          }
          const target = focusEl.closest('.form-group') || focusEl.closest('label.kvkk-label') || focusEl;
          if (document.activeElement && document.activeElement !== focusEl) {
            try { document.activeElement.blur(); } catch (_) {}
          }
          setTimeout(function () {
            try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {
              try { target.scrollIntoView(true); } catch (__) {}
            }
            setTimeout(function () {
              try { focusEl.focus({ preventScroll: true }); } catch (_) {
                try { focusEl.focus(); } catch (__) {}
              }
            }, 200);
          }, 80);
        } else {
          try { err.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        }

        setTimeout(function () { err.style.display = 'none'; }, 8000);
      }

      // Zorunlu alan kontrolleri (hepsi) — hata varsa return, submitting zaten 0
      if (!name) {
        showFormError(t('form_err_name', 'Lütfen Ad Soyad / Firma alanını doldurun.'), nameEl);
        return;
      }
      if (!company && companyEl && false) {
        showFormError(t('form_err_company', 'Firma bilgisi girin.'), companyEl);
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFormError(t('form_err_email', 'Lütfen geçerli bir e-posta adresi girin.'), emailEl);
        return;
      }
      if (!phone) {
        showFormError(t('form_err_phone', 'Lütfen Telefon numaranızı girin.'), phoneEl);
        return;
      }
      if (!eventType) {
        showFormError(t('form_err_event_type', 'Lütfen etkinlik türünü seçin.'), eventTypeEl);
        return;
      }
      if (!type) {
        showFormError(t('form_err_type', 'Lütfen Hizmet Türü / Paket seçin.'), typeEl);
        return;
      }
      if (!location) {
        showFormError(t('form_err_location', 'Lütfen Lokasyon / Şehir alanını doldurun.'), locationEl);
        return;
      }
      if (!people || isNaN(Number(people)) || Number(people) < 1 || Number(people) > 100000) {
        showFormError(t('form_err_people', 'Lütfen geçerli bir Tahmini Katılımcı Sayısı girin (1 - 100.000 arası).'), peopleEl);
        return;
      }
      if (!/^[0-9+\s()\-]{7,20}$/.test(phone)) {
        showFormError(t('form_err_phone_invalid', 'Lütfen geçerli bir Telefon numarası girin.'), phoneEl);
        return;
      }
      if (!date) {
        showFormError(t('form_err_date', 'Lütfen Etkinlik Tarihini seçin.'), dateEl);
        return;
      }
      {
        // Geçmiş tarih kontrolü (yerel tarihe göre, tarayıcı kısıtı atlatılsa bile)
        const todayStr = getTodayStr();
        if (dateEl) dateEl.setAttribute('min', todayStr);
        if (date < todayStr) {
          if (dateEl) dateEl.value = '';
          showFormError(t('form_err_date_past', 'Etkinlik Tarihi geçmiş bir tarih olamaz. Lütfen bugün veya sonrası için bir tarih seçin.'), dateEl);
          return;
        }
      }
      if (!message) {
        showFormError(t('form_err_message', 'Lütfen mesaj / etkinlik detaylarını yazın.'), messageEl);
        return;
      }
      if (!kvkk) {
        showFormError(t('form_err_kvkk', 'Devam etmek için KVKK onay kutusunu işaretlemeniz gerekmektedir.'), kvkkEl);
        return;
      }

      // Validasyon geçti — gönderim kilidini burada al
      form.dataset.submitting = '1';
      lastSubmitTs = Date.now();

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
      }

      // iOS Safari / mobil popup blocker'lar, window.open'ı yalnızca kullanıcı
      // tıklamasının SENKRON bağlamında izin verir. await'lerden sonra çağrılırsa
      // engellenir. Bu yüzden sekmeyi hemen (boş olarak) açıp, veriler hazır
      // olunca adresini ayarlıyoruz.
      const waWindow = (() => {
        try {
          return window.open('about:blank', '_blank', 'noopener,noreferrer');
        } catch (_) {
          return null;
        }
      })();

      const lang = localStorage.getItem('lang') || 'tr';

      // Supabase'e kayıt
      let supabaseSaved = false;
      try {
        await loadSupabase();
        if (supabase) {
          const { error } = await supabase.from('teklifler').insert([{
            name: name,
            phone: phone,
            company: company || null,
            email: email || null,
            type: type,
            event_type: eventType,
            location: location || null,
            people: people ? Number(people) : null,
            event_date: date || null,
            message: message,
            status: 'new'
          }]);
          if (error) { console.error('Supabase hatası:', error); throw error; }
          supabaseSaved = true;
        }
      } catch (err) {
        console.error('Supabase bağlantı hatası:', err);
        form.dataset.submitting = '0';
        const errBox = document.getElementById('formError') || document.createElement('div');
        errBox.id='formError'; errBox.setAttribute('role','alert'); errBox.style.cssText='background:#ff3333;color:#fff;padding:12px 16px;border-radius:8px;margin:12px 0;font-size:14px;text-align:center;';
        errBox.textContent = t('form_err_submit', 'Talebiniz kaydedilemedi. Lütfen birkaç dakika sonra tekrar deneyin veya WhatsApp üzerinden ulaşın.');
        if(!errBox.parentNode) form.insertBefore(errBox,form.querySelector('button[type=submit]'));
        if(submitBtn){submitBtn.disabled=false;submitBtn.style.opacity='1';}
        try { if (waWindow && !waWindow.closed) waWindow.close(); } catch (_) {}
        return;
      }

      // E-posta bildirimi — Formspree yanıtını gerçekten doğrula.
      let emailSent = false;
      if (FORMSPREE_ENDPOINT) {
        try {
          const formData = new FormData(form);
          if (turnstileToken) formData.append('cf-turnstile-response', turnstileToken);
          formData.delete('website');

          const mailResponse = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            body: formData,
            headers: { Accept: 'application/json' }
          });

          emailSent = mailResponse.ok;

          if (!mailResponse.ok) {
            let detail = '';
            try {
              const payload = await mailResponse.json();
              detail = payload?.errors?.map(x => x.message).join(' ') || payload?.error || '';
            } catch (_) {}
            console.warn('Formspree rejected quote notification:', mailResponse.status, detail);
          }
        } catch (err) {
          console.warn('Quote email notification failed:', err);
        }
      }

      // Turnstile widget'ı sıfırla (yeniden kullanım)
      if (TURNSTILE_SITE_KEY && typeof turnstile !== 'undefined' && turnstileWidgetId !== null) {
        try { turnstile.reset(turnstileWidgetId); } catch (_) {}
      }

      // WhatsApp
      const waText =
        'Yeni Teklif Talebi%0A%0A' +
        'Ad: ' + encodeURIComponent(name) +
        '%0ATelefon: ' + encodeURIComponent(phone) +
        '%0AHizmet: ' + encodeURIComponent(type) +
        '%0ALokasyon: ' + encodeURIComponent(location || '-') +
        '%0AKişi: ' + encodeURIComponent(people || '-') +
        '%0ATarih: ' + encodeURIComponent(date || '-') +
        '%0AMesaj: ' + encodeURIComponent(message);

      const waUrl = 'https://wa.me/905320683012?text=' + waText;

      // WhatsApp aç
      let waOpened = false;
      if (waWindow && !waWindow.closed) {
        try {
          waWindow.location.href = waUrl;
          waOpened = true;
        } catch (_) {}
      }
      if (!waOpened) {
        try {
          const a = document.createElement('a');
          a.href = waUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          a.remove();
          waOpened = true;
        } catch (_) {}
      }

      // Başarı mesajı — DB kaydı kesinleşmeden başarı göstermiyoruz.
      let msg = document.getElementById('formSuccess');
      if (!msg) {
        msg = document.createElement('div');
        msg.id = 'formSuccess';
        msg.className = 'form-success';
        form.appendChild(msg);
      }

      msg.innerHTML = `
        <strong>${t('form_success_title', 'Talebiniz başarıyla alındı.')}</strong>
        <span>${t('form_success_saved', 'Bilgileriniz Stagepulse sistemine kaydedildi.')}</span>
        <span>${emailSent
          ? t('form_success_email_ok', 'Bildirim e-postası da oluşturuldu.')
          : t('form_success_email_fail', 'Bildirim e-postası gönderilemedi; talebiniz sistemde kayıtlı.')}</span>
        <a class="form-success-wa" href="${waUrl}" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i> ${t('form_success_wa_btn', "WhatsApp'tan devam et")}
        </a>
      `;
      msg.classList.add('show');

      // Analytics event
      trackEvent('generate_lead', {
        event_category: 'form',
        event_label: type
      });

      form.reset();

      setTimeout(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
        form.dataset.submitting = '0';
      }, 2500);
    });
  }

  // WhatsApp link tracking
  document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
    a.addEventListener('click', () => {
      trackEvent('contact', { method: 'whatsapp' });
    });
  });

  // Telefon tracking
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    a.addEventListener('click', () => {
      trackEvent('contact', { method: 'phone' });
    });
  });
});
