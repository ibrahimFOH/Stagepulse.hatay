/* Stagepulse Admin — tam erişim, operasyon + gelir-gider */
const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
const EDGE_LOGIN = `${SUPABASE_URL}/functions/v1/admin-login`;
const EDGE_ACCOUNT = `${SUPABASE_URL}/functions/v1/admin-password-reset`;
const EDGE_STAFF = `${SUPABASE_URL}/functions/v1/staff-manage`;

if (!window.supabase) {
  document.body.innerHTML = '<div style="padding:40px;font-family:system-ui;color:#fff;background:#090909;min-height:100vh">Supabase yüklenemedi. Sayfayı yenileyin.</div>';
  throw new Error('Supabase missing');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Güvenlik ağı: async fonksiyonlardan (onclick handler'ları vb.) kaçan,
// yakalanmamış bir promise reddi olursa kullanıcıyı sessizce bırakmak yerine
// bilgilendir. Bu, her tekil fonksiyonu ayrı ayrı try/catch ile sarmak yerine
// tüm panel genelinde tutarlı bir son çare (fallback) sağlar.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  try {
    toast((event.reason && event.reason.message) || 'Beklenmeyen bir hata oluştu.', false);
  } catch (_) {
    /* toast() henüz tanımlı değilse (çok erken aşama) sessizce yut */
  }
  event.preventDefault();
});

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => Number(v) || 0;
// Backend (edge functions) ile aynı şifre politikası: en az 10 karakter + harf + rakam.
const PASSWORD_POLICY_MSG = 'Şifre en az 10 karakter, en az bir harf ve bir rakam içermeli.';
function isStrongPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return false;
  return /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(pw) && /[0-9]/.test(pw);
}
// Ortak fetch + hata yönetimi yardımcısı (tekrarlayan try/catch bloklarını azaltır)
async function apiFetch(url, opts) {
  let r;
  try {
    r = await fetch(url, opts);
  } catch (netErr) {
    throw new Error('Bağlantı hatası. İnternetinizi kontrol edin.');
  }
  let j = {};
  try { j = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error(j.error || 'İşlem başarısız.');
  return j;
}

let offers = [];
let customers = [];
let settings = {};
let services = [];
let settlements = [];
let equipment = [];
let jobs = [];
let payments = [];
let notifications = [];
let activity = [];

const statuses = {
  new: 'Yeni', reviewing: 'İnceleniyor', preparing: 'Hazırlanıyor', sent: 'Gönderildi',
  accepted: 'Kabul', rejected: 'Red', cancelled: 'İptal', archived: 'Arşiv', expired: 'Süresi doldu'
};
const settleStatus = { open: 'Açık', partial: 'Kısmi', closed: 'Kapandı', cancelled: 'İptal' };

const viewMeta = {
  dashboard: ['Genel Bakış', 'Satış ve operasyon'],
  offers: ['Teklifler', 'Lead ve teklif yönetimi'],
  customers: ['Müşteriler', 'Müşteri geçmişi'],
  settlements: ['Gelir · Gider', 'Anlaşılan → gider → paylaşım'],
  pricing: ['Fiyatlandırma', 'Hizmet ve kurallar'],
  equipment: ['Ekipman', 'Envanter'],
  calendar: ['Takvim / İşler', 'Kurulum ve etkinlik'],
  finance: ['Ödemeler', 'Tahsilat kayıtları'],
  personnel: ['Personel', 'Portal hesapları'],
  analytics: ['Analitik', 'Dönüşüm'],
  activity: ['Aktivite', 'İşlem geçmişi'],
  notifications: ['Bildirimler', 'Sistem uyarıları'],
  settings: ['Ayarlar', 'İşletme ve hesap']
};

function showLogin() {
  const login = document.getElementById('loginView');
  const app = document.getElementById('appView');
  if (login) { login.classList.remove('is-hidden'); login.hidden = false; }
  if (app) { app.classList.add('is-hidden'); app.hidden = true; }
}
function showApp() {
  const login = document.getElementById('loginView');
  const app = document.getElementById('appView');
  if (login) { login.classList.add('is-hidden'); login.hidden = true; }
  if (app) { app.classList.remove('is-hidden'); app.hidden = false; }
}


function closeMobileNav() {
  document.getElementById('sidebar')?.classList.remove('open');
  const ov = document.getElementById('mobileOverlay');
  if (ov) { ov.hidden = true; ov.classList.remove('open'); }
}
function routeView(v) {
  if (!location.hash || location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
}

function bindShell() {
  document.querySelectorAll('#sideNav button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => loadView(btn.dataset.view));
  });
  const openMenu = () => {
    document.getElementById('sidebar')?.classList.add('open');
    const ov = document.getElementById('mobileOverlay');
    if (ov) { ov.hidden = false; ov.classList.add('open'); }
  };
  const closeMenu = () => {
    document.getElementById('sidebar')?.classList.remove('open');
    const ov = document.getElementById('mobileOverlay');
    if (ov) { ov.hidden = true; ov.classList.remove('open'); }
  };
  window.closeMobileNav = closeMenu;
  document.getElementById('menuBtn')?.addEventListener('click', openMenu);
  document.getElementById('sidebarClose')?.addEventListener('click', closeMenu);
  document.getElementById('mobileOverlay')?.addEventListener('click', closeMenu);
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });
  document.getElementById('loginForm')?.addEventListener('submit', login);
}

async function init() {
  bindShell();
  const { data: { session } } = await sb.auth.getSession();
  if (session) { await guard(session); return; }
  showLogin();
}

async function guard(session) {
  const { data: p, error } = await sb.from('admin_profiles').select('username,display_name,active').eq('user_id', session.user.id).maybeSingle();
  if (error || !p?.active) {
    await sb.auth.signOut();
    showLogin();
    $('#loginError').textContent = 'Bu hesap admin yetkisine sahip değil.';
    return;
  }
  showApp();
  $('#adminUser').textContent = '@' + p.username;
  $('#sideAdminName').textContent = p.display_name || p.username;
  const hash = (location.hash || '#dashboard').slice(1);
  await loadView(viewMeta[hash] ? hash : 'dashboard');
}

async function login(e) {
  e.preventDefault();
  const btn = $('#loginBtn');
  const err = $('#loginError');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Giriş…';
  try {
    const body = { username: $('#loginUsername').value.trim(), password: $('#loginPassword').value };
    const j = await apiFetch(EDGE_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify(body)
    });
    if (!j.session?.access_token) throw new Error('Oturum alınamadı');
    await sb.auth.setSession({ access_token: j.session.access_token, refresh_token: j.session.refresh_token });
    await guard((await sb.auth.getSession()).data.session);
  } catch (ex) {
    console.error(ex);
    err.textContent = ex.message || 'Giriş başarısız';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Giriş Yap';
  }
}

