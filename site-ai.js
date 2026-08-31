(function () {
  'use strict';
  if (window.__spSiteAi) return;
  window.__spSiteAi = 1;

  const EDGE = (globalThis.STAGEPULSE_RUNTIME && globalThis.STAGEPULSE_RUNTIME.siteAiUrl) ||
    window.SP_SITE_AI_URL ||
    'https://mtjcqqrogjqaxkagwkti.supabase.co/functions/v1/site-ai';
  const SESSION_KEY = 'stagepulse_ai_history_v2';
  let knowledge = null;
  let busy = false;

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function safeText(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function safeLinkify(text) {
    let escaped = safeText(text);
    escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    escaped = escaped.replace(/(^|\s)(\/(?:[\w.-]+)\.html)(?=\s|$)/g, '$1<a href="$2">$2</a>');
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return escaped.replace(/\n/g, '<br>');
  }

  function removeLegacyAiChips() {
    if (document.getElementById('sp-ai-legacy-cleanup')) return;
    const style = document.createElement('style');
    style.id = 'sp-ai-legacy-cleanup';
    style.textContent = `
      #sp-ai-root .sp-ai-chips,
      #sp-ai-root .sp-ai-chips button,
      #sp-ai-root button[data-q] { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  async function loadKnowledge() {
    if (knowledge) return knowledge;
    try {
      const r = await fetch('/ai-knowledge.json?_=' + Date.now(), { cache: 'no-store' });
      if (r.ok) knowledge = await r.json();
    } catch (_) {}
    if (!knowledge) knowledge = {
      brand: 'Stagepulse',
      contact: {
        phone: '+90 532 068 3012',
        whatsapp: 'https://wa.me/905320683012',
        email: 'teklifal@stagepulse.com.tr'
      },
      phone: '+90 532 068 3012',
      whatsapp: 'https://wa.me/905320683012',
      email: 'teklifal@stagepulse.com.tr',
      services: ['Ses sistemi kiralama', 'FOH operasyonu ve canlı miks', 'Stage Plot / teknik rider', 'SPL ve sistem tasarımı', 'Sahne ışık sistemleri', 'Network Audio (Dante)'],
      regions: ['Hatay', 'Adana', 'Gaziantep', 'Şanlıurfa', 'Mersin'],
      links: { teklif: '/teklif.html', bolgeler: '/bolgeler.html', hizmetler: '/hizmetler.html' }
    };
    if (knowledge.contact) {
      knowledge.phone = knowledge.phone || knowledge.contact.phone;
      knowledge.whatsapp = knowledge.whatsapp || knowledge.contact.whatsapp;
      knowledge.email = knowledge.email || knowledge.contact.email;
    }
    return knowledge;
  }

  function localReply(q, k) {
    const t = (q || '').toLocaleLowerCase('tr-TR').trim();
    const wa = k.whatsapp || 'https://wa.me/905320683012';
    const phone = k.phone || '+90 532 068 3012';
    const email = k.email || 'teklifal@stagepulse.com.tr';
    if (!t) return 'Stagepulse teknik asistanıyım. Ses sistemi, FOH, ışık, bölgeler veya teklif hakkında sorabilirsiniz.';
    if (/merhaba|selam|hello|iyi gün/.test(t)) return 'Merhaba. Stagepulse; ses sistemi, FOH, sahne, ışık ve teknik planlama konularında yardımcı olabilir.';
    if (/fiyat|ücret|kaç para|bütçe|price|cost/.test(t)) return 'Net fiyat; etkinlik türü, tarih, şehir, mekan, seyirci kapasitesi ve istenen sistem kapsamına göre hazırlanır. Teklif: /teklif.html veya WhatsApp: ' + wa;
    if (/teklif|quote|rezervasyon|başvuru/.test(t)) return 'Teklif için tarih, şehir, mekan, etkinlik türü, tahmini seyirci sayısı ve ihtiyaç duyduğunuz hizmetleri paylaşın. /teklif.html — WhatsApp: ' + wa;
    if (/bölge|şehir|hatay|adana|gaziantep|mersin|şanlıurfa|urfa/.test(t)) return 'Hizmet bölgeleri: ' + (k.regions || []).join(', ') + '. Detay: /bolgeler.html';
    if (/foh|miks|mix|tonmaister|tonmeister|mühendis/.test(t)) return 'FOH (Front of House) mühendisliği ve canlı miks operasyonu; etkinlik öncesi teknik planlama, soundcheck, sistem koordinasyonu ve etkinlik günü operasyonuyla birlikte planlanabilir. /muhendislik.html';
    if (/düğün|kına|nişan/.test(t)) return 'Düğün, kına ve nişan etkinlikleri için ses sistemi, FOH ve sahne ışık çözümleri planlanır. Mekan, tahmini misafir sayısı ve tarih bilgisiyle net teklif hazırlanır. /teklif.html';
    if (/ses sistemi|line array|sub|monitor|monitör|hoparlör/.test(t)) return 'Ses sistemi kapsamı etkinliğe göre Line Array, Point Source, subwoofer ve monitor çözümlerini içerebilir. Doğru sistem için mekan ve seyirci bilgisi gerekir. /hizmetler.html · /ses-sistemi-kiralama.html';
    if (/ışık|light|moving|wash|beam|led|sahne/.test(t)) return 'Sahne ışık çözümleri; Moving Head, Wash, Beam ve LED sistemleriyle etkinliğin ihtiyaçlarına göre planlanabilir. /hizmetler.html';
    if (/dante|network|dijital/.test(t)) return 'Network Audio (Dante) ve dijital ses altyapısı sistem tasarımına dahil edilebilir. /hizmetler.html';
    if (/iletişim|telefon|whatsapp|mail|email|ara/.test(t)) return 'Telefon: ' + phone + '\nE-posta: ' + email + '\nWhatsApp: ' + wa;
    if (/galeri|referans|proje|çalışma/.test(t)) return 'Örnek çalışmalar için /galeri.html, referanslar için /referanslar.html sayfasına bakabilirsiniz.';
    return 'Şunlarda yardımcı olabilirim:\n• Ses sistemi ve sistem seçimi\n• FOH / canlı miks\n• Stage Plot ve teknik rider\n• Sahne ışığı\n• Dante / Network Audio\n• Bölge ve teklif süreci\n\nTeklif: /teklif.html';
  }

  async function askModel(message, history) {
    const k = await loadKnowledge();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const r = await fetch(EDGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: history.slice(-10), page: location.pathname }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (r.ok) {
        const data = await r.json();
        if (data && data.reply) return String(data.reply);
      }
    } catch (_) {}
    return localReply(message, k);
  }

  function readHistory() {
    try {
      const h = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
      return Array.isArray(h) ? h.slice(-10) : [];
    } catch (_) { return []; }
  }

  function saveHistory(history) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(history.slice(-10))); } catch (_) {}
  }

  function mount() {
    if (!document.body || document.getElementById('sp-ai-root')) return;
    removeLegacyAiChips();
    const root = el('div', 'sp-ai-root'); root.id = 'sp-ai-root';
    const panel = el('div', 'sp-ai-panel');
    panel.innerHTML = '<div class="sp-ai-head"><div><strong>Stagepulse AI</strong><span>Ses · FOH · Sistem · Teklif</span></div><button type="button" class="sp-ai-close" aria-label="Kapat">×</button></div><div class="sp-ai-msgs" id="sp-ai-msgs"></div><p class="sp-ai-hint">Stagepulse hakkında bilgi ve yönlendirme. Kesin fiyat için teklif alın.</p><form class="sp-ai-form" id="sp-ai-form"><input type="text" id="sp-ai-input" placeholder="Örn: 500 kişilik etkinlik..." autocomplete="off" maxlength="700"><button type="submit" id="sp-ai-send">Gönder</button></form>';
    const toggle = el('button', 'sp-ai-toggle', '✦'); toggle.type = 'button'; toggle.setAttribute('aria-label', 'Stagepulse AI'); toggle.title = 'Stagepulse AI';
    root.appendChild(panel); root.appendChild(toggle); document.body.appendChild(root);

    const msgs = panel.querySelector('#sp-ai-msgs'), form = panel.querySelector('#sp-ai-form'), input = panel.querySelector('#sp-ai-input'), sendBtn = panel.querySelector('#sp-ai-send');
    const history = readHistory();
    if (history.length) {
      history.forEach(h => addBubble(h.role === 'assistant' ? 'bot' : 'user', h.content));
    } else {
      addBubble('bot', 'Merhaba — Stagepulse teknik asistanıyım.\nSes sistemi, FOH, bölgeler ve teklif süreci hakkında sorabilirsiniz.');
    }

    function addBubble(role, text) {
      const b = el('div', 'sp-ai-bubble ' + role, safeLinkify(text));
      msgs.appendChild(b); msgs.scrollTop = msgs.scrollHeight; return b;
    }

    async function submitText(text) {
      text = (text || '').trim();
      if (!text || busy) return;
      busy = true; sendBtn.disabled = true; input.value = '';
      addBubble('user', text); history.push({ role: 'user', content: text });
      const pending = addBubble('bot', 'Yanıt hazırlanıyor…');
      try {
        const reply = await askModel(text, history.slice(0, -1));
        pending.innerHTML = safeLinkify(reply);
        history.push({ role: 'assistant', content: reply });
        saveHistory(history);
      } catch (_) {
        pending.textContent = 'Şu an yanıt verilemedi. /teklif.html veya WhatsApp üzerinden devam edebilirsiniz.';
      }
      msgs.scrollTop = msgs.scrollHeight; busy = false; sendBtn.disabled = false; input.focus();
    }

    toggle.addEventListener('click', () => { root.classList.toggle('open'); if (root.classList.contains('open')) setTimeout(() => input.focus(), 100); });
    panel.querySelector('.sp-ai-close').addEventListener('click', () => root.classList.remove('open'));
    form.addEventListener('submit', e => { e.preventDefault(); submitText(input.value); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
