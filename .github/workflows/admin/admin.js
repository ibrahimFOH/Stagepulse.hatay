/* Stagepulse Admin — sade, lüks, operasyon odaklı */
const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
const EDGE_LOGIN = `${SUPABASE_URL}/functions/v1/admin-login`;
const EDGE_ACCOUNT = `${SUPABASE_URL}/functions/v1/admin-password-reset`;

if (!window.supabase) {
  document.body.innerHTML = '<div style="padding:40px;font-family:system-ui;color:#fff;background:#090909;min-height:100vh">Supabase istemcisi yüklenemedi. Sayfayı yenileyin.</div>';
  throw new Error('Supabase client library is not loaded');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(v) || 0);

let offers = [];
let customers = [];
let settings = {};
let services = [];

const statuses = {
  new: 'Yeni',
  reviewing: 'İnceleniyor',
  preparing: 'Hazırlanıyor',
  sent: 'Gönderildi',
  accepted: 'Kabul',
  rejected: 'Red',
  cancelled: 'İptal',
  archived: 'Arşiv',
  expired: 'Süresi doldu'
};

const viewMeta = {
  dashboard: ['Genel Bakış', 'Satış ve operasyon özeti'],
  offers: ['Teklifler', 'Lead ve teklif yönetimi'],
  customers: ['Müşteriler', 'Müşteri geçmişi'],
  pricing: ['Fiyatlandırma', 'Hizmet ve kurallar'],
  settings: ['Ayarlar', 'İşletme ve hesap']
};

/* ── Shell ─────────────────────────────────────────── */
function closeMobileNav() {
  $('#sidebar')?.classList.remove('open');
  $('#mobileOverlay')?.classList.remove('open');
}
function routeView(v) {
  if (!location.hash || location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
}

function bindShell() {
  $('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => loadView(btn.dataset.view));
  });
  $('#menuBtn')?.addEventListener('click', () => {
    $('#sidebar')?.classList.add('open');
    $('#mobileOverlay')?.classList.add('open');
  });
  $('#sidebarClose')?.addEventListener('click', closeMobileNav);
  $('#mobileOverlay')?.addEventListener('click', closeMobileNav);
  $('#logoutBtn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });
  $('#loginForm')?.addEventListener('submit', login);
}

/* ── Auth ──────────────────────────────────────────── */
async function init() {
  bindShell();
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await guard(session);
    return;
  }
  $('#loginView').hidden = false;
  $('#appView').hidden = true;
}

async function guard(session) {
  const { data: p, error } = await sb
    .from('admin_profiles')
    .select('username,display_name,active')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error || !p?.active) {
    await sb.auth.signOut();
    $('#loginView').hidden = false;
    $('#appView').hidden = true;
    $('#loginError').textContent = 'Bu hesap admin yetkisine sahip değil.';
    return;
  }
  $('#loginView').hidden = true;
  $('#appView').hidden = false;
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
  btn.textContent = 'Giriş yapılıyor…';
  try {
    const body = {
      username: $('#loginUsername').value.trim(),
      password: $('#loginPassword').value
    };
    const r = await fetch(EDGE_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Giriş başarısız');
    if (!j.session?.access_token || !j.session?.refresh_token) {
      throw new Error('Oturum alınamadı');
    }
    await sb.auth.setSession({
      access_token: j.session.access_token,
      refresh_token: j.session.refresh_token
    });
    await guard((await sb.auth.getSession()).data.session);
  } catch (ex) {
    console.error('Admin login error:', ex);
    err.textContent = ex.message || 'Giriş başarısız';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Giriş Yap';
  }
}