async function loadView(v) {
  if (!viewMeta[v]) v = 'dashboard';
  document.querySelectorAll('#sideNav button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  const [title, subtitle] = viewMeta[v];
  $('#viewTitle').textContent = title;
  $('#viewSubtitle').textContent = subtitle;
  routeView(v);
  closeMobileNav();
  const map = {
    dashboard, offers: offersView, customers: customersView, settlements: settlementsView,
    pricing: pricingView, equipment: equipmentView, calendar: calendarView,
    finance: financeView, personnel: personnelView, analytics: analyticsView, activity: activityView,
    notifications: notificationsView, settings: settingsView
  };
  try { await map[v](); } catch (e) { fatal(e); }
}

async function getOffers() {
  const { data, error } = await sb.from('teklifler').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  offers = data || [];
  const badge = $('#navOfferBadge');
  if (badge) {
    const n = offers.filter((x) => x.status === 'new').length;
    badge.textContent = n || '';
    badge.style.display = n ? 'inline-flex' : 'none';
  }
}
async function getSettings() {
  const { data } = await sb.from('business_settings').select('*').eq('id', true).maybeSingle();
  settings = data || {};
  return settings;
}
async function getSettlements() {
  const { data, error } = await sb.from('settlements').select('*').order('event_date', { ascending: false });
  if (error) throw error;
  settlements = data || [];
}
async function log(action, type, id, metadata) {
  try {
    await sb.from('activity_logs').insert({
      action, entity_type: type, entity_id: id, metadata,
      actor_id: (await sb.auth.getUser()).data.user?.id
    });
  } catch (_) {}
}
function fatal(e) {
  console.error(e);
  $('#content').innerHTML = `<div class="notice"><b>Sistem hatası</b><p>${esc(e.message || e)}</p>
    <p class="muted">Supabase migration / RLS / settlements tablosunu kontrol et.</p></div>`;
}
function toast(msg, ok = true) {
  let t = $('#adminToast');
  if (!t) { t = document.createElement('div'); t.id = 'adminToast'; t.className = 'admin-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'admin-toast ' + (ok ? 'ok' : 'err') + ' show';
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── Dashboard ─────────────────────────────────────── */
async function dashboard() {
  await getOffers();
  await getSettings();
  let settleSum = { agreed: 0, expense: 0, ownerRevenue: 0, ownerExpense: 0, ownerProfit: 0, supplier: 0 };
  let activeSettlements = [];
  try {
    await syncSettlementsWithOffers(true);
    activeSettlements = settlements.filter((s) => s.status !== 'cancelled');
    activeSettlements.forEach((s) => {
      settleSum.agreed += num(s.agreed_amount);
      settleSum.expense += num(s.expense_amount);
      settleSum.ownerRevenue += num(s.owner_revenue ?? (s.agreed_amount * num(s.owner_pct) / 100));
      settleSum.ownerExpense += 0;
      settleSum.ownerProfit += num(s.owner_share);
      settleSum.supplier += num(s.supplier_share);
    });
  } catch (_) { settlements = []; }

  const potential = offers.filter((x) => !['archived', 'cancelled', 'expired', 'rejected'].includes(x.status))
    .reduce((a, x) => a + num(x.total || x.estimated_price), 0);
  const revenue = offers.filter((x) => x.status === 'accepted').reduce((a, x) => a + num(x.total), 0);

  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Genel Bakış</h1><p class="muted">Tüm operasyon tek ekranda</p></div>
      <div class="actions">
        <button class="btn btn-primary" onclick="newOffer()">+ Teklif</button>
        <button class="btn" onclick="loadView('settlements')">Gelir · Gider</button>
      </div>
    </div>
    <div class="cards">
      <div class="card kpi-accent"><span class="card-label">Yeni lead</span><div class="metric">${offers.filter(x=>x.status==='new').length}</div></div>
      <div class="card"><span class="card-label">Potansiyel teklif</span><div class="metric">${money(potential)}</div></div>
      <div class="card"><span class="card-label">Kabul ciro</span><div class="metric">${money(revenue)}</div></div>
      <div class="card"><span class="card-label">Senin ciro</span><div class="metric">${money(settleSum.ownerRevenue)}</div></div>
      <div class="card"><span class="card-label">Senin kârın</span><div class="metric">${money(settleSum.ownerProfit)}</div></div>
    </div>
    <div class="grid2" style="margin-top:16px">
      <div class="panel">
        <div class="panel-head"><h3>Son teklifler</h3><button class="btn" onclick="loadView('offers')">Tümü</button></div>
        ${offers.slice(0,6).map(rowOffer).join('') || '<p class="muted empty">Teklif yok</p>'}
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Gelir · Gider özeti</h3><button class="btn" onclick="loadView('settlements')">Aç</button></div>
        <div class="settle-kpi">
          <div><span>Anlaşılan</span><b>${money(settleSum.agreed)}</b></div>
          <div><span>Gider</span><b>${money(settleSum.expense)}</b></div>
          <div><span>Senin ciro</span><b class="ok">${money(settleSum.ownerRevenue)}</b></div>
          <div><span>Senin gider</span><b>${money(settleSum.ownerExpense)}</b></div>
          <div><span>Senin kârın</span><b class="ok">${money(settleSum.ownerProfit)}</b></div>
          <div><span>Diğer pay</span><b>${money(settleSum.supplier)}</b></div>
        </div>
        ${activeSettlements.slice(0,4).map(rowSettlement).join('') || '<p class="muted empty">Kabul teklif yok</p>'}
      </div>
    </div>`;
}

function rowOffer(o) {
  return `<div class="row-item">
    <div class="row-main"><strong>${esc(o.quote_number || 'Teklif')}</strong>
      <span class="muted">${esc(o.name)} · ${esc(o.location || '-')} · ${esc(o.event_date || '-')}</span></div>
    <div class="row-side">
      <span class="status ${esc(o.status)}">${statuses[o.status] || o.status}</span>
      <span class="row-price">${money(o.total)}</span>
      <button class="btn" onclick="openOffer('${o.id}')">Aç</button>
    </div></div>`;
}

/* ── Offers (same core as before) ──────────────────── */
async function offersView() {
  await getOffers();
  await getSettings();
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Teklifler</h1><p class="muted">Lead → teklif → onay</p></div>
      <button class="btn btn-primary" onclick="newOffer()">+ Yeni Teklif</button>
    </div>
    <div class="toolbar">
      <input class="table-search" id="offerSearch" placeholder="Ara…" oninput="filterOffers()">
      <select class="table-search" id="offerStatus" onchange="filterOffers()">
        <option value="">Tüm durumlar</option>
        ${Object.entries(statuses).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
      </select>
    </div>
    <div id="offerList">${offers.map(rowOffer).join('') || '<p class="muted empty">Kayıt yok</p>'}</div>`;
}
function filterOffers() {
  const q = ($('#offerSearch')?.value || '').toLowerCase().trim();
  const st = $('#offerStatus')?.value || '';
  const list = offers.filter((o) => {
    if (st && o.status !== st) return false;
    if (!q) return true;
    return [o.quote_number, o.name, o.company, o.phone, o.location, o.type].join(' ').toLowerCase().includes(q);
  });
  $('#offerList').innerHTML = list.map(rowOffer).join('') || '<p class="muted empty">Sonuç yok</p>';
}

async function openOffer(id) {
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  await getSettings();
  $('#offerModal')?.remove();
  const statusOpts = Object.entries(statuses).map(([k,v]) => `<option value="${k}" ${o.status===k?'selected':''}>${v}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
      <div class="modal-top"><div><div class="muted small">${esc(o.quote_number||'')}</div><h2>${esc(o.name)}</h2></div>
        <span class="status ${esc(o.status)}">${statuses[o.status]||o.status}</span></div>
      <div class="grid2">
        <div class="panel"><h3>Müşteri</h3>
          <p class="info-block"><b>${esc(o.name)}</b><br>${esc(o.company||'—')}<br>
          <a href="tel:${esc(o.phone||'')}">${esc(o.phone||'—')}</a><br>${esc(o.email||'—')}</p>
          <p class="muted small">${esc(o.location||'—')} · ${esc(o.people||'—')} kişi · ${esc(o.event_date||'—')}</p>
        </div>
        <div class="panel"><h3>Fiyat & durum</h3>
          <label>Toplam (₺)<input type="number" id="editTotal" value="${num(o.total)}" min="0" step="100"></label>
          <label>Kâr (₺)<input type="number" id="editMargin" value="${num(o.margin)}" step="100"></label>
          <label>Geçerlilik<input type="date" id="editValid" value="${esc(o.valid_until||'')}"></label>
          <label>Durum<select id="editStatus">${statusOpts}</select></label>
        </div>
      </div>
      <div class="panel" style="margin-top:14px"><h3>Not</h3>
        <textarea id="editMessage" rows="3">${esc(o.message||'')}</textarea></div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveOffer('${o.id}')">Kaydet</button>
        <button class="btn" onclick="copyPublicLink('${o.id}')">Bağlantı</button>
        <button class="btn" onclick="openWhatsApp('${o.id}')">WhatsApp</button>
        <button class="btn" onclick="createPDF('${o.id}')">PDF</button>
        <button class="btn" onclick="settlementFromOffer('${o.id}')">Gelir/Gider’e aktar</button>
        <button class="btn btn-danger" onclick="deleteOffer('${o.id}')">Sil</button>
      </div>
    </div></div>`);
}

async function ensureSettlementFromOffer(o) {
  if (!o?.id) return null;
  const { data: existing } = await sb.from('settlements').select('id,status').eq('offer_id', o.id).limit(1);
  if (existing?.length) {
    // Red/iptal edilmişse yeniden aç
    if (existing[0].status === 'cancelled') {
      await sb.from('settlements').update({
        status: 'open',
        agreed_amount: num(o.total),
        title: [o.quote_number, o.name].filter(Boolean).join(' — ') || o.name || 'Mutabakat',
        event_date: o.event_date || null,
        location: o.location || null,
        updated_at: new Date().toISOString()
      }).eq('id', existing[0].id);
    }
    return existing[0];
  }

  const title = [o.quote_number, o.name].filter(Boolean).join(' — ') || (o.name || 'Mutabakat');
  const payload = {
    title,
    offer_id: o.id,
    event_date: o.event_date || null,
    location: o.location || null,
    agreed_amount: num(o.total),
    expense_amount: 0,
    owner_pct: 100,
    status: 'open',
    notes: o.message || null
  };
  const { data, error } = await sb.from('settlements').insert([payload]).select('id').single();
  if (error) {
    console.error('settlement auto-create', error);
    return null;
  }
  return data;
}

/** Kabul olmayan tekliflerin mutabakatını iptal et / kabul olanları oluştur */
async function syncSettlementsWithOffers(silent = true) {
  try {
    await getOffers();
    await getSettlements();
  } catch (_) { return { created: 0, cancelled: 0 }; }

  const accepted = offers.filter((o) => o.status === 'accepted');
  const acceptedIds = new Set(accepted.map((o) => o.id));
  let created = 0;
  let cancelled = 0;

  // Kabul edilenler → mutabakat oluştur
  for (const o of accepted) {
    const linked = settlements.find((s) => s.offer_id === o.id);
    if (!linked || linked.status === 'cancelled') {
      const r = await ensureSettlementFromOffer(o);
      if (r) created++;
    }
  }

  // Artık kabul olmayan bağlı mutabakatları iptal et (red / iptal / arşiv)
  for (const s of settlements) {
    if (!s.offer_id) continue;
    if (s.status === 'cancelled' || s.status === 'closed') continue;
    if (!acceptedIds.has(s.offer_id)) {
      const { error } = await sb.from('settlements').update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }).eq('id', s.id);
      if (!error) cancelled++;
    }
  }

  if (!silent && (created || cancelled)) {
    toast(`${created ? created + ' eklendi' : ''}${created && cancelled ? ' · ' : ''}${cancelled ? cancelled + ' iptal' : ''}`);
  }
  try { await getSettlements(); } catch (_) {}
  return { created, cancelled };
}

async function saveOffer(id) {
  const o = offers.find((x) => x.id === id);
  const newStatus = $('#editStatus')?.value || 'new';
  const wasAccepted = o?.status === 'accepted';
  const payload = {
    total: num($('#editTotal')?.value),
    margin: num($('#editMargin')?.value),
    estimated_price: num($('#editTotal')?.value),
    valid_until: $('#editValid')?.value || null,
    status: newStatus,
    message: $('#editMessage')?.value?.trim() || '',
    updated_at: new Date().toISOString(),
    accepted_at: newStatus === 'accepted' ? (o?.accepted_at || new Date().toISOString()) : null,
    rejected_at: newStatus === 'rejected' ? new Date().toISOString() : null
  };
  const { error } = await sb.from('teklifler').update(payload).eq('id', id);
  if (error) return toast(error.message, false);
  await log('offer_update', 'teklifler', id, payload);

  // Kabul → otomatik mutabakat | Red/İptal → mutabakatı iptal
  if (newStatus === 'accepted' && !wasAccepted) {
    const updated = { ...(o || {}), ...payload, id, total: payload.total };
    const created = await ensureSettlementFromOffer(updated);
    toast(created ? 'Kaydedildi · Gelir·Gider’e eklendi' : 'Kaydedildi');
  } else if (wasAccepted && newStatus !== 'accepted') {
    await sb.from('settlements').update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('offer_id', id).neq('status', 'closed');
    toast('Kaydedildi · Mutabakat iptal edildi');
  } else {
    // Tutar değiştiyse mutabakat anlaşılan tutarını güncelle
    if (newStatus === 'accepted' && o && num(o.total) !== payload.total) {
      await sb.from('settlements').update({
        agreed_amount: payload.total,
        updated_at: new Date().toISOString()
      }).eq('offer_id', id).eq('status', 'open');
    }
    toast('Kaydedildi');
  }

  $('#offerModal')?.remove();
  await getOffers();
  try { await getSettlements(); } catch (_) {}
  loadView((location.hash || '').slice(1) === 'offers' ? 'offers' : 'dashboard');
}

async function deleteOffer(id) {
  if (!confirm('Kalıcı silinsin mi?')) return;
  const { error } = await sb.from('teklifler').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  $('#offerModal')?.remove();
  loadView('offers');
}
function copyPublicLink(id) {
  const o = offers.find((x) => x.id === id);
  if (!o?.public_token) return toast('Bağlantı yok', false);
  const u = `${location.origin}/teklif-view.html?token=${o.public_token}`;
  navigator.clipboard?.writeText(u);
  toast('Kopyalandı');
}
function openWhatsApp(id) {
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  const link = o.public_token ? `${location.origin}/teklif-view.html?token=${o.public_token}` : '';
  const msg = `Merhaba ${o.name}, Stagepulse ${o.quote_number || ''} teklifiniz hazır.\nToplam: ${money(o.total)}\n${link}`;
  const phone = String(settings.whatsapp || settings.phone || '905320683012').replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}
function createPDF(id) {
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.quote_number)}</title>
    <style>body{font:15px Inter,system-ui;padding:48px;max-width:720px;margin:auto}.total{font-size:22px;font-weight:800;text-align:right;margin-top:24px}</style></head>
    <body><h1>STAGEPULSE</h1><h2>${esc(o.quote_number||'')}</h2>
    <p><b>${esc(o.name)}</b><br>${esc(o.phone||'')}<br>${esc(o.location||'')}</p>
    <p class="total">TOPLAM ${money(o.total)}</p>
    <p>Geçerlilik: ${esc(o.valid_until||'—')}</p><script>window.print()</script></body></html>`);
  w.document.close();
}

function newOffer() {
  $('#offerModal')?.remove();
  const today = new Date().toISOString().slice(0, 10);
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" onclick="$('#offerModal').remove()">×</button>
      <h2>Yeni teklif</h2>
      <div class="grid2">
        <label>Ad / Firma *<input id="nName" required></label>
        <label>Telefon *<input id="nPhone" type="tel" required></label>
        <label>E-posta<input id="nEmail" type="email"></label>
        <label>Lokasyon<input id="nLoc"></label>
        <label>Etkinlik türü<select id="nEventType">
          <option>Konser</option><option>Festival</option><option>Düğün</option>
          <option>Kurumsal</option><option>Özel Etkinlik</option><option>Diğer</option>
        </select></label>
        <label>Hizmet<select id="nType">
          <option>Ses Sistemi Kiralama</option><option>Işık & Truss Kiralama</option>
          <option>FOH Operasyonu</option><option>Paket (Kiralama + Mühendislik)</option>
          <option>Stage Plot / Sahne Planı</option><option>Diğer</option>
        </select></label>
        <label>Kişi<input id="nPeople" type="number" min="1"></label>
        <label>Tarih<input id="nDate" type="date" value="${today}"></label>
        <label>Toplam ₺<input id="nTotal" type="number" min="0" step="100"></label>
        <label>Geçerlilik (gün)<input id="nValidDays" type="number" value="7"></label>
      </div>
      <label style="display:block;margin-top:12px">Not<textarea id="nMessage" rows="2"></textarea></label>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="createOffer()">Oluştur</button>
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
  setTimeout(() => $('#nName')?.focus(), 40);
}

async function createOffer() {
  const name = $('#nName')?.value?.trim();
  const phone = $('#nPhone')?.value?.trim();
  if (!name || !phone) return toast('Ad ve telefon zorunlu', false);
  const total = num($('#nTotal')?.value);
  const days = num($('#nValidDays')?.value) || 7;
  const eventDate = $('#nDate')?.value || null;
  const d = new Date(eventDate || Date.now());
  d.setDate(d.getDate() + days);
  const payload = {
    name, phone,
    email: $('#nEmail')?.value?.trim() || null,
    location: $('#nLoc')?.value?.trim() || null,
    event_type: $('#nEventType')?.value || null,
    type: $('#nType')?.value || null,
    people: num($('#nPeople')?.value) || null,
    event_date: eventDate,
    message: $('#nMessage')?.value?.trim() || null,
    total, estimated_price: total, margin: 0, status: 'preparing',
    valid_until: d.toISOString().slice(0, 10), services: []
  };
  const { data, error } = await sb.from('teklifler').insert([payload]).select().single();
  if (error) {
    const msg = /duplicate|unique|409/i.test(error.message)
      ? 'Numara çakışması (409). fix-409-quote-number.sql çalıştırın.'
      : error.message;
    return toast(msg, false);
  }
  toast('Teklif oluşturuldu');
  $('#offerModal')?.remove();
  await getOffers();
  loadView('offers');
  openOffer(data.id);
}

/* ── SETTLEMENTS: Gelir · Gider (3 aşama) ──────────── */
async function settlementsView() {
  // Kabul teklifler otomatik gelsin, red/iptal olanlar çıkarılsın
  await syncSettlementsWithOffers(true);
  const active = settlements.filter((s) => s.status !== 'cancelled');
  const totA = active.reduce((a, s) => a + num(s.agreed_amount), 0);
  const totE = active.reduce((a, s) => a + num(s.expense_amount), 0);
  const totO = active.reduce((a, s) => a + num(s.owner_share), 0);
  const totDirect = active.filter(s => s.revenue_owner_type === 'owner').reduce((a, s) => a + num(s.owner_share), 0);
  const totShared = active.filter(s => s.revenue_owner_type === 'shared').reduce((a, s) => a + num(s.owner_share), 0);
  const totS = active.reduce((a, s) => a + num(s.supplier_share), 0);

  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h1>Gelir · Gider</h1>
        <p class="muted">Kabul edilen teklifler otomatik gelir · Doğrudan işler %100 senin hanene · Ortak işlerde gider önce ortak kasadan düşer, kalan paylaştırılır</p>
      </div>
      <div class="actions">
        <button class="btn btn-primary" onclick="newSettlement()">+ Manuel kayıt</button>
      </div>
    </div>
    <div class="cards">
      <div class="card"><span class="card-label">Toplam anlaşılan</span><div class="metric">${money(totA)}</div></div>
      <div class="card"><span class="card-label">Toplam gider</span><div class="metric">${money(totE)}</div></div>
      <div class="card kpi-accent"><span class="card-label">Senin net hanen</span><div class="metric">${money(totO)}</div></div>
      <div class="card"><span class="card-label">Doğrudan senin işler</span><div class="metric">${money(totDirect)}</div></div>
      <div class="card"><span class="card-label">Ortak işlerden payın</span><div class="metric">${money(totShared)}</div></div>
      <div class="card"><span class="card-label">Malzemeci payı</span><div class="metric">${money(totS)}</div></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="table-wrap">
        <table class="data-table settle-table">
          <thead>
            <tr>
              <th>İş / başlık</th>
              <th>Tarih</th>
              <th>Anlaşılan</th>
              <th>Gider</th>
              <th>Kalan</th>
              <th>Senin net hanen</th>
              <th>Diğer pay</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${active.map((s) => `
              <tr>
                <td><b>${esc(s.title)}</b><div class="muted small">${esc(s.location || '')}</div></td>
                <td>${esc(s.event_date || '—')}</td>
                <td>${money(s.agreed_amount)}</td>
                <td>${money(s.expense_amount)}</td>
                <td><b>${money(s.net_amount)}</b></td>
                <td class="ok"><b>${money(s.owner_share)}</b></td>
                <td>${money(s.supplier_share)}</td>
                <td><span class="status">${settleStatus[s.status] || s.status}</span></td>
                <td>
                  <button class="btn" onclick="editSettlement('${s.id}')">Düzenle</button>
                  ${s.offer_id ? `<button class="btn" onclick="openOffer('${s.offer_id}')" title="Teklifin kendisini (tutar, tarih, durum vb.) düzenle">Teklifi düzenle</button>` : ''}
                </td>
              </tr>`).join('') || '<tr><td colspan="9" class="muted" style="text-align:center;padding:28px">Kabul edilmiş teklif yok. Teklif durumunu “Kabul” yapınca burada görünür.</td></tr>'}
          </tbody>
        </table>
      </div>
      <p class="muted small" style="margin-top:12px">
        Formül: <code>Kalan = Anlaşılan − Gider</code> ·
        <code>Doğrudan = Anlaşılanın %100'ü</code> · <code>Ortak = (Anlaşılan − ortak gider) × senin %</code> · <code>Partner = 0</code>
      </p>
    </div>`;
}

