(function () {
  'use strict';
  const msgs = document.getElementById('msgs');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const skillsPanel = document.getElementById('skillsPanel');
  const modeBadge = document.getElementById('modeBadge');

  function setOnline() {
    modeBadge.textContent = navigator.onLine ? 'ONLINE (ajan offline)' : 'OFFLINE';
    modeBadge.className = 'badge ' + (navigator.onLine ? 'online' : 'offline');
  }
  setOnline();
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);

  function safe(t) {
    return String(t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function addBubble(role, text, actions) {
    const div = document.createElement('div');
    div.className = 'bubble ' + role;
    div.innerHTML = safe(text);
    if (actions && actions.length) {
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
              setTimeout(function () { btn.textContent = a.label; }, 1200);
            }).catch(function () {});
          });
          bar.appendChild(btn);
        } else if (a.type === 'live-summary') {
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'btn-link'; btn.textContent = a.label || 'Canlı özeti getir';
          btn.addEventListener('click', loadLiveSummary);
          bar.appendChild(btn);
        }
      });
      div.appendChild(bar);
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function loadLiveSummary() {
    if (!navigator.onLine) {
      addBubble('bot', 'Canlı özet için internet bağlantısı gerekli.', []);
      return;
    }
    addBubble('bot', 'Canlı operasyon özeti yetki ve erişim kontrolünden geçiriliyor…', []);
    try {
      const url = 'https://mtjcqqrogjqaxkagwkti.supabase.co/functions/v1/production-os';
      const token = localStorage.getItem('sb-access-token') || sessionStorage.getItem('sb-access-token');
      if (!token) {
        addBubble('bot', 'Oturum doğrulaması bulunamadı. Canlı iç veri açılmadı.', []);
        return;
      }
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ action: 'live_summary' }) });
      const data = await r.json().catch(function () { return {}; });
      if (!r.ok || data.error) {
        addBubble('bot', 'Canlı özet alınamadı. Yetki veya servis durumu kontrol edilmeli.', []);
        return;
      }
      const d = data.data || data;
      const text = ['**Canlı operasyon özeti**', 'İşler: ' + (d.jobs ?? d.job_count ?? '—'), 'Bekleyenler: ' + (d.pending ?? d.pending_count ?? '—'), 'Hazırlık: ' + (d.readiness ?? '—'), 'Son güncelleme: ' + new Date().toLocaleString('tr-TR')].join('\n');
      addBubble('bot', text, []);
    } catch (_) {
      addBubble('bot', 'Canlı özet servisine ulaşılamadı. Yerel Jarvis çalışmaya devam ediyor.', []);
    }
  }

  function loadHist() {
    try { return JSON.parse(sessionStorage.getItem(window.SPAdminAgent.HIST_KEY) || '[]'); } catch (_) { return []; }
  }
  function saveHist(h) {
    try { sessionStorage.setItem(window.SPAdminAgent.HIST_KEY, JSON.stringify(h.slice(-50))); } catch (_) {}
  }

  const hist = loadHist();
  if (hist.length) hist.forEach(function (h) { addBubble(h.role === 'bot' ? 'bot' : h.role, h.text, h.actions); });
  else addBubble('bot', '**Admin Jarvis Pro** hazır.\nToken yok · checklist · WA · teklif özeti · iş kaydı.\n**yardım** veya beceri seç.', []);

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

  document.getElementById('btnSkills').addEventListener('click', function () { skillsPanel.classList.toggle('hidden'); });
  const jobsBtn = document.getElementById('btnJobs');
  if (jobsBtn) jobsBtn.addEventListener('click', function () { input.value = 'işler'; form.requestSubmit(); });
  document.getElementById('btnClear').addEventListener('click', function () {
    sessionStorage.removeItem(window.SPAdminAgent.HIST_KEY);
    msgs.innerHTML = '';
    addBubble('bot', 'Sohbet temizlendi.', []);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    addBubble('user', q, []);
    hist.push({ role: 'user', text: q });
    const res = window.SPAdminAgent.run(q);
    addBubble('bot', res.text, res.actions || []);
    hist.push({ role: 'bot', text: res.text, actions: res.actions || [] });
    saveHist(hist);
  });
})();
