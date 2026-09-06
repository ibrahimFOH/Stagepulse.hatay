/* Stagepulse Jarvis Pro public customer agent v3 — resilient, syntax-safe, AI handoff */
(function () {
  'use strict';

  if (window.__spSiteAi) return;
  window.__spSiteAi = 1;

  const RUNTIME = globalThis.STAGEPULSE_RUNTIME || {};
  const EDGE = RUNTIME.siteAiUrl || window.SP_SITE_AI_URL || 'https://mtjcqqrogjqaxkagwkti.supabase.co/functions/v1/site-ai';
  const SESSION_KEY = 'stagepulse_ai_history_v5';
  const LEAD_KEY = 'stagepulse_ai_lead_v3';
  const WA_NUMBER = '905320683012';
  const SLOT_ORDER = ['event_type', 'date', 'city', 'people', 'services', 'indoor'];

  let knowledge = null;
  let busy = false;
  let lead = readLead();

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function safeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeLinkify(text) {
    let value = safeText(text);
    value = value.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    value = value.replace(/(^|\s)(\/(?:[\w./-]+?)(?:\.html)?)(?=\s|$|[.,;!?])/g, '$1<a href="$2">$2</a>');
    value = value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return value.replace(/\n/g, '<br>');
  }

  function readHistory() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
      return Array.isArray(value) ? value.slice(-30) : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(history) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify((history || []).slice(-30))); } catch (_) {}
  }

  function readLead() {
    try {
      const value = JSON.parse(sessionStorage.getItem(LEAD_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) {
      return {};
    }
  }

  function saveLead() {
    try { sessionStorage.setItem(LEAD_KEY, JSON.stringify(lead || {})); } catch (_) {}
  }

  async function loadKnowledge() {
    if (knowledge) return knowledge;
    try {
      const response = await fetch('/ai-knowledge.json?_=' + Date.now(), { cache: 'no-store' });
      if (response.ok) knowledge = await response.json();
    } catch (_) {}
    if (!knowledge) {
      knowledge = {
        brand: 'Stagepulse',
        assistant_name: 'Stagepulse Jarvis',
        contact: { phone: '+90 532 068 3012', whatsapp: 'https://wa.me/' + WA_NUMBER, email: 'teklifal@stagepulse.com.tr' },
        regions: ['Hatay', 'Antalya', 'Adana', 'Gaziantep', 'Şanlıurfa', 'Mersin'],
        quick_chips: [
          { label: 'Teklif al', q: 'Teklif almak istiyorum' },
          { label: 'Ses sistemi', q: 'Ses sistemi hakkında bilgi' },
          { label: 'FOH', q: 'FOH mühendisliği hakkında bilgi' }
        ]
      };
    }
    if (knowledge.contact) {
      knowledge.phone = knowledge.phone || knowledge.contact.phone;
      knowledge.whatsapp = knowledge.whatsapp || knowledge.contact.whatsapp;
      knowledge.email = knowledge.email || knowledge.contact.email;
    }
    return knowledge;
  }

  function extractSlots(text) {
    const raw = String(text || '');
    const lower = raw.toLocaleLowerCase('tr-TR');
    const result = {};
    const events = [
      [/düğün/, 'düğün'], [/kına/, 'kına'], [/nişan/, 'nişan'], [/konser/, 'konser'], [/festival/, 'festival'],
      [/kurumsal|lansman|toplantı/, 'kurumsal'], [/fuar/, 'fuar'], [/kongre/, 'kongre'], [/tiyatro/, 'tiyatro'],
      [/otel/, 'otel'], [/\bdj\b/, 'DJ'], [/belediye|açık\s*hava/, 'açık hava']
    ];
    for (const [regex, value] of events) if (regex.test(lower)) { result.event_type = value; break; }

    const cities = [
      [/hatay|antakya|defne|iskenderun/, 'Hatay'], [/adana/, 'Adana'], [/gaziantep|antep/, 'Gaziantep'],
      [/şanlıurfa|sanliurfa|\burfa\b/, 'Şanlıurfa'], [/mersin/, 'Mersin'], [/antalya/, 'Antalya']
    ];
    for (const [regex, value] of cities) if (regex.test(lower)) { result.city = value; break; }

    const iso = raw.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
    const tr = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
    if (iso) result.date = iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0');
    else if (tr) result.date = tr[3] + '-' + tr[2].padStart(2, '0') + '-' + tr[1].padStart(2, '0');

    const people = lower.match(/(\d{2,5})\s*(kişi|kişilik|misafir|seyirci|kapasite)/) || lower.match(/(kişi|kişilik|misafir|seyirci)\s*[:=]?\s*(\d{2,5})/);
    if (people) {
      const number = parseInt(/\d/.test(people[1]) ? people[1] : people[2], 10);
      if (number >= 10 && number <= 100000) result.people = String(number);
    }
    if (/açık\s*alan|outdoor|dışarı/.test(lower)) result.indoor = 'açık alan';
    if (/kapalı|salon|indoor|iç\s*mekan/.test(lower)) result.indoor = 'kapalı';

    const services = [];
    if (/ses\s*sistem|line\s*array|pa\b|hoparlör/.test(lower)) services.push('ses sistemi');
    if (/foh|canlı\s*miks|tonmeister|tonmaister/.test(lower)) services.push('FOH');
    if (/ışık|light|moving|wash|beam/.test(lower)) services.push('ışık');
    if (/stage\s*plot|rider|spl/.test(lower)) services.push('Stage Plot / SPL');
    if (/dante|network\s*audio/.test(lower)) services.push('Dante');
    if (services.length) result.services = services.join(', ');

    const venue = raw.match(/(?:mekan|mekân|salon|otel)\s*[:=]?\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9 \-]{3,40})/i);
    if (venue) result.venue = venue[1].trim();
    return result;
  }

  function mergeLead(partial) {
    if (!partial) return;
    Object.keys(partial).forEach((key) => { if (partial[key]) lead[key] = partial[key]; });
    saveLead();
  }
  function filledCount() { return SLOT_ORDER.filter((key) => !!lead[key]).length; }
  function missingSlots() { return SLOT_ORDER.filter((key) => !lead[key]); }

  function leadSummaryLines() {
    const labels = { event_type: 'Etkinlik', date: 'Tarih', city: 'Şehir', venue: 'Mekan', people: 'Kişi', services: 'Hizmet', indoor: 'Alan', notes: 'Not' };
    const lines = [];
    Object.keys(labels).forEach((key) => { if (lead[key]) lines.push(labels[key] + ': ' + lead[key]); });
    return lines;
  }

  function buildWhatsAppUrl(note) {
    const prefix = (knowledge && knowledge.handoff && knowledge.handoff.whatsapp_prefix) || 'Merhaba Stagepulse,\nSite Jarvis üzerinden yazıyorum.\n\n';
    let body = prefix;
    const lines = leadSummaryLines();
    if (lines.length) body += lines.join('\n') + '\n\n';
    if (note) body += note + '\n';
    body += 'Yardımınıza ihtiyacım var.';
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(body);
  }

  function nextQuestion() {
    const missing = missingSlots();
    if (!missing.length) return 'Elimdeki özet:\n' + leadSummaryLines().map((line) => '• ' + line).join('\n') + '\n\nWhatsApp veya /teklif.html ile devam edebilirsiniz.';
    const prompts = {
      event_type: 'Etkinlik türü nedir? (düğün, konser, kurumsal, festival…)',
      date: 'Tarih? (örn. 15.10.2026)',
      city: 'Şehir / bölge? (Hatay, Adana, Gaziantep, Mersin, Şanlıurfa, Antalya…)',
      people: 'Tahmini kaç kişi / seyirci?',
      services: 'Hangi hizmetler? (ses, FOH, ışık, Stage Plot…)',
      indoor: 'Açık alan mı, kapalı salon mu?'
    };
    return prompts[missing[0]] || 'Bir detay daha paylaşabilir misiniz?';
  }

  function localReply(query, data) {
    const text = String(query || '').toLocaleLowerCase('tr-TR').trim();
    const wa = data.whatsapp || 'https://wa.me/' + WA_NUMBER;
    const phone = data.phone || '+90 532 068 3012';
    const email = data.email || 'teklifal@stagepulse.com.tr';
    const regions = (data.regions || []).join(', ');
    mergeLead(extractSlots(query));
    if (!text) return 'Stagepulse Jarvis — ses, FOH, ışık ve teklif. Ne için yazıyorsunuz?';
    if (/personel|insan|canlı\s*destek|görüşmek|konuşmak istiyorum|birisiyle|operatör/.test(text)) return 'Sizi personele yönlendirebilirim. **WhatsApp** butonu bu sohbet özetini de ekler.\nTel: ' + phone + '\n' + wa;
    if (/merhaba|selam|hello|iyi gün|hey\b/.test(text)) return 'Merhaba — **Stagepulse Jarvis**.\nSes sistemi, FOH, bölgeler ve teklif için buradayım.\n' + nextQuestion();
    if (/fiyat|ücret|kaç para|bütçe|price|cost/.test(text)) return 'Net fiyat tür, tarih, şehir, mekan ve kapasiteye göre çıkar.\n' + nextQuestion() + '\nForm: /teklif.html · WA: ' + wa;
    if (/teklif|quote|rezervasyon|başvuru/.test(text)) return missingSlots().length <= 2 ? 'Teklif özeti:\n' + (leadSummaryLines().length ? leadSummaryLines().map((line) => '• ' + line).join('\n') : '• Detay henüz yok') + '\n\n/teklif.html · WA: ' + wa + '\n' + (missingSlots().length ? nextQuestion() : '') : 'Teklif için adım adım gidelim.\n' + nextQuestion();
    if (/bölge|şehir|hatay|adana|gaziantep|mersin|şanlıurfa|urfa|antalya/.test(text)) return 'Hizmet bölgeleri: ' + regions + '.\n/bolgeler.html\n' + (lead.city ? '' : nextQuestion());
    if (/foh|miks|mix|tonmaister|tonmeister|mühendis/.test(text)) return 'FOH: canlı miks, soundcheck ve etkinlik günü operasyonu. Planlama Stage Plot / sistem ile başlar.\n/muhendislik.html\n' + nextQuestion();
    if (/düğün|kına|nişan/.test(text)) return 'Düğün / kına / nişan için ses, FOH ve ışık planlanır.\n' + nextQuestion();
    if (/ses sistemi|line array|sub|monitor|monitör|hoparlör/.test(text)) return 'Ses kapsamı Line Array, Point Source, sub ve monitor içerebilir.\n/ses-sistemi-kiralama.html\n' + nextQuestion();
    if (/ışık|light|moving|wash|beam|led/.test(text)) return 'Sahne ışığı: Moving Head, Wash, Beam, LED.\n/hizmetler.html\n' + nextQuestion();
    if (/dante|network|dijital/.test(text)) return 'Network Audio (Dante) proje bazlı kurulur. /hizmetler.html';
    if (/iletişim|telefon|whatsapp|mail|email|ara\b/.test(text)) return 'Tel: ' + phone + '\nE-posta: ' + email + '\nWhatsApp: ' + wa;
    if (/nasıl çalış|süreç|workflow|adım/.test(text)) return 'Süreç: ihtiyaç → kapsam → plan (Stage Plot/SPL) → teklif → kurulum & canlı operasyon.\n/nasil-calisiyoruz.html';
    if (/referans|galeri|örnek/.test(text)) return 'Referanslar: /referanslar.html · Galeri: /galeri.html';
    if (/sss|sıkça|soru/.test(text)) return 'SSS: /sss.html';
    if (Object.keys(extractSlots(query)).length) return 'Not aldım.\n' + nextQuestion();
    return 'Stagepulse; ses kiralama, FOH, Stage Plot/SPL ve sahne ışığı sunar.\n' + nextQuestion() + '\n/hizmetler.html · /teklif.html · ' + wa;
  }

  async function askModel(message, history) {
    await loadKnowledge();
    mergeLead(extractSlots(message));
    try {
      const response = await fetch(EDGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: (history || []).slice(-12), page: location.pathname || '/', lead })
      });
      if (!response.ok) throw new Error('edge');
      const data = await response.json();
      const reply = String((data && (data.reply || data.message)) || '').trim();
      if (!reply) throw new Error('empty');
      if (data && data.lead && typeof data.lead === 'object') mergeLead(data.lead);
      return reply;
    } catch (_) {
      return localReply(message, knowledge || {});
    }
  }

  function mount() {
    if (document.getElementById('sp-ai-root')) return;
    const root = el('div', 'sp-ai-root');
    const panel = el('div', 'sp-ai-panel');
    root.id = 'sp-ai-root';
    panel.innerHTML = [
      '<div class="sp-ai-head"><div><strong>Stagepulse Jarvis</strong><span>Teknik asistan · teklif</span></div>',
      '<div class="sp-ai-head-actions"><button type="button" class="sp-ai-icon-btn" id="sp-ai-clear" title="Temizle">↺</button>',
      '<button type="button" class="sp-ai-close" aria-label="Kapat">×</button></div></div>',
      '<div class="sp-ai-progress"><i id="sp-ai-prog"></i></div>',
      '<div class="sp-ai-lead" id="sp-ai-lead"></div>',
      '<div class="sp-ai-msgs" id="sp-ai-msgs"></div>',
      '<div class="sp-ai-chips" id="sp-ai-chips"></div>',
      '<div class="sp-ai-actions"><a class="sp-ai-action wa" id="sp-ai-wa" href="#" target="_blank" rel="noopener">WhatsApp</a>',
      '<a class="sp-ai-action quote" href="/teklif.html">Teklif formu</a></div>',
      '<p class="sp-ai-hint">Kesin fiyat yok · sohbet özeti forma veya WhatsApp&#39;a gider</p>',
      '<form class="sp-ai-form" id="sp-ai-form"><input type="text" id="sp-ai-input" placeholder="Örn: 20.09.2026 Hatay düğün 400 kişi açık alan…" autocomplete="off" maxlength="700">',
      '<button type="submit" id="sp-ai-send">Gönder</button></form>'
    ].join('');

    const toggle = el('button', 'sp-ai-toggle', '✦');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Stagepulse Jarvis');
    root.appendChild(panel);
    root.appendChild(toggle);
    document.body.appendChild(root);

    const msgs = panel.querySelector('#sp-ai-msgs');
    const form = panel.querySelector('#sp-ai-form');
    const input = panel.querySelector('#sp-ai-input');
    const sendButton = panel.querySelector('#sp-ai-send');
    const leadBar = panel.querySelector('#sp-ai-lead');
    const chipsElement = panel.querySelector('#sp-ai-chips');
    const waButton = panel.querySelector('#sp-ai-wa');
    const progress = panel.querySelector('#sp-ai-prog');
    const history = readHistory();

    function refreshUI() {
      const lines = leadSummaryLines();
      leadBar.innerHTML = lines.length ? '<strong>Talep</strong> ' + lines.map((line) => '<span class="sp-ai-slot">' + safeText(line) + '</span>').join('') : '';
      waButton.href = buildWhatsAppUrl('');
      progress.style.width = Math.round((filledCount() / SLOT_ORDER.length) * 100) + '%';
    }

    function renderChips() {
      const chips = knowledge && Array.isArray(knowledge.quick_chips) ? knowledge.quick_chips : [];
      chipsElement.innerHTML = '';
      chips.forEach((chip) => {
        const button = el('button', 'sp-ai-chip', safeText(chip.label));
        button.type = 'button';
        button.addEventListener('click', () => submitText(chip.q));
        chipsElement.appendChild(button);
      });
    }

    function addBubble(role, text) {
      const bubble = el('div', 'sp-ai-bubble ' + role, role === 'bot' && text === '…' ? '…' : safeLinkify(text));
      if (role === 'bot' && text === '…') bubble.classList.add('typing');
      msgs.appendChild(bubble);
      msgs.scrollTop = msgs.scrollHeight;
      return bubble;
    }

    if (history.length) history.forEach((item) => addBubble(item.role === 'assistant' ? 'bot' : 'user', item.content));
    else addBubble('bot', 'Merhaba — **Stagepulse Jarvis**.\nSes, FOH, bölgeler ve teklif için yazın.');

    refreshUI();
    loadKnowledge().then(() => { renderChips(); refreshUI(); });

    async function submitText(text) {
      const value = String(text || '').trim();
      if (!value || busy) return;
      busy = true;
      sendButton.disabled = true;
      input.value = '';
      addBubble('user', value);
      history.push({ role: 'user', content: value });
      mergeLead(extractSlots(value));
      refreshUI();
      const pending = addBubble('bot', '…');
      try {
        const reply = await askModel(value, history.slice(0, -1));
        pending.classList.remove('typing');
        pending.innerHTML = safeLinkify(reply);
        history.push({ role: 'assistant', content: reply });
        saveHistory(history);
        refreshUI();
      } catch (_) {
        pending.classList.remove('typing');
        pending.textContent = 'Yanıt alınamadı. /teklif.html veya WhatsApp deneyin.';
      }
      msgs.scrollTop = msgs.scrollHeight;
      busy = false;
      sendButton.disabled = false;
      input.focus();
    }

    toggle.addEventListener('click', () => {
      root.classList.toggle('open');
      if (root.classList.contains('open')) setTimeout(() => input.focus(), 80);
    });
    panel.querySelector('.sp-ai-close').addEventListener('click', () => root.classList.remove('open'));
    panel.querySelector('#sp-ai-clear').addEventListener('click', () => {
      try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(LEAD_KEY); } catch (_) {}
      lead = {};
      history.length = 0;
      msgs.innerHTML = '';
      addBubble('bot', 'Sohbet temizlendi. Nasıl yardımcı olayım?');
      refreshUI();
    });
    form.addEventListener('submit', (event) => { event.preventDefault(); submitText(input.value); });
    waButton.addEventListener('click', refreshUI);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