function rowSettlement(s) {
  return `<div class="row-item">
    <div class="row-main"><strong>${esc(s.title)}</strong>
      <span class="muted">${esc(s.event_date || '')} · Anlaşılan ${money(s.agreed_amount)}</span></div>
    <div class="row-side"><span class="row-price ok">${money(s.owner_share)}</span></div>
  </div>`;
}

function calcPreview() {
  const agreed = num($('#sAgreed')?.value);
  const expense = num($('#sExpense')?.value);
  const type = $('#sOwnerType')?.value || 'owner';
  const pct = type === 'owner' ? 100 : type === 'partner' ? 0 : (num($('#sOwnerPct')?.value) || 33);
  const effectiveExpense = type === 'shared' ? expense : 0;
  const net = agreed - effectiveExpense;
  const owner = Math.round(net * (pct / 100) * 100) / 100;
  const supplier = Math.round(net * ((100 - pct) / 100) * 100) / 100;
  const el = $('#sPreview');
  if (el) {
    el.innerHTML = `
      <div class="settle-preview">
        <div><span>İş cirosu</span><b>${money(agreed)}</b></div>
        <div><span>Ortak gider</span><b>${money(effectiveExpense)}</b></div>
        <div><span>Dağıtılabilir net</span><b>${money(net)}</b></div>
        <div><span>Senin net hanen (${pct}%)</span><b class="ok">${money(owner)}</b></div>
        <div><span>Diğer pay</span><b>${money(supplier)}</b></div>
      </div>`;
  }
}