/* ── Router ────────────────────────────────────────── */
async function loadView(v) {
  if (!viewMeta[v]) v = 'dashboard';
  $('button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  const [title, subtitle] = viewMeta[v];
  $('#viewTitle').textContent = title;
  $('#viewSubtitle').textContent = subtitle;
  routeView(v);
  closeMobileNav();
  const fn = {
    dashboard,
    offers: offersView,
    customers: customersView,
    pricing: pricingView,
    settings: settingsView
  }[v];
  try {
    await fn();
  } catch (e) {
    fatal(e);
  }
}

/* ── Data helpers ──────────────────────────────────── */
async function getOffers() {
  const { data, error } = await sb.from('teklifler').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  offers = data || [];
  const badge = $('#navOfferBadge');
  if (badge) {
    const n = offers.filter((x) => x.status === 'new').length;
    badge.textContent = n ? n : '';
    badge.style.display = n ? 'inline-flex' : 'none';
  }
}

async function getSettings() {
  const { data } = await sb.from('business_settings').select('*').eq('id', true).maybeSingle();
  settings = data || {};
  return settings;
}

async function log(action, type, id, metadata) {
  try {
    await sb.from('activity_logs').insert({
      action,
      entity_type: type,
      entity_id: id,
      metadata,
      actor_id: (await sb.auth.getUser()).data.user?.id
    });
  } catch (e) {
    console.warn(e);
  }
}

function fatal(e) {
  console.error(e);
  $('#content').innerHTML = `<div class="notice"><b>Sistem hatası</b><p>${esc(e.message || e)}</p><p class="muted">Supabase migration ve admin_profiles kaydını kontrol edin.</p></div>`;
}

function toast(msg, ok = true) {
  let t = $('#adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    t.className = 'admin-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'admin-toast ' + (ok ? 'ok' : 'err');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── Dashboard ─────────────────────────────────────── */
async function dashboard() {
  await getOffers();
  await getSettings();
  const active = offers.filter((x) => !['archived', 'cancelled', 'expired'].includes(x.status));
  const potential = active.reduce((a, x) => a + Number(x.total || x.estimated_price || 0), 0);
  const revenue = offers.filter((x) => x.status === 'accepted').reduce((a, x) => a + Number(x.total || 0), 0);
  const newCount = offers.filter((x) => x.status === 'new').length;
  const sentCount = offers.filter((x) => x.status === 'sent').length;

  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h1>Genel Bakış</h1>
        <p class="muted">Tek bakışta satış durumu</p>
      </div>
      <div class="actions">
        <button class="admin-btn primary" onclick="newOffer()">+ Yeni Teklif</button>
        <button class="admin-btn" onclick="loadView('offers')">Tüm teklifler</button>
      </div>
    </div>
    <div class="cards">
      <div class="card kpi-accent"><span class="card-label">Yeni lead</span><div class="metric">${newCount}</div></div>
      <div class="card"><span class="card-label">Gönderilmiş</span><div class="metric">${sentCount}</div></div>
      <div class="card"><span class="card-label">Potansiyel</span><div class="metric">${money(potential)}</div></div>
      <div class="card"><span class="card-label">Kabul ciro</span><div class="metric">${money(revenue)}</div></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <div class="panel-head"><h3>Son teklifler</h3><button class="admin-btn" onclick="loadView('offers')">Tümü</button></div>
      ${offers.slice(0, 8).map(rowOffer).join('') || '<p class="muted empty">Henüz teklif yok. Müşteri formundan veya “+ Yeni Teklif” ile ekleyin.</p>'}
    </div>`;
}

function rowOffer(o) {
  return `<div class="row-item">
    <div class="row-main">
      <strong>${esc(o.quote_number || 'Teklif')}</strong>
      <span class="muted">${esc(o.name)} · ${esc(o.location || '-')} · ${esc(o.event_date || '-')}</span>
    </div>
    <div class="row-side">
      <span class="status ${esc(o.status)}">${statuses[o.status] || o.status}</span>
      <span class="row-price">${money(o.total)}</span>
      <button class="admin-btn" onclick="openOffer('${o.id}')">Aç</button>
    </div>
  </div>`;
}

/* ── Offers ────────────────────────────────────────── */
async function offersView() {
  await getOffers();
  await getSettings();
  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <h1>Teklifler</h1>
        <p class="muted">Lead → teklif → onay akışı</p>
      </div>
      <button class="admin-btn primary" onclick="newOffer()">+ Yeni Teklif</button>
    </div>
    <div class="toolbar">
      <input class="table-search" id="offerSearch" placeholder="İsim, telefon, lokasyon, no ara…" oninput="filterOffers()">
      <select class="table-search" id="offerStatus" onchange="filterOffers()">
        <option value="">Tüm durumlar</option>
        ${Object.entries(statuses).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
    </div>
    <div id="offerList">${offers.map(rowOffer).join('') || '<p class="muted empty">Kayıt yok.</p>'}</div>`;
}

function filterOffers() {
  const q = ($('#offerSearch')?.value || '').toLowerCase().trim();
  const st = $('#offerStatus')?.value || '';
  const list = offers.filter((o) => {
    if (st && o.status !== st) return false;
    if (!q) return true;
    const hay = [o.quote_number, o.name, o.company, o.phone, o.location, o.type, o.event_type].join(' ').toLowerCase();
    return hay.includes(q);
  });
  $('#offerList').innerHTML = list.map(rowOffer).join('') || '<p class="muted empty">Sonuç yok.</p>';
}

/* ── Offer detail (editable) ───────────────────────── */
async function openOffer(id) {
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  await getSettings();
  $('#offerModal')?.remove();
  const statusOpts = Object.entries(statuses)
    .map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`)
    .join('');

  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="modal" id="offerModal" role="dialog" aria-modal="true">
      <div class="modal-card">
        <button class="close" type="button" onclick="$('#offerModal').remove()" aria-label="Kapat">×</button>
        <div class="modal-top">
          <div>
            <div class="muted small">${esc(o.quote_number || '')}</div>
            <h2>${esc(o.name)}</h2>
          </div>
          <span class="status ${esc(o.status)}">${statuses[o.status] || o.status}</span>
        </div>

        <div class="grid2">
          <div class="panel">
            <h3>Müşteri</h3>
            <p class="info-block">
              <b>${esc(o.name)}</b><br>
              ${esc(o.company || '—')}<br>
              <a href="tel:${esc(o.phone || '')}">${esc(o.phone || '—')}</a><br>
              ${esc(o.email || '—')}
            </p>
            <p class="muted small">${esc(o.location || '—')} · ${esc(o.people || '—')} kişi · ${esc(o.event_date || '—')}</p>
            <p class="muted small">Tür: ${esc(o.event_type || o.type || '—')}</p>
          </div>
          <div class="panel">
            <h3>Fiyat & durum</h3>
            <label>Toplam (₺)
              <input type="number" id="editTotal" value="${Number(o.total) || 0}" min="0" step="100">
            </label>
            <label>Kâr / marj (₺)
              <input type="number" id="editMargin" value="${Number(o.margin) || 0}" step="100">
            </label>
            <label>Geçerlilik
              <input type="date" id="editValid" value="${esc(o.valid_until || '')}">
            </label>
            <label>Durum
              <select id="editStatus">${statusOpts}</select>
            </label>
          </div>
        </div>

        <div class="panel" style="margin-top:14px">
          <h3>Not / mesaj</h3>
          <textarea id="editMessage" rows="3" placeholder="İç not veya müşteri mesajı…">${esc(o.message || '')}</textarea>
        </div>

        <div class="modal-actions">
          <button class="admin-btn primary" type="button" onclick="saveOffer('${o.id}')">Kaydet</button>
          <button class="admin-btn" type="button" onclick="copyPublicLink('${o.id}')">Bağlantı kopyala</button>
          <button class="admin-btn" type="button" onclick="openWhatsApp('${o.id}')">WhatsApp</button>
          <button class="admin-btn" type="button" onclick="createPDF('${o.id}')">PDF</button>
          <button class="admin-btn danger-btn" type="button" onclick="deleteOffer('${o.id}')">Sil</button>
        </div>
      </div>
    </div>`
  );
}

async function saveOffer(id) {
  const total = Number($('#editTotal')?.value) || 0;
  const margin = Number($('#editMargin')?.value) || 0;
  const valid_until = $('#editValid')?.value || null;
  const status = $('#editStatus')?.value || 'new';
  const message = $('#editMessage')?.value?.trim() || '';
  const payload = {
    total,
    margin,
    estimated_price: total,
    valid_until,
    status,
    message,
    updated_at: new Date().toISOString(),
    accepted_at: status === 'accepted' ? new Date().toISOString() : null,
    rejected_at: status === 'rejected' ? new Date().toISOString() : null
  };
  const { error } = await sb.from('teklifler').update(payload).eq('id', id);
  if (error) {
    toast(error.message, false);
    return;
  }
  await log('offer_update', 'teklifler', id, payload);
  toast('Teklif kaydedildi');
  $('#offerModal')?.remove();
  await getOffers();
  const v = (location.hash || '').slice(1);
  loadView(v === 'offers' ? 'offers' : 'dashboard');
}

async function setStatus(id, status) {
  const { error } = await sb
    .from('teklifler')
    .update({
      status,
      accepted_at: status === 'accepted' ? new Date().toISOString() : undefined,
      rejected_at: status === 'rejected' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  if (error) return toast(error.message, false);
  await log('status_change', 'teklifler', id, { status });
  toast('Durum güncellendi');
  $('#offerModal')?.remove();
  loadView('offers');
}

async function deleteOffer(id) {
  if (!confirm('Bu teklif kalıcı olarak silinsin mi?')) return;
  const { error } = await sb.from('teklifler').delete().eq('id', id);
  if (error) return toast(error.message, false);
  await log('delete', 'teklifler', id, {});
  toast('Silindi');
  $('#offerModal')?.remove();
  loadView('offers');
}

function copyPublicLink(id) {
  const o = offers.find((x) => x.id === id);
  if (!o?.public_token) return toast('Bağlantı yok', false);
  const u = `${location.origin}/teklif-view.html?token=${o.public_token}`;
  navigator.clipboard?.writeText(u);
  toast('Bağlantı kopyalandı');
}

function openWhatsApp(id) {
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  const link = o.public_token ? `${location.origin}/teklif-view.html?token=${o.public_token}` : '';
  const msg = `Merhaba ${o.name}, Stagepulse ${o.quote_number || ''} numaralı teklifiniz hazır.\nToplam: ${money(o.total)}\n${link ? 'Bağlantı: ' + link : ''}`;
  const phone = String(settings.whatsapp || settings.phone || '905320683012').replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function createPDF(id) {
  const o = offers.find((x) => x.id === id);
  if (!o) return;
  const w = window.open('', '_blank');
  const rows = (Array.isArray(o.services) ? o.services : [])
    .map((x) => `<tr><td>${esc(x.name || x.description || '')}</td><td>${x.quantity || 1}</td><td>${money(x.total || x.price || 0)}</td></tr>`)
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.quote_number)} — Stagepulse</title>
    <style>
      body{font:15px/1.5 Inter,system-ui,sans-serif;color:#111;padding:48px;max-width:720px;margin:0 auto}
      h1{font-size:22px;letter-spacing:.12em;margin:0}
      h2{font-size:18px;margin:24px 0 8px}
      .muted{color:#666}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th,td{border-bottom:1px solid #e5e5e5;padding:10px 6px;text-align:left}
      .total{font-size:22px;font-weight:800;text-align:right;margin-top:28px}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>STAGEPULSE</h1>
    <p class="muted">Profesyonel Ses & Sahne Teknolojileri</p>
    <h2>Teklif ${esc(o.quote_number || '')}</h2>
    <p><b>${esc(o.name)}</b><br>${esc(o.company || '')}<br>${esc(o.phone || '')}<br>${esc(o.location || '')}</p>
    <p>Etkinlik: ${esc(o.event_type || o.type || '—')} · ${esc(o.event_date || '—')} · ${esc(o.people || '—')} kişi</p>
    <table><thead><tr><th>Hizmet</th><th>Adet</th><th>Tutar</th></tr></thead><tbody>
    ${rows || '<tr><td colspan="3">—</td></tr>'}
    </tbody></table>
    <p class="total">TOPLAM ${money(o.total)}</p>
    <p class="muted">Geçerlilik: ${esc(o.valid_until || '—')}</p>
    <p>${esc(o.message || '')}</p>
    <script>window.print()</script></body></html>`);
  w.document.close();
}

/* ── New offer ─────────────────────────────────────── */
function newOffer() {
  $('#offerModal')?.remove();
  const today = new Date().toISOString().slice(0, 10);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="modal" id="offerModal" role="dialog" aria-modal="true">
      <div class="modal-card">
        <button class="close" type="button" onclick="$('#offerModal').remove()">×</button>
        <h2>Yeni teklif</h2>
        <p class="muted" style="margin-top:-6px">Müşteri bilgisi + tutar. Kaydedince teklif numarası otomatik oluşur.</p>
        <div class="grid2">
          <label>Ad Soyad / Firma *<input id="nName" required placeholder="Ad veya firma"></label>
          <label>Telefon *<input id="nPhone" type="tel" required placeholder="05xx…"></label>
          <label>E-posta<input id="nEmail" type="email" placeholder="opsiyonel"></label>
          <label>Lokasyon / Şehir<input id="nLoc" placeholder="Hatay, Antakya…"></label>
          <label>Etkinlik türü
            <select id="nEventType">
              <option value="Konser">Konser</option>
              <option value="Festival">Festival</option>
              <option value="Düğün">Düğün</option>
              <option value="Kurumsal">Kurumsal</option>
              <option value="Özel Etkinlik">Özel Etkinlik</option>
              <option value="Diğer">Diğer</option>
            </select>
          </label>
          <label>Hizmet / paket
            <select id="nType">
              <option value="Ses Sistemi Kiralama">Ses Sistemi Kiralama</option>
              <option value="Işık & Truss Kiralama">Işık & Truss</option>
              <option value="FOH Operasyonu">FOH Operasyonu</option>
              <option value="Paket (Kiralama + Mühendislik)">Paket</option>
              <option value="Stage Plot / Sahne Planı">Stage Plot</option>
              <option value="3D Sahne Çizimi">3D Sahne</option>
              <option value="Diğer">Diğer</option>
            </select>
          </label>
          <label>Kişi sayısı<input id="nPeople" type="number" min="1" placeholder="ör. 500"></label>
          <label>Etkinlik tarihi<input id="nDate" type="date" value="${today}"></label>
          <label>Toplam tutar (₺)<input id="nTotal" type="number" min="0" step="100" placeholder="0"></label>
          <label>Geçerlilik (gün)<input id="nValidDays" type="number" min="1" value="7"></label>
        </div>
        <label style="display:block;margin-top:12px">Mesaj / not
          <textarea id="nMessage" rows="3" placeholder="Kısa not…"></textarea>
        </label>
        <div class="modal-actions">
          <button class="admin-btn primary" type="button" onclick="createOffer()">Oluştur</button>
          <button class="admin-btn" type="button" onclick="$('#offerModal').remove()">İptal</button>
        </div>
      </div>
    </div>`
  );
  setTimeout(() => $('#nName')?.focus(), 50);
}

async function createOffer() {
  const name = $('#nName')?.value?.trim();
  const phone = $('#nPhone')?.value?.trim();
  if (!name || !phone) {
    toast('Ad ve telefon zorunlu', false);
    return;
  }
  const total = Number($('#nTotal')?.value) || 0;
  const days = Number($('#nValidDays')?.value) || 7;
  const eventDate = $('#nDate')?.value || null;
  let validUntil = null;
  if (eventDate) {
    const d = new Date(eventDate);
    d.setDate(d.getDate() + days);
    validUntil = d.toISOString().slice(0, 10);
  } else {
    const d = new Date();
    d.setDate(d.getDate() + days);
    validUntil = d.toISOString().slice(0, 10);
  }
  const payload = {
    name,
    phone,
    email: $('#nEmail')?.value?.trim() || null,
    company: null,
    location: $('#nLoc')?.value?.trim() || null,
    event_type: $('#nEventType')?.value || null,
    type: $('#nType')?.value || null,
    people: Number($('#nPeople')?.value) || null,
    event_date: eventDate,
    message: $('#nMessage')?.value?.trim() || null,
    total,
    estimated_price: total,
    margin: 0,
    status: 'preparing',
    valid_until: validUntil,
    services: []
  };
  const { data, error } = await sb.from('teklifler').insert([payload]).select().single();
  if (error) {
    toast(error.message, false);
    return;
  }
  await log('create', 'teklifler', data.id, { name });
  toast('Teklif oluşturuldu');
  $('#offerModal')?.remove();
  await getOffers();
  loadView('offers');
  openOffer(data.id);
}

/* ── Customers ─────────────────────────────────────── */
async function customersView() {
  const { data } = await sb.from('customers').select('*').order('updated_at', { ascending: false });
  customers = data || [];
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Müşteriler</h1><p class="muted">Kayıtlı müşteri geçmişi</p></div>
    </div>
    <div class="toolbar">
      <input class="table-search" id="custSearch" placeholder="İsim, telefon, firma ara…" oninput="filterCustomers()">
    </div>
    <div id="custTable">${renderCustomers(customers)}</div>`;
}

function renderCustomers(list) {
  if (!list.length) return '<p class="muted empty">Henüz müşteri kaydı yok.</p>';
  return list
    .map(
      (c) => `<div class="row-item">
      <div class="row-main">
        <strong>${esc(c.name || '—')}</strong>
        <span class="muted">${esc(c.company || '')} · ${esc(c.phone || '')} · ${esc(c.email || '')}</span>
      </div>
      <div class="row-side"><span class="muted small">${esc((c.last_contact_at || c.updated_at || '').slice(0, 10))}</span></div>
    </div>`
    )
    .join('');
}

function filterCustomers() {
  const q = ($('#custSearch')?.value || '').toLowerCase().trim();
  const list = !q
    ? customers
    : customers.filter((c) => [c.name, c.company, c.phone, c.email].join(' ').toLowerCase().includes(q));
  $('#custTable').innerHTML = renderCustomers(list);
}

/* ── Pricing ───────────────────────────────────────── */
async function pricingView() {
  const { data: rules } = await sb.from('price_rules').select('*').order('name');
  const { data: svc } = await sb.from('services').select('*').order('sort_order');
  services = svc || [];
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Fiyatlandırma</h1><p class="muted">Hizmet taban fiyatları ve kurallar</p></div>
      <button class="admin-btn primary" onclick="savePricing()">Kaydet</button>
    </div>
    <div class="grid2">
      <div class="panel">
        <h3>Hizmetler</h3>
        ${(services || [])
          .map(
            (s) => `<div class="price-row">
            <span>${esc(s.name)}</span>
            <input class="svc-price" data-id="${s.id}" type="number" value="${Number(s.base_price) || 0}" step="100" title="Satış">
            <input class="svc-cost" data-id="${s.id}" type="number" value="${Number(s.base_cost) || 0}" step="100" title="Maliyet">
          </div>`
          )
          .join('') || '<p class="muted">Hizmet kaydı yok.</p>'}
        <p class="muted small" style="margin-top:10px">Sol: satış · Sağ: maliyet</p>
      </div>
      <div class="panel">
        <h3>Kurallar</h3>
        ${(rules || [])
          .map(
            (r) => `<label>${esc(r.name)}
            <input data-rule-id="${r.id}" type="number" value="${Number(r.value) || 0}" step="0.01">
          </label>`
          )
          .join('') || '<p class="muted">Kural yok.</p>'}
      </div>
    </div>`;
}

async function savePricing() {
  for (const el of $$('[data-rule-id]')) {
    await sb
      .from('price_rules')
      .update({ value: Number(el.value) || 0, updated_at: new Date().toISOString() })
      .eq('id', el.dataset.ruleId);
  }
  for (const el of $$('.svc-cost')) {
    await sb.from('services').update({ base_cost: Number(el.value) || 0 }).eq('id', el.dataset.id);
  }
  for (const el of $$('.svc-price')) {
    await sb.from('services').update({ base_price: Number(el.value) || 0 }).eq('id', el.dataset.id);
  }
  await log('pricing_update', 'price_rules', null, {});
  toast('Fiyatlandırma kaydedildi');
}

/* ── Settings ──────────────────────────────────────── */
async function settingsView() {
  const s = await getSettings();
  const { data: p } = await sb
    .from('admin_profiles')
    .select('username,display_name')
    .eq('user_id', (await sb.auth.getUser()).data.user.id)
    .single();
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Ayarlar</h1><p class="muted">İşletme ve yönetici hesabı</p></div>
    </div>
    <div class="grid2">
      <div class="panel">
        <h3>Yönetici hesabı</h3>
        <label>Kullanıcı adı<input id="setUsername" value="${esc(p?.username || '')}"></label>
        <label>Yeni e-posta<input id="setEmail" type="email" placeholder="Değiştirmek için yazın"></label>
        <label>Yeni şifre<input id="setPassword" type="password" minlength="8" placeholder="En az 8 karakter"></label>
        <button class="admin-btn primary" onclick="saveAdminAccount()">Hesabı güncelle</button>
        <p class="muted small">Şifre tarayıcıya kaydedilmez. E-posta değişiminde doğrulama gerekebilir.</p>
      </div>
      <div class="panel">
        <h3>İşletme</h3>
        <label>Telefon<input id="bizPhone" value="${esc(s?.phone || '')}"></label>
        <label>WhatsApp<input id="bizWa" value="${esc(s?.whatsapp || '')}"></label>
        <label>E-posta<input id="bizEmail" value="${esc(s?.email || '')}"></label>
        <label>Instagram<input id="bizIg" value="${esc(s?.instagram || '')}"></label>
        <label>Teklif geçerlilik (gün)<input id="validDays" type="number" value="${s?.quote_valid_days || 7}"></label>
        <button class="admin-btn primary" onclick="saveBusiness()">Kaydet</button>
      </div>
    </div>`;
}

async function saveBusiness() {
  const payload = {
    phone: $('#bizPhone').value,
    whatsapp: $('#bizWa').value,
    email: $('#bizEmail').value,
    instagram: $('#bizIg').value,
    quote_valid_days: Number($('#validDays').value) || 7,
    updated_at: new Date().toISOString()
  };
  const { error } = await sb.from('business_settings').update(payload).eq('id', true);
  if (error) toast(error.message, false);
  else {
    toast('İşletme ayarları kaydedildi');
    await log('business_settings_update', 'business_settings', null, payload);
  }
}

async function saveAdminAccount() {
  const b = {
    username: $('#setUsername').value.trim(),
    email: $('#setEmail').value.trim() || undefined,
    new_password: $('#setPassword').value || undefined
  };
  if (!b.username) return toast('Kullanıcı adı zorunlu', false);
  if (b.new_password && b.new_password.length < 8) return toast('Şifre en az 8 karakter', false);
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(EDGE_ACCOUNT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token
    },
    body: JSON.stringify(b)
  });
  const j = await r.json();
  if (!r.ok) return toast(j.error || 'Güncelleme başarısız', false);
  toast('Hesap güncellendi');
  setTimeout(() => location.reload(), 800);
}

/* ── Boot ──────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
