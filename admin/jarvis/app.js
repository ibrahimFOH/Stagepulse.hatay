(function () {
  'use strict';
  const msgs = document.getElementById('msgs');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const skillsPanel = document.getElementById('skillsPanel');
  const modeBadge = document.getElementById('modeBadge');
  const base = () => String(window.STAGEPULSE_RUNTIME?.supabaseUrl || 'https://mtjcqqrogjqaxkagwkti.supabase.co').replace(/\/$/, '');

  function setOnline() {
    modeBadge.textContent = navigator.onLine ? 'ONLINE · canlı' : 'OFFLINE';
    modeBadge.className = 'badge ' + (navigator.onLine ? 'online' : 'offline');
  }
  setOnline();
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);

  function safe(t) {
    return String(t ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function addBubble(role, text, actions) {
    const div = document.createElement('div');
    div.className = 'bubble ' + role;
    div.innerHTML = safe(text);
    if (actions?.length) {
      const bar = document.createElement('div');
      bar.className = 'actions';
      actions.forEach(function (a) {
        if (a.type === 'wa' || a.type === 'link') {
          const link = document.createElement('a');
          link.href = a.href; link.target = '_blank'; link.rel = 'noopener';
          link.className = a.type === 'wa' ? 'btn-wa' : 'btn-link';
          link.textContent = a.label;
          bar.appendChild(link);
        } else if (a.type === 'copy') {
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'btn-copy'; btn.textContent = a.label;
          btn.addEventListener('click', function () {
            navigator.clipboard.writeText(a.payload || '').then(function () {
              btn.textContent = 'Kopyalandı';
              setTimeout(() => { btn.textContent = a.label; }, 1200);
            }).catch(() => {});
          });
          bar.appendChild(btn);
        }
      });
      div.appendChild(bar);
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function getAccessToken() {
    const client = window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;
    if (!client?.auth) return null;
    const result = await client.auth.getSession();
    if (result.error) throw result.error;
    return result?.data?.session?.access_token || null;
  }

  async function callCanonical(message, history) {
    const token = await getAccessToken();
    if (!token) throw new Error('Yönetici oturumu bulunamadı. Admin oturumunu yenileyin.');
    const r = await fetch(base() + '/functions/v1/patron-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ message, history: history.slice(-12) })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) throw new Error(data.error || ('HTTP ' + r.status));
    return data;
  }

  async function sendCanonical(message, history, opts = {}) {
    try {
      const data = await callCanonical(message, history);
      let text = data.reply || 'JARVIS yanıt vermedi.';
      if (data.tool?.name) text += '\n\nAraç: ' + data.tool.name + (data.tool.result ? ' · ' + data.tool.result : '');
      if (data.provider) text += '\nSağlayıcı: ' + data.provider;
      addBubble('bot', text, []);
      if (!opts.skipHistory) {
        history.push({ role: 'bot', text });
        saveHist(history);
      }
      return data;
    } catch (e) {
      const msg = 'JARVIS canlı servisine ulaşılamadı: ' + (e?.message || 'Bağlantı hatası');
      addBubble('bot', msg + '\nYerel Jarvis komutları kullanılabilir.', []);
      return null;
    }
  }

  async function loadLiveSummary() {
    const text = 'Teklifler, işler, müşteriler, ekipman ve okunmamış bildirimlerin canlı yönetim özetini ver.';
    addBubble('bot', 'Canlı yönetim özeti canonical JARVIS üzerinden çalıştırılıyor…', []);
    const h = loadHist();
    await sendCanonical(text, h, { skipHistory: true });
  }

  function loadHist() {
    try { return JSON.parse(sessionStorage.getItem(window.SPAdminAgent.HIST_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveHist(h) {
    try { sessionStorage.setItem(window.SPAdminAgent.HIST_KEY, JSON.stringify(h.slice(-50))); } catch (_) {}
  }

  const hist = loadHist();
  if (hist.length) hist.forEach(h => addBubble(h.role === 'bot' ? 'bot' : h.role, h.text, h.actions));
  else addBubble('bot', '**Admin Jarvis Pro** hazır.\nCanlı işlemler canonical Patron JARVIS endpointi üzerinden yürütülür.', []);

  function renderSkills() {
    skillsPanel.innerHTML = '';
    ((window.SP_ADMIN_KB && window.SP_ADMIN_KB.skills) || []).forEach(function (s) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'skill'; b.textContent = s.label;
      b.addEventListener('click', function () { input.value = s.sample; form.requestSubmit(); });
      skillsPanel.appendChild(b);
    });
  }
  renderSkills();

  document.getElementById('btnSkills')?.addEventListener('click', () => skillsPanel.classList.toggle('hidden'));
  document.getElementById('btnJobs')?.addEventListener('click', () => { input.value = 'işler'; form.requestSubmit(); });
  document.getElementById('btnClear')?.addEventListener('click', function () {
    sessionStorage.removeItem(window.SPAdminAgent.HIST_KEY);
    msgs.innerHTML = '';
    addBubble('bot', 'Sohbet temizlendi.', []);
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    addBubble('user', q, []);
    hist.push({ role: 'user', text: q });
    saveHist(hist);

    const local = window.SPAdminAgent.run(q);
    if (local.text === 'LIVE_SUMMARY_REQUEST') {
      await loadLiveSummary();
      return;
    }

    // Deterministic local commands stay local; general natural-language requests go to canonical JARVIS.
    const isLocal = /^(yardım|help|komut|beceri|not\b|notlar|kayıtlı not|işler$|fiyat not|pricing|fiyatlandırma|bölge|region|etkinlik checklist|checklist etkinlik|foh checklist|checklist foh|ışık checklist|checklist ışık|süreç|sop|paket|wa\b|whatsapp|mesaj|taslak|takip|teyit|kurulum mesaj|brifing|brief|saha\b|gün planı|gun plani|day plan|teklif\b)/i.test(q.trim());
    if (isLocal) {
      addBubble('bot', local.text, local.actions || []);
      hist.push({ role: 'bot', text: local.text, actions: local.actions || [] });
      saveHist(hist);
      return;
    }
    await sendCanonical(q, hist);
  });
})();