function updateSettlementFinanceFields() {
  const type = $('#sOwnerType')?.value || 'owner';
  const pct = $('#sOwnerPct');
  const expense = $('#sExpense');
  if (type === 'owner') {
    if (pct) pct.value = 100;
    if (expense) expense.value = 0;
  } else if (type === 'partner') {
    if (pct) pct.value = 0;
    if (expense) expense.value = 0;
  } else if (type === 'shared') {
    if (!num(pct?.value)) pct.value = 33;
    expense?.removeAttribute('disabled');
  }
  if (expense && type !== 'shared') expense.setAttribute('disabled', 'disabled');
  if (pct && type !== 'shared') pct.setAttribute('disabled', 'disabled');
  if (pct && type === 'shared') pct.removeAttribute('disabled');
  calcPreview();
}

function settlementModal(existing) {
  $('#offerModal')?.remove();
  const s = existing || {};
  const today = new Date().toISOString().slice(0, 10);
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" onclick="$('#offerModal').remove()">×</button>
      <h2>${s.id ? 'Mutabakat düzenle' : 'Yeni gelir · gider'}</h2>
      <p class="muted" style="margin-top:-4px">Fiyatlandırmadan bağımsız iş mutabakatı</p>
      <div class="grid2">
        <label>İş / başlık *<input id="sTitle" value="${esc(s.title || '')}" placeholder="Örn. Antakya düğün ses"></label>
        <label>Tarih<input id="sDate" type="date" value="${esc(s.event_date || today)}"></label>
        <label>Lokasyon<input id="sLoc" value="${esc(s.location || '')}"></label>
        <label>Durum<select id="sStatus">
          ${Object.entries(settleStatus).map(([k,v]) =>
            `<option value="${k}" ${(s.status||'open')===k?'selected':''}>${v}</option>`).join('')}
        </select></label>
        <label>Anlaşılan tutar (₺) *<input id="sAgreed" type="number" min="0" step="100"
          value="${num(s.agreed_amount)}" oninput="calcPreview()"></label>
        <label>Gider (₺)<input id="sExpense" type="number" min="0" step="100"
          value="${num(s.expense_amount)}" oninput="calcPreview()"></label>
        <label>Gelir sahibi<select id="sOwnerType">
          <option value="owner" ${(s.revenue_owner_type||'owner')==='owner'?'selected':''}>Doğrudan benim haneme (%100)</option>
          <option value="shared" ${(s.revenue_owner_type||'owner')==='shared'?'selected':''}>Ortak iş (gider düş, sonra paylaştır)</option>
          <option value="partner" ${(s.revenue_owner_type||'owner')==='partner'?'selected':''}>Partner / benim haneme değil</option>
        </select></label>
        <label>Benim payım (%)<input id="sOwnerPct" type="number" min="0" max="100" step="1"
          value="${s.revenue_owner_type === 'shared' ? (num(s.owner_pct) || 33) : (s.revenue_owner_type === 'partner' ? 0 : 100)}" oninput="calcPreview()"></label>
      </div>
      <div id="sPreview" style="margin-top:12px"></div>
      <label style="display:block;margin-top:12px">Not<textarea id="sNotes" rows="2">${esc(s.notes || '')}</textarea></label>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveSettlement('${s.id || ''}')">Kaydet</button>
        ${s.id ? `<button class="btn btn-danger" onclick="deleteSettlement('${s.id}')">Sil</button>` : ''}
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
  calcPreview();
  updateSettlementFinanceFields();
  $('#sOwnerType')?.addEventListener('change', updateSettlementFinanceFields);
}

function newSettlement() { settlementModal(null); }
function editSettlement(id) {
  const s = settlements.find((x) => x.id === id);
  if (s) settlementModal(s);
}

async function settlementFromOffer(id) {
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  $('#offerModal')?.remove();
  settlementModal({
    title: (o.quote_number || '') + ' — ' + (o.name || ''),
    event_date: o.event_date || null,
    location: o.location || '',
    agreed_amount: num(o.total),
    expense_amount: 0,
    owner_pct: 100,
    notes: o.message || '',
    offer_id: o.id
  });
  // stash offer link
  window.__settleOfferId = o.id;
}

async function saveSettlement(id) {
  const title = $('#sTitle')?.value?.trim();
  if (!title) return toast('Başlık zorunlu', false);
  const payload = {
    title,
    event_date: $('#sDate')?.value || null,
    location: $('#sLoc')?.value?.trim() || null,
    agreed_amount: num($('#sAgreed')?.value),
    expense_amount: ($('#sOwnerType')?.value || 'owner') === 'shared' ? num($('#sExpense')?.value) : 0,
    owner_pct: ($('#sOwnerType')?.value || 'owner') === 'shared' ? (num($('#sOwnerPct')?.value) || 33) : (($('#sOwnerType')?.value || 'owner') === 'partner' ? 0 : 100),
    revenue_owner_type: $('#sOwnerType')?.value || 'owner',
    status: $('#sStatus')?.value || 'open',
    notes: $('#sNotes')?.value?.trim() || null,
    updated_at: new Date().toISOString()
  };
  if (window.__settleOfferId) {
    payload.offer_id = window.__settleOfferId;
    window.__settleOfferId = null;
  }
  let error;
  if (id) {
    ({ error } = await sb.from('settlements').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('settlements').insert([payload]));
  }
  if (error) {
    if (/relation.*does not exist|settlements/i.test(error.message)) {
      return toast('settlements tablosu yok. finance-settlements.sql çalıştırın.', false);
    }
    return toast(error.message, false);
  }
  toast('Mutabakat kaydedildi');
  $('#offerModal')?.remove();
  loadView('settlements');
}

async function deleteSettlement(id) {
  if (!confirm('Bu mutabakat silinsin mi?')) return;
  const { error } = await sb.from('settlements').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  $('#offerModal')?.remove();
  loadView('settlements');
}

async function syncAcceptedOffers() {
  const r = await syncSettlementsWithOffers(false);
  if (!r.created && !r.cancelled) toast('Her şey güncel');
  loadView('settlements');
}

/* ── Customers ─────────────────────────────────────── */
async function customersView() {
  const { data } = await sb.from('customers').select('*').order('updated_at', { ascending: false });
  customers = data || [];
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Müşteriler</h1><p class="muted">Tüm müşteri kayıtları</p></div>
      <button class="btn btn-primary" onclick="customerModal(null)">+ Müşteri ekle</button>
    </div>
    <div class="toolbar"><input class="table-search" id="custSearch" placeholder="Ara…" oninput="filterCustomers()"></div>
    <div id="custTable">${renderCustomers(customers)}</div>`;
}
function renderCustomers(list) {
  if (!list.length) return '<p class="muted empty">Kayıt yok</p>';
  return list.map((c) => `<div class="row-item">
    <div class="row-main"><strong>${esc(c.name||'—')}</strong>
      <span class="muted">${esc(c.company||'')} · ${esc(c.phone||'')} · ${esc(c.email||'')}</span></div>
    <div class="row-side">
      <span class="muted small">${esc((c.last_contact_at||c.updated_at||'').slice(0,10))}</span>
      <button class="btn" onclick="customerModal('${c.id}')">Düzenle</button>
    </div>
  </div>`).join('');
}
function filterCustomers() {
  const q = ($('#custSearch')?.value || '').toLowerCase().trim();
  const list = !q ? customers : customers.filter((c) =>
    [c.name, c.company, c.phone, c.email].join(' ').toLowerCase().includes(q));
  $('#custTable').innerHTML = renderCustomers(list);
}
function customerModal(id) {
  const c = id ? customers.find((x) => x.id === id) : null;
  const s = c || { name: '', company: '', phone: '', email: '', notes: '' };
  $('#offerModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
      <h2>${c ? 'Müşteri düzenle' : 'Yeni müşteri'}</h2>
      <div class="grid2">
        <label>Ad *<input id="cName" value="${esc(s.name||'')}"></label>
        <label>Firma<input id="cCompany" value="${esc(s.company||'')}"></label>
        <label>Telefon<input id="cPhone" value="${esc(s.phone||'')}"></label>
        <label>E-posta<input id="cEmail" type="email" value="${esc(s.email||'')}"></label>
      </div>
      <label>Not<textarea id="cNotes" rows="2">${esc(s.notes||'')}</textarea></label>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveCustomer('${c?.id || ''}')">Kaydet</button>
        ${c ? `<button class="btn btn-danger" onclick="deleteCustomer('${c.id}')">Sil</button>` : ''}
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
}
async function saveCustomer(id) {
  const name = $('#cName')?.value?.trim();
  if (!name) return toast('Ad zorunlu', false);
  const payload = {
    name,
    company: $('#cCompany')?.value?.trim() || null,
    phone: $('#cPhone')?.value?.trim() || null,
    email: $('#cEmail')?.value?.trim() || null,
    notes: $('#cNotes')?.value?.trim() || null,
    updated_at: new Date().toISOString()
  };
  let error;
  if (id) ({ error } = await sb.from('customers').update(payload).eq('id', id));
  else ({ error } = await sb.from('customers').insert([payload]));
  if (error) return toast(error.message, false);
  toast('Müşteri kaydedildi');
  $('#offerModal')?.remove();
  loadView('customers');
}
async function deleteCustomer(id) {
  if (!confirm('Bu müşteri silinsin mi?')) return;
  const { error } = await sb.from('customers').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  $('#offerModal')?.remove();
  loadView('customers');
}

/* ── Pricing ───────────────────────────────────────── */
async function pricingView() {
  const { data: rules } = await sb.from('price_rules').select('*').order('name');
  const { data: svc } = await sb.from('services').select('*').order('sort_order');
  services = svc || [];
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Fiyatlandırma</h1><p class="muted">Hizmet taban fiyatları (mutabakattan ayrı)</p></div>
      <div class="actions">
        <button class="btn" onclick="serviceModal(null)">+ Hizmet</button>
        <button class="btn btn-primary" onclick="savePricing()">Kaydet</button>
      </div>
    </div>
    <div class="grid2">
      <div class="panel"><h3>Hizmetler</h3>
        ${(services||[]).map(s=>`<div class="price-row">
          <span style="flex:1;min-width:120px">${esc(s.name)}</span>
          <input class="svc-price" data-id="${s.id}" type="number" value="${num(s.base_price)}" step="100" title="Satış" style="width:100px">
          <input class="svc-cost" data-id="${s.id}" type="number" value="${num(s.base_cost)}" step="100" title="Maliyet" style="width:100px">
          <button class="btn" onclick="serviceModal('${s.id}')" title="Düzenle">✎</button>
          <button class="btn btn-danger" onclick="deleteService('${s.id}')" title="Sil">×</button>
        </div>`).join('')||'<p class="muted">Hizmet yok. + Hizmet ile ekle.</p>'}
        <p class="muted small">Satış · Maliyet · Düzenle · Sil</p>
      </div>
      <div class="panel"><h3>Kurallar</h3>
        ${(rules||[]).map(r=>`<label>${esc(r.name)}
          <input data-rule-id="${r.id}" type="number" value="${num(r.value)}" step="0.01"></label>`).join('')||'<p class="muted">Yok</p>'}
      </div>
    </div>`;
}
async function savePricing() {
  for (const el of $$('[data-rule-id]')) {
    await sb.from('price_rules').update({ value: num(el.value), updated_at: new Date().toISOString() }).eq('id', el.dataset.ruleId);
  }
  for (const el of $$('.svc-cost')) await sb.from('services').update({ base_cost: num(el.value) }).eq('id', el.dataset.id);
  for (const el of $$('.svc-price')) await sb.from('services').update({ base_price: num(el.value) }).eq('id', el.dataset.id);
  toast('Fiyatlandırma kaydedildi');
}
function serviceModal(id) {
  const s = id ? services.find((x) => x.id === id) : null;
  const v = s || { name: '', base_price: 0, base_cost: 0 };
  $('#offerModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
      <h2>${s ? 'Hizmet düzenle' : 'Yeni hizmet'}</h2>
      <label>Ad *<input id="svcName" value="${esc(v.name||'')}" placeholder="Ses sistemi kiralama"></label>
      <div class="grid2">
        <label>Satış fiyatı (₺)<input id="svcPrice" type="number" min="0" step="100" value="${num(v.base_price)}"></label>
        <label>Maliyet (₺)<input id="svcCost" type="number" min="0" step="100" value="${num(v.base_cost)}"></label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveService('${s?.id || ''}')">Kaydet</button>
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
}
async function saveService(id) {
  const name = $('#svcName')?.value?.trim();
  if (!name) return toast('Ad zorunlu', false);
  const payload = {
    name,
    base_price: num($('#svcPrice')?.value),
    base_cost: num($('#svcCost')?.value)
  };
  let error;
  if (id) {
    ({ error } = await sb.from('services').update(payload).eq('id', id));
  } else {
    payload.sort_order = (services.length + 1) * 10;
    ({ error } = await sb.from('services').insert([payload]));
  }
  if (error) return toast(error.message, false);
  toast('Hizmet kaydedildi');
  $('#offerModal')?.remove();
  loadView('pricing');
}
async function deleteService(id) {
  if (!confirm('Bu hizmet silinsin mi?')) return;
  const { error } = await sb.from('services').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  loadView('pricing');
}

/* ── Equipment ─────────────────────────────────────── */
/* ── Equipment CRUD ────────────────────────────────── */
async function equipmentView() {
  const { data, error } = await sb.from('equipment').select('*').order('category');
  if (error) throw error;
  equipment = data || [];
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Ekipman</h1><p class="muted">Envanter listesi — ekle, düzenle, sil</p></div>
      <button class="btn btn-primary" onclick="equipmentModal(null)">+ Ekipman ekle</button>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>Kategori</th><th>Marka</th><th>Model</th><th>Adet</th>
        <th>Günlük maliyet</th><th>Günlük satış</th><th>Durum</th><th></th>
      </tr></thead>
      <tbody>${equipment.map(e=>`<tr>
        <td>${esc(e.category)}</td>
        <td>${esc(e.brand||'—')}</td>
        <td>${esc(e.model||'—')}</td>
        <td>${e.quantity ?? 0}</td>
        <td>${money(e.daily_cost)}</td>
        <td>${money(e.daily_price)}</td>
        <td>${e.active === false ? '<span class="status cancelled">Pasif</span>' : '<span class="status accepted">Aktif</span>'}</td>
        <td><button class="btn" onclick="equipmentModal('${e.id}')">Düzenle</button></td>
      </tr>`).join('')||'<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">Henüz ekipman yok. + Ekipman ekle ile başla.</td></tr>'}
    </tbody></table></div></div>`;
}

function equipmentModal(id) {
  const e = id ? equipment.find((x) => x.id === id) : null;
  const s = e || { category: '', brand: '', model: '', quantity: 1, daily_cost: 0, daily_price: 0, active: true, notes: '' };
  $('#offerModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
      <h2>${e ? 'Ekipman düzenle' : 'Yeni ekipman'}</h2>
      <div class="grid2">
        <label>Kategori *<input id="eqCat" value="${esc(s.category)}" placeholder="Line Array, Sub, Monitor, Konsol, Işık…"></label>
        <label>Marka<input id="eqBrand" value="${esc(s.brand||'')}" placeholder="JBL, d&b, A&H…"></label>
        <label>Model<input id="eqModel" value="${esc(s.model||'')}" placeholder="VTX A8, Avantis…"></label>
        <label>Adet<input id="eqQty" type="number" min="0" step="1" value="${s.quantity ?? 1}"></label>
        <label>Günlük maliyet (₺)<input id="eqCost" type="number" min="0" step="50" value="${num(s.daily_cost)}"></label>
        <label>Günlük satış (₺)<input id="eqPrice" type="number" min="0" step="50" value="${num(s.daily_price)}"></label>
        <label>Durum<select id="eqActive">
          <option value="1" ${s.active !== false ? 'selected' : ''}>Aktif</option>
          <option value="0" ${s.active === false ? 'selected' : ''}>Pasif</option>
        </select></label>
      </div>
      <label>Not<textarea id="eqNotes" rows="2">${esc(s.notes||'')}</textarea></label>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveEquipment('${e?.id || ''}')">Kaydet</button>
        ${e ? `<button class="btn btn-danger" onclick="deleteEquipment('${e.id}')">Sil</button>` : ''}
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
}

async function saveEquipment(id) {
  const category = $('#eqCat')?.value?.trim();
  if (!category) return toast('Kategori zorunlu', false);
  const payload = {
    category,
    brand: $('#eqBrand')?.value?.trim() || null,
    model: $('#eqModel')?.value?.trim() || null,
    quantity: num($('#eqQty')?.value),
    daily_cost: num($('#eqCost')?.value),
    daily_price: num($('#eqPrice')?.value),
    active: $('#eqActive')?.value === '1',
    notes: $('#eqNotes')?.value?.trim() || null,
    updated_at: new Date().toISOString()
  };
  let error;
  if (id) {
    ({ error } = await sb.from('equipment').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('equipment').insert([payload]));
  }
  if (error) return toast(error.message, false);
  toast('Ekipman kaydedildi');
  $('#offerModal')?.remove();
  loadView('equipment');
}

async function deleteEquipment(id) {
  if (!confirm('Bu ekipman silinsin mi?')) return;
  const { error } = await sb.from('equipment').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  $('#offerModal')?.remove();
  loadView('equipment');
}

/* ── Calendar / Jobs CRUD ──────────────────────────── */
const jobStatuses = { planned: 'Planlandı', confirmed: 'Onaylı', in_progress: 'Devam', done: 'Bitti', cancelled: 'İptal' };

async function calendarView() {
  const { data, error } = await sb.from('jobs').select('*').order('event_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  jobs = data || [];
  await getOffers();
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Takvim / İşler</h1><p class="muted">Kurulum, etkinlik, söküm</p></div>
      <button class="btn btn-primary" onclick="jobModal(null)">+ İş ekle</button>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>İş</th><th>Lokasyon</th><th>Kurulum</th><th>Etkinlik</th><th>Söküm</th><th>Durum</th><th></th>
      </tr></thead>
      <tbody>${jobs.map(j=>`<tr>
        <td><strong>${esc(j.title)}</strong></td>
        <td>${esc(j.location||'—')}</td>
        <td>${esc((j.setup_at||'').slice(0,16).replace('T',' '))}</td>
        <td>${esc((j.event_at||'').slice(0,16).replace('T',' '))}</td>
        <td>${esc((j.teardown_at||'').slice(0,16).replace('T',' '))}</td>
        <td><span class="status">${esc(jobStatuses[j.status]||j.status||'—')}</span></td>
        <td><button class="btn" onclick="jobModal('${j.id}')">Düzenle</button></td>
      </tr>`).join('')||'<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">İş kaydı yok. + İş ekle ile başla.</td></tr>'}
    </tbody></table></div></div>`;
}

async function jobModal(id) {
  const j = id ? jobs.find((x) => x.id === id) : null;
  const s = j || { title: '', location: '', setup_at: '', event_at: '', teardown_at: '', status: 'planned', notes: '', offer_id: null };
  const toLocal = (v) => v ? String(v).slice(0, 16) : '';
  if (!offers.length) await getOffers();
  // Ekipman + bu işin malzemeleri
  let eqList = equipment;
  if (!eqList.length) {
    const { data } = await sb.from('equipment').select('id,category,brand,model,quantity').eq('active', true).order('category');
    eqList = data || [];
    equipment = eqList;
  }
  let mats = [];
  if (j?.id) {
    const { data } = await sb.from('job_equipment').select('*').eq('job_id', j.id);
    mats = data || [];
  }
  window.__jobMats = mats.map((m) => ({ equipment_id: m.equipment_id, quantity: m.quantity, notes: m.notes || '' }));
  if (!window.__jobMats.length) window.__jobMats = [];

  const offerOpts = ['<option value="">— Teklif bağlama —</option>']
    .concat(offers.map((o) => `<option value="${o.id}" ${s.offer_id===o.id?'selected':''}>${esc(o.quote_number||'')} · ${esc(o.name)}</option>`))
    .join('');
  const statusOpts = Object.entries(jobStatuses).map(([k,v]) =>
    `<option value="${k}" ${(s.status||'planned')===k?'selected':''}>${v}</option>`).join('');
  const eqOpts = eqList.map((e) =>
    `<option value="${e.id}">${esc([e.category, e.brand, e.model].filter(Boolean).join(' · '))} (stok ${e.quantity})</option>`).join('');

  $('#offerModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card" style="max-width:640px">
      <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
      <h2>${j ? 'İş düzenle' : 'Yeni iş'}</h2>
      <label>Başlık *<input id="jTitle" value="${esc(s.title)}" placeholder="Rixos sahne kurulumu"></label>
      <div class="grid2">
        <label>Lokasyon<input id="jLoc" value="${esc(s.location||'')}"></label>
        <label>Durum<select id="jStatus">${statusOpts}</select></label>
        <label>Kurulum<input id="jSetup" type="datetime-local" value="${toLocal(s.setup_at)}"></label>
        <label>Etkinlik<input id="jEvent" type="datetime-local" value="${toLocal(s.event_at)}"></label>
        <label>Söküm<input id="jTear" type="datetime-local" value="${toLocal(s.teardown_at)}"></label>
        <label>Bağlı teklif<select id="jOffer">${offerOpts}</select></label>
      </div>
      <label>Not<textarea id="jNotes" rows="2">${esc(s.notes||'')}</textarea></label>
      <div class="panel" style="margin-top:12px">
        <h3 style="margin:0 0 8px;font-size:14px">Malzeme listesi (personel portalında adet görünür)</h3>
        <div id="jMatsList"></div>
        <div class="grid2" style="margin-top:8px;align-items:end">
          <label>Ekipman<select id="jMatEq">${eqOpts || '<option value="">Ekipman yok</option>'}</select></label>
          <label>Adet<input id="jMatQty" type="number" min="1" value="1"></label>
        </div>
        <button type="button" class="btn" style="margin-top:8px" onclick="addJobMat()">+ Listeye ekle</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveJob('${j?.id || ''}')">Kaydet</button>
        ${j ? `<button class="btn btn-danger" onclick="deleteJob('${j.id}')">Sil</button>` : ''}
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
  renderJobMats();
}

function renderJobMats() {
  const list = window.__jobMats || [];
  const box = $('#jMatsList');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<p class="muted small">Henüz malzeme yok</p>';
    return;
  }
  box.innerHTML = list.map((m, i) => {
    const e = equipment.find((x) => x.id === m.equipment_id);
    const label = e ? [e.category, e.brand, e.model].filter(Boolean).join(' · ') : m.equipment_id;
    return `<div class="row-item" style="padding:6px 0">
      <div class="row-main"><strong>${esc(label)}</strong> · <b>${m.quantity}</b> adet</div>
      <button type="button" class="btn btn-danger" onclick="removeJobMat(${i})">×</button>
    </div>`;
  }).join('');
}

window.addJobMat = function addJobMat() {
  const equipment_id = $('#jMatEq')?.value;
  const quantity = num($('#jMatQty')?.value) || 1;
  if (!equipment_id) return toast('Ekipman seç', false);
  if (!window.__jobMats) window.__jobMats = [];
  const existing = window.__jobMats.find((x) => x.equipment_id === equipment_id);
  if (existing) existing.quantity = quantity;
  else window.__jobMats.push({ equipment_id, quantity, notes: '' });
  renderJobMats();
};
window.removeJobMat = function removeJobMat(i) {
  window.__jobMats.splice(i, 1);
  renderJobMats();
};

async function saveJob(id) {
  const title = $('#jTitle')?.value?.trim();
  if (!title) return toast('Başlık zorunlu', false);
  const payload = {
    title,
    location: $('#jLoc')?.value?.trim() || null,
    status: $('#jStatus')?.value || 'planned',
    setup_at: $('#jSetup')?.value ? new Date($('#jSetup').value).toISOString() : null,
    event_at: $('#jEvent')?.value ? new Date($('#jEvent').value).toISOString() : null,
    teardown_at: $('#jTear')?.value ? new Date($('#jTear').value).toISOString() : null,
    offer_id: $('#jOffer')?.value || null,
    notes: $('#jNotes')?.value?.trim() || null
  };
  let jobId = id;
  let error;
  if (id) {
    ({ error } = await sb.from('jobs').update(payload).eq('id', id));
  } else {
    const res = await sb.from('jobs').insert([payload]).select('id').single();
    error = res.error;
    jobId = res.data?.id;
  }
  if (error) return toast(error.message, false);

  // Malzeme listesini senkronize et
  if (jobId) {
    await sb.from('job_equipment').delete().eq('job_id', jobId);
    const mats = (window.__jobMats || []).filter((m) => m.equipment_id && num(m.quantity) > 0);
    if (mats.length) {
      const rows = mats.map((m) => ({
        job_id: jobId,
        equipment_id: m.equipment_id,
        quantity: num(m.quantity),
        notes: m.notes || null
      }));
      const { error: mErr } = await sb.from('job_equipment').insert(rows);
      if (mErr) toast('İş kaydedildi; malzeme: ' + mErr.message, false);
      else toast('İş ve malzeme kaydedildi');
    } else toast('İş kaydedildi');
  } else toast('İş kaydedildi');

  $('#offerModal')?.remove();
  loadView('calendar');
}

async function deleteJob(id) {
  if (!confirm('Bu iş silinsin mi?')) return;
  const { error } = await sb.from('jobs').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  $('#offerModal')?.remove();
  loadView('calendar');
}

/* ── Payments CRUD ─────────────────────────────────── */
const payStatuses = { pending: 'Bekliyor', deposit: 'Kapora', partial: 'Kısmi', paid: 'Ödendi', overdue: 'Gecikmiş' };

async function financeView() {
  const { data, error } = await sb.from('payments').select('*').order('due_date', { ascending: false });
  if (error) throw error;
  payments = data || [];
  await getOffers();
  const totPending = payments.filter((p) => ['pending','deposit','partial','overdue'].includes(p.status)).reduce((a,p) => a + num(p.amount), 0);
  const totPaid = payments.filter((p) => p.status === 'paid').reduce((a,p) => a + num(p.amount), 0);
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Ödemeler</h1><p class="muted">Tahsilat kayıtları</p></div>
      <div class="actions">
        <button class="btn" onclick="loadView('settlements')">Gelir · Gider</button>
        <button class="btn btn-primary" onclick="paymentModal(null)">+ Ödeme ekle</button>
      </div>
    </div>
    <div class="cards">
      <div class="card"><span class="card-label">Bekleyen</span><div class="metric">${money(totPending)}</div></div>
      <div class="card kpi-accent"><span class="card-label">Tahsil edilen</span><div class="metric">${money(totPaid)}</div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>Açıklama</th><th>Teklif</th><th>Tutar</th><th>Vade</th><th>Durum</th><th></th>
      </tr></thead>
      <tbody>${payments.map(p=>{
        const o = offers.find((x) => x.id === p.offer_id);
        return `<tr>
          <td>${esc(p.description||'—')}</td>
          <td>${esc(o ? (o.quote_number||o.name) : '—')}</td>
          <td>${money(p.amount)}</td>
          <td>${esc(p.due_date||'—')}</td>
          <td><span class="status">${esc(payStatuses[p.status]||p.status)}</span></td>
          <td><button class="btn" onclick="paymentModal('${p.id}')">Düzenle</button></td>
        </tr>`;
      }).join('')||'<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Ödeme kaydı yok. + Ödeme ekle ile başla.</td></tr>'}
    </tbody></table></div></div>`;
}

function paymentModal(id) {
  const p = id ? payments.find((x) => x.id === id) : null;
  const s = p || { description: '', amount: 0, due_date: '', status: 'pending', offer_id: '', paid_at: null };
  const offerOpts = ['<option value="">— Teklif seç —</option>']
    .concat(offers.map((o) => `<option value="${o.id}" ${s.offer_id===o.id?'selected':''}>${esc(o.quote_number||'')} · ${esc(o.name)} · ${money(o.total)}</option>`))
    .join('');
  const statusOpts = Object.entries(payStatuses).map(([k,v]) =>
    `<option value="${k}" ${(s.status||'pending')===k?'selected':''}>${v}</option>`).join('');
  $('#offerModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
      <h2>${p ? 'Ödeme düzenle' : 'Yeni ödeme'}</h2>
      <label>Bağlı teklif *<select id="pOffer">${offerOpts}</select></label>
      <div class="grid2">
        <label>Tutar (₺) *<input id="pAmount" type="number" min="0" step="100" value="${num(s.amount)}"></label>
        <label>Vade<input id="pDue" type="date" value="${esc(s.due_date||'')}"></label>
        <label>Durum<select id="pStatus">${statusOpts}</select></label>
        <label>Ödeme tarihi<input id="pPaidAt" type="date" value="${esc((s.paid_at||'').slice(0,10))}"></label>
      </div>
      <label>Açıklama<input id="pDesc" value="${esc(s.description||'')}" placeholder="Kapora, kalan bakiye…"></label>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="savePayment('${p?.id || ''}')">Kaydet</button>
        ${p ? `<button class="btn btn-danger" onclick="deletePayment('${p.id}')">Sil</button>` : ''}
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
}

async function savePayment(id) {
  const offer_id = $('#pOffer')?.value;
  if (!offer_id) return toast('Teklif seçimi zorunlu', false);
  const amount = num($('#pAmount')?.value);
  if (amount <= 0) return toast('Tutar girin', false);
  const status = $('#pStatus')?.value || 'pending';
  const payload = {
    offer_id,
    amount,
    description: $('#pDesc')?.value?.trim() || null,
    due_date: $('#pDue')?.value || null,
    status,
    paid_at: status === 'paid'
      ? ($('#pPaidAt')?.value ? new Date($('#pPaidAt').value).toISOString() : new Date().toISOString())
      : ($('#pPaidAt')?.value ? new Date($('#pPaidAt').value).toISOString() : null)
  };
  let error;
  if (id) {
    ({ error } = await sb.from('payments').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('payments').insert([payload]));
  }
  if (error) return toast(error.message, false);
  toast('Ödeme kaydedildi');
  $('#offerModal')?.remove();
  loadView('finance');
}

async function deletePayment(id) {
  if (!confirm('Bu ödeme silinsin mi?')) return;
  const { error } = await sb.from('payments').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  $('#offerModal')?.remove();
  loadView('finance');
}

/* ── Personel (portal hesapları) ───────────────────── */
const staffRoles = { crew: 'Ekip', tech: 'Teknik', warehouse: 'Depo', lead: 'Sorumlu' };
// Personel oluşturma/düzenleme modalındaki "Portalda ne görsün?" listesi.
// key: staff_profiles.permissions içindeki alan adı (edge function ve
// staff-portal.sql'deki view'larla birebir aynı olmalı).
// sensitive: true olanlar varsayılan KAPALI gelir, admin açıkça işaretlemeden
// personelde görünmez (özellikle mali veriler).
const staffPermFields = [
  { key: 'jobs', label: 'İşler', sensitive: false },
  { key: 'equipment', label: 'Ekipman', sensitive: false },
  { key: 'offers', label: 'Teklifler', sensitive: false },
  { key: 'view_assigned_jobs', label: 'Atanan işleri gör', sensitive: false },
  { key: 'accept_job', label: 'İşi kabul et', sensitive: false },
  { key: 'reject_job', label: 'İşi reddet', sensitive: false },
  { key: 'update_job_status', label: 'İş durumu güncelle', sensitive: false },
  { key: 'update_job_notes', label: 'İş notu güncelle', sensitive: false },
  { key: 'manage_job_equipment', label: 'İş ekipmanını yönet', sensitive: false },
  { key: 'view_job_contacts', label: 'İş iletişim bilgilerini gör', sensitive: false },
  { key: 'view_job_documents', label: 'İş dokümanlarını gör', sensitive: false },
  { key: 'equipment_checkout', label: 'Ekipman çıkışı bildir', sensitive: false },
  { key: 'equipment_return', label: 'Ekipman dönüşü bildir', sensitive: false },
  { key: 'report_issue', label: 'Sorun / arıza bildir', sensitive: false },
  { key: 'view_team', label: 'Ekip arkadaşlarını gör', sensitive: false },
  { key: 'customers', label: 'Müşteriler', sensitive: true },
  { key: 'finance', label: 'Tahsilat / Ödemeler', sensitive: true },
  { key: 'pricing', label: 'Fiyat listesi', sensitive: true },
  { key: 'financials', label: 'Maliyet & kâr (mali detay)', sensitive: true }
];
const staffPermDefaults = Object.fromEntries(staffPermFields.map(f => [f.key, !f.sensitive]));
let staffProfiles = [];

async function personnelView() {
  const { data, error } = await sb.from('staff_profiles').select('*').order('display_name');
  if (error) {
    $('#content').innerHTML = `<div class="notice"><b>Personel tablosu yok</b>
      <p>${esc(error.message)}</p>
      <p class="muted">Supabase’de <code>supabase/staff-portal.sql</code> dosyasını çalıştırın.</p></div>`;
    return;
  }
  staffProfiles = data || [];
  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h1>Personel</h1>
        <p class="muted">Portal hesapları · <a href="../portal/" target="_blank" rel="noopener">portal aç ↗</a> · her personelin ne göreceğini sen belirlersin</p>
      </div>
      <button class="btn btn-primary" onclick="staffModal(null)">+ Personel ekle</button>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>Ad</th><th>Kullanıcı</th><th>Rol</th><th>Yetkiler</th><th>Durum</th><th></th>
      </tr></thead>
      <tbody>
        ${staffProfiles.map((p) => {
          const perms = { ...staffPermDefaults, ...(p.permissions || {}) };
          const tags = staffPermFields.filter(f => perms[f.key]).map(f => f.label);
          return `
          <tr>
            <td><strong>${esc(p.display_name)}</strong><div class="muted">${esc(p.phone || '')}</div></td>
            <td>@${esc(p.username)}</td>
            <td>${esc(staffRoles[p.role] || p.role)}</td>
            <td style="font-size:12px">${tags.length ? tags.map(t => `<span class="status" style="margin:2px">${esc(t)}</span>`).join(' ') : '<span class="muted">Yok</span>'}</td>
            <td>${p.active ? '<span class="status accepted">Aktif</span>' : '<span class="status cancelled">Pasif</span>'}</td>
            <td><button class="btn" onclick="staffModal('${p.user_id}')">Düzenle</button></td>
          </tr>`;
        }).join('') || '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Personel yok. + Personel ekle ile portal hesabı oluştur.</td></tr>'}
      </tbody>
    </table></div>
    <p class="muted small" style="margin-top:12px">Personel eklerken “Portalda ne görsün?” ile operasyon yetkilerini verirsin. Mali alanlar (Müşteriler, Tahsilat, Fiyat listesi, Maliyet & kâr) varsayılan olarak kapalıdır — istediğin personel için tek tek açabilirsin.</p>
    </div>`;
}

function staffModal(userId) {
  const p = userId ? staffProfiles.find((x) => x.user_id === userId) : null;
  const roleOpts = Object.entries(staffRoles).map(([k, v]) =>
    `<option value="${k}" ${(p?.role || 'crew') === k ? 'selected' : ''}>${v}</option>`).join('');
  const perms = { ...staffPermDefaults, ...(p?.permissions || {}) };
  const permCheckboxHtml = (f) => `
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="perm_${f.key}" ${perms[f.key] ? 'checked' : ''}> ${esc(f.label)}${f.sensitive ? ' <span class="muted" style="font-size:11px">(mali)</span>' : ''}
          </label>`;
  const basicFields = staffPermFields.filter(f => !f.sensitive);
  const sensitiveFields = staffPermFields.filter(f => f.sensitive);
  $('#offerModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="offerModal">
    <div class="modal-card">
      <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
      <h2>${p ? 'Personel düzenle' : 'Yeni personel hesabı'}</h2>
      <div class="grid2">
        <label>Görünen ad *<input id="stName" value="${esc(p?.display_name || '')}"></label>
        <label>Kullanıcı adı *<input id="stUser" value="${esc(p?.username || '')}" ${p ? 'readonly' : ''} placeholder="ahmet"></label>
        <label>Rol<select id="stRole">${roleOpts}</select></label>
        <label>Telefon<input id="stPhone" value="${esc(p?.phone || '')}"></label>
        <label>${p ? 'Yeni şifre (opsiyonel)' : 'Şifre *'}<input id="stPass" type="password" minlength="10" placeholder="En az 10 karakter, harf + rakam"></label>
        ${p ? `<label>Durum<select id="stActive">
          <option value="1" ${p.active ? 'selected' : ''}>Aktif</option>
          <option value="0" ${!p.active ? 'selected' : ''}>Pasif</option>
        </select></label>` : ''}
      </div>
      <div style="margin-top:14px;padding:12px;border:1px solid #2a2a2a;border-radius:10px;background:#111">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Portalda ne görsün?</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
          ${basicFields.map(permCheckboxHtml).join('')}
        </div>
        <div style="font-size:13px;font-weight:600;margin:14px 0 8px;padding-top:10px;border-top:1px solid #2a2a2a">Mali / hassas veriler <span class="muted" style="font-weight:400;font-size:11px">(varsayılan kapalı)</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
          ${sensitiveFields.map(permCheckboxHtml).join('')}
        </div>
        <p class="muted" style="margin:8px 0 0;font-size:12px">İşaretlenmeyen menü personelde görünmez. “Maliyet &amp; kâr” açık olmadıkça personel hiçbir yerde maliyet/kâr rakamı göremez — teklif ve ekipman ekranlarında sadece bu kutuyu işaretlediğin personelde çıkar.</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="saveStaff('${p?.user_id || ''}')">Kaydet</button>
        ${p ? `<button class="btn btn-danger" onclick="deleteStaff('${p.user_id}')">Sil</button>` : ''}
        <button class="btn" onclick="$('#offerModal').remove()">İptal</button>
      </div>
    </div></div>`);
}

async function staffApi(body) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error('Oturum yok');
  return apiFetch(EDGE_STAFF, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + session.access_token
    },
    body: JSON.stringify(body)
  });
}

function collectStaffPermissions() {
  return Object.fromEntries(
    staffPermFields.map(f => [f.key, !!$(`#perm_${f.key}`)?.checked])
  );
}

async function saveStaff(userId) {
  try {
    const permissions = collectStaffPermissions();
    if (!userId) {
      const username = $('#stUser')?.value?.trim();
      const display_name = $('#stName')?.value?.trim();
      const password = $('#stPass')?.value || '';
      if (!username || !display_name) {
        return toast('Ad ve kullanıcı adı zorunlu', false);
      }
      if (!isStrongPassword(password)) {
        return toast(PASSWORD_POLICY_MSG, false);
      }
      await staffApi({
        action: 'create',
        username,
        display_name,
        password,
        role: $('#stRole')?.value || 'crew',
        phone: $('#stPhone')?.value?.trim() || null,
        permissions
      });
      toast('Personel oluşturuldu');
    } else {
      const payload = {
        action: 'update',
        user_id: userId,
        display_name: $('#stName')?.value?.trim(),
        role: $('#stRole')?.value,
        phone: $('#stPhone')?.value?.trim() || null,
        active: $('#stActive')?.value === '1',
        permissions
      };
      const pw = $('#stPass')?.value || '';
      if (pw) {
        if (!isStrongPassword(pw)) {
          return toast(PASSWORD_POLICY_MSG, false);
        }
        payload.password = pw;
      }
      await staffApi(payload);
      toast('Güncellendi');
    }
    $('#offerModal')?.remove();
    loadView('personnel');
  } catch (e) {
    toast(e.message || 'Hata', false);
  }
}

async function deleteStaff(userId) {
  if (!confirm('Personel hesabı silinsin mi? Giriş yapamaz.')) return;
  try {
    await staffApi({ action: 'delete', user_id: userId });
    toast('Silindi');
    $('#offerModal')?.remove();
    loadView('personnel');
  } catch (e) {
    toast(e.message || 'Hata', false);
  }
}

/* ── Analytics ─────────────────────────────────────── */
async function analyticsView() {
  await getOffers();
  const months = {};
  offers.forEach((o) => {
    const k = (o.created_at || '').slice(0, 7) || '?';
    months[k] = (months[k] || 0) + 1;
  });
  const vals = Object.entries(months).slice(-12);
  const max = Math.max(1, ...vals.map((x) => x[1]));
  const accepted = offers.filter((x) => x.status === 'accepted').length;
  const rate = offers.length ? Math.round((accepted / offers.length) * 100) : 0;
  $('#content').innerHTML = `
    <div class="page-head"><div><h1>Analitik</h1><p class="muted">Teklif dönüşümü</p></div></div>
    <div class="cards">
      <div class="card"><span class="card-label">Toplam teklif</span><div class="metric">${offers.length}</div></div>
      <div class="card"><span class="card-label">Kabul</span><div class="metric">${accepted}</div></div>
      <div class="card kpi-accent"><span class="card-label">Dönüşüm</span><div class="metric">${rate}%</div></div>
    </div>
    <div class="panel" style="margin-top:16px"><h3>Aylık teklif</h3>
      <div class="chart">${vals.map(([m,v])=>`<div class="bar" style="height:${Math.max(8,(v/max)*180)}px"><span>${esc(m.slice(5))}</span></div>`).join('')||'<p class="muted">Veri yok</p>'}
      </div>
    </div>`;
}

/* ── Activity ──────────────────────────────────────── */
async function activityView() {
  const { data, error } = await sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  activity = data || [];
  $('#content').innerHTML = `
    <div class="page-head"><div><h1>Aktivite</h1><p class="muted">Son işlemler</p></div></div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Tarih</th><th>İşlem</th><th>Tür</th><th>Detay</th></tr></thead>
      <tbody>${activity.map(x=>`<tr>
        <td>${esc((x.created_at||'').slice(0,19).replace('T',' '))}</td>
        <td>${esc(x.action)}</td><td>${esc(x.entity_type||'—')}</td>
        <td><code class="small">${esc(JSON.stringify(x.metadata||{}).slice(0,80))}</code></td>
      </tr>`).join('')||'<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Log yok</td></tr>'}
    </tbody></table></div></div>`;
}

/* ── Notifications ─────────────────────────────────── */
async function notificationsView() {
  const { data, error } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  notifications = data || [];
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Bildirimler</h1><p class="muted">Sistem uyarıları</p></div>
      <button class="btn" onclick="markAllNotificationsRead()" ${!notifications.some(n=>!n.read_at)?'disabled':''}>Tümünü okundu say</button>
    </div>
    <div class="panel">${notifications.map(n=>`<div class="row-item" style="${n.read_at?'opacity:.65':''}">
      <div class="row-main"><strong>${esc(n.title)}</strong>
        <span class="muted">${esc(n.body||'')} · ${esc((n.created_at||'').slice(0,16).replace('T',' '))}</span></div>
      <div class="row-side">
        <span class="status">${esc(n.kind||'')}</span>
        ${!n.read_at?`<button class="btn" onclick="markNotificationRead('${n.id}')">Okundu</button>`:''}
        <button class="btn btn-danger" onclick="deleteNotification('${n.id}')">Sil</button>
      </div>
    </div>`).join('')||'<p class="muted empty">Bildirim yok</p>'}</div>`;
}
async function markNotificationRead(id) {
  const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) return toast(error.message, false);
  loadView('notifications');
}
async function markAllNotificationsRead() {
  const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error) return toast(error.message, false);
  toast('Tümü okundu');
  loadView('notifications');
}
async function deleteNotification(id) {
  if (!confirm('Bildirim silinsin mi?')) return;
  const { error } = await sb.from('notifications').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Silindi');
  loadView('notifications');
}

/* ── Settings ──────────────────────────────────────── */
async function settingsView() {
  const s = await getSettings();
  const { data: p } = await sb.from('admin_profiles').select('username,display_name')
    .eq('user_id', (await sb.auth.getUser()).data.user.id).single();
  $('#content').innerHTML = `
    <div class="page-head"><div><h1>Ayarlar</h1><p class="muted">İşletme ve hesap</p></div></div>
    <div class="grid2">
      <div class="panel"><h3>Yönetici</h3>
        <label>Kullanıcı adı<input id="setUsername" value="${esc(p?.username||'')}"></label>
        <label>Yeni e-posta<input id="setEmail" type="email" placeholder="Değiştirmek için yaz"></label>
        <label>Yeni şifre<input id="setPassword" type="password" minlength="10" placeholder="En az 10 karakter, harf + rakam"></label>
        <button class="btn btn-primary" onclick="saveAdminAccount()">Hesabı güncelle</button>
      </div>
      <div class="panel"><h3>İşletme</h3>
        <label>Telefon<input id="bizPhone" value="${esc(s?.phone||'')}"></label>
        <label>WhatsApp<input id="bizWa" value="${esc(s?.whatsapp||'')}"></label>
        <label>E-posta<input id="bizEmail" value="${esc(s?.email||'')}"></label>
        <label>Instagram<input id="bizIg" value="${esc(s?.instagram||'')}"></label>
        <label>Teklif geçerlilik (gün)<input id="validDays" type="number" value="${s?.quote_valid_days||7}"></label>
        <button class="btn btn-primary" onclick="saveBusiness()">Kaydet</button>
      </div>
    </div>`;
}
async function saveBusiness() {
  const payload = {
    phone: $('#bizPhone').value, whatsapp: $('#bizWa').value, email: $('#bizEmail').value,
    instagram: $('#bizIg').value, quote_valid_days: num($('#validDays').value) || 7,
    updated_at: new Date().toISOString()
  };
  const { error } = await sb.from('business_settings').update(payload).eq('id', true);
  if (error) toast(error.message, false); else toast('Kaydedildi');
}
async function saveAdminAccount() {
  const b = {
    username: $('#setUsername').value.trim(),
    email: $('#setEmail').value.trim() || undefined,
    new_password: $('#setPassword').value || undefined
  };
  if (!b.username) return toast('Kullanıcı adı zorunlu', false);
  if (b.new_password && !isStrongPassword(b.new_password)) return toast(PASSWORD_POLICY_MSG, false);
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) return toast('Oturum yok', false);
  try {
    await apiFetch(EDGE_ACCOUNT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify(b)
    });
    toast('Güncellendi');
    setTimeout(() => location.reload(), 800);
  } catch (ex) {
    toast(ex.message || 'Başarısız', false);
  }
}

/* Global */
window.loadView = loadView;
window.newOffer = newOffer;
window.createOffer = createOffer;
window.openOffer = openOffer;
window.saveOffer = saveOffer;
window.deleteOffer = deleteOffer;
window.copyPublicLink = copyPublicLink;
window.openWhatsApp = openWhatsApp;
window.createPDF = createPDF;
window.filterOffers = filterOffers;
window.filterCustomers = filterCustomers;
window.savePricing = savePricing;
window.saveBusiness = saveBusiness;
window.saveAdminAccount = saveAdminAccount;
window.newSettlement = newSettlement;
window.editSettlement = editSettlement;
window.saveSettlement = saveSettlement;
window.deleteSettlement = deleteSettlement;
window.syncAcceptedOffers = syncAcceptedOffers;
window.calcPreview = calcPreview;
window.settlementFromOffer = settlementFromOffer;
window.equipmentModal = equipmentModal;
window.saveEquipment = saveEquipment;
window.deleteEquipment = deleteEquipment;
window.jobModal = jobModal;
window.saveJob = saveJob;
window.deleteJob = deleteJob;
window.paymentModal = paymentModal;
window.savePayment = savePayment;
window.deletePayment = deletePayment;
window.customerModal = customerModal;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;
window.serviceModal = serviceModal;
window.saveService = saveService;
window.deleteService = deleteService;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.deleteNotification = deleteNotification;
window.syncSettlementsWithOffers = syncSettlementsWithOffers;
window.staffModal = staffModal;
window.saveStaff = saveStaff;
window.deleteStaff = deleteStaff;
window.addJobMat = window.addJobMat;
window.removeJobMat = window.removeJobMat;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else init();
