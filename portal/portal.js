/* Stagepulse Personel Portalı — mali alanlar yok + yetki bazlı menü */
const SUPABASE_URL = 'https://mtjcqqrogjqaxkagwkti.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6';
const EDGE_LOGIN = `${SUPABASE_URL}/functions/v1/staff-login`;

if (!window.supabase) {
  document.body.innerHTML = '<div style="padding:40px;font-family:system-ui;color:#fff;background:#090909">Supabase yüklenemedi.</div>';
  throw new Error('Supabase missing');
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Güvenlik ağı: yakalanmamış bir promise reddi olursa kullanıcıyı sessizce
// bırakmak yerine bilgilendir (bkz. admin/admin.js'deki aynı yaklaşım).
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  try {
    toast((event.reason && event.reason.message) || 'Beklenmeyen bir hata oluştu.', false);
  } catch (_) {
    /* toast() henüz tanımlı değilse sessizce yut */
  }
  event.preventDefault();
});

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = (v) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v) => Number(v) || 0;

// Temel yetkiler varsayılan açık; mali/hassas yetkiler admin açıkça
// vermeden asla açılmaz. staff-portal.sql ve admin/admin.js'deki
// staffPermFields ile birebir aynı anahtar seti kullanılmalı.
const DEFAULT_PERMS = {
  jobs: true, equipment: true, offers: true, view_assigned_jobs: true,
  accept_job: true, reject_job: true, update_job_status: true,
  update_job_notes: true, manage_job_equipment: true,
  view_job_contacts: false, view_job_documents: true,
  equipment_checkout: false, equipment_return: false,
  report_issue: true, view_team: true,
  customers: false, finance: false, pricing: false, financials: false
};

let staffUser = null;
let jobs = [];
let equipment = [];
let offers = [];
let jobEquipment = [];

const jobStatusTr = {
  planned: 'Planlandı',
  confirmed: 'Onaylı',
  in_progress: 'Devam',
  done: 'Bitti',
  cancelled: 'İptal'
};
const roleTr = { crew: 'Ekip', tech: 'Teknik', warehouse: 'Depo', lead: 'Sorumlu' };

function perms() {
  return { ...DEFAULT_PERMS, ...(staffUser?.permissions || {}) };
}
function can(key) {
  return !!perms()[key];
}

function showLogin() {
  $('#loginView')?.classList.remove('is-hidden');
  if ($('#loginView')) $('#loginView').hidden = false;
  $('#appView')?.classList.add('is-hidden');
  if ($('#appView')) $('#appView').hidden = true;
}
function showApp() {
  $('#loginView')?.classList.add('is-hidden');
  if ($('#loginView')) $('#loginView').hidden = true;
  $('#appView')?.classList.remove('is-hidden');
  if ($('#appView')) $('#appView').hidden = false;
}

function toast(msg, ok = true) {
  let t = $('#portalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'portalToast';
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 16px;border-radius:10px;z-index:99;font-size:14px';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = ok ? '#1a3a28' : '#3a1a1a';
  t.style.color = ok ? '#9dffc5' : '#ffb4b4';
  t.style.border = '1px solid ' + (ok ? '#2a5a40' : '#5a2020');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => { t.textContent = ''; }, 2800);
}

async function login(e) {
  e.preventDefault();
  const username = $('#loginUser')?.value?.trim();
  const password = $('#loginPass')?.value || '';
  const err = $('#loginErr');
  if (err) { err.hidden = true; err.textContent = ''; }
  try {
    const r = await fetch(EDGE_LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ username, password })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Giriş başarısız');
    await sb.auth.setSession({
      access_token: j.session.access_token,
      refresh_token: j.session.refresh_token
    });
    staffUser = j.user;
    localStorage.setItem('sp_staff_meta', JSON.stringify(j.user));
    afterLogin();
  } catch (ex) {
    if (err) { err.hidden = false; err.textContent = ex.message || 'Hata'; }
  }
}

// Nav butonu data-view değeri → gerekli yetki. 'home' herkese açık.
const VIEW_PERM = {
  jobs: 'jobs', equipment: 'equipment', offers: 'offers',
  customers: 'customers', finance: 'finance', pricing: 'pricing'
};

function applyNavPermissions() {
  $$('#sideNav button[data-view]').forEach((btn) => {
    const v = btn.dataset.view;
    if (v === 'home') {
      btn.style.display = '';
      return;
    }
    const need = VIEW_PERM[v];
    btn.style.display = need && can(need) ? '' : 'none';
  });
}

function afterLogin() {
  showApp();
  $('#staffName').textContent = staffUser?.display_name || 'Personel';
  $('#staffRole').textContent = roleTr[staffUser?.role] || staffUser?.role || '';
  applyNavPermissions();
  bindShell();
  const hash = (location.hash || '#home').slice(1);
  const allowed = ['home', ...Object.keys(VIEW_PERM).filter(can)];
  loadView(allowed.includes(hash) ? hash : 'home');
}

function bindShell() {
  $$('#sideNav button[data-view]').forEach((btn) => {
    btn.onclick = () => loadView(btn.dataset.view);
  });
  $('#logoutBtn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    localStorage.removeItem('sp_staff_meta');
    location.reload();
  });
  const open = () => {
    $('#sidebar')?.classList.add('open');
    const ov = $('#mobileOverlay');
    if (ov) { ov.hidden = false; ov.classList.add('open'); }
  };
  const close = () => {
    $('#sidebar')?.classList.remove('open');
    const ov = $('#mobileOverlay');
    if (ov) { ov.hidden = true; ov.classList.remove('open'); }
  };
  $('#menuBtn')?.addEventListener('click', open);
  $('#mobileOverlay')?.addEventListener('click', close);
}

async function loadView(v) {
  const need = VIEW_PERM[v];
  if (need && !can(need)) return loadView('home');

  history.replaceState(null, '', '#' + v);
  $$('#sideNav button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $('#sidebar')?.classList.remove('open');
  const ov = $('#mobileOverlay');
  if (ov) { ov.hidden = true; ov.classList.remove('open'); }
  const map = {
    home: homeView, jobs: jobsView, equipment: equipmentView, offers: offersView,
    customers: customersView, finance: financeView, pricing: pricingView
  };
  try {
    await map[v]();
  } catch (e) {
    console.error(e);
    $('#content').innerHTML = `<div class="panel"><b>Hata</b><p class="muted">${esc(e.message || e)}</p>
      <p class="muted">Yetki veya tablo eksik olabilir. Admin’e staff-portal.sql çalıştırıldığını sorun.</p></div>`;
  }
}

async function fetchJobs() {
  if (!can('jobs')) { jobs = []; return; }
  const source = can('view_assigned_jobs') ? 'my_jobs_staff' : (can('jobs') ? 'jobs' : null);
  const { data, error } = await sb.from(source).select('*').order('event_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  jobs = data || [];
}
async function fetchEquipment() {
  if (!can('equipment') && !can('jobs')) { equipment = []; return; }
  // Güvenli view: maliyet / satış fiyatı bu view'da hiç yok.
  const { data, error } = await sb.from('equipment_staff')
    .select('id,category,brand,model,quantity,active,notes')
    .order('category');
  if (error) throw error;
  equipment = data || [];
}
async function fetchOffers() {
  if (!can('offers')) { offers = []; return; }
  // Güvenli view: maliyet/kâr yok, sadece anlaşılan tutar (agreed_amount).
  const { data, error } = await sb.from('offers_staff')
    .select('id,quote_number,name,company,location,people,event_date,event_type,type,agreed_amount,currency,status,created_at')
    .order('event_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  offers = data || [];
}
async function fetchJobEquipment() {
  if (!can('jobs') && !can('equipment')) { jobEquipment = []; return; }
  const { data, error } = await sb.from('job_equipment').select('*');
  if (error) {
    jobEquipment = [];
    return;
  }
  jobEquipment = data || [];
}

/* — Mali / hassas veriler: sadece ilgili yetki açıksa satır döner — */
let customers = [];
let payments = [];
let pricing = [];
let offersFinancial = [];
let equipmentFinancial = [];

async function fetchCustomers() {
  if (!can('customers')) { customers = []; return; }
  const { data, error } = await sb.from('customers_staff').select('*').order('name');
  if (error) throw error;
  customers = data || [];
}
async function fetchPayments() {
  if (!can('finance')) { payments = []; return; }
  const { data, error } = await sb.from('payments_staff').select('*').order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  payments = data || [];
}
async function fetchPricing() {
  if (!can('pricing')) { pricing = []; return; }
  const { data, error } = await sb.from('pricing_staff').select('*').order('sort_order');
  if (error) throw error;
  pricing = data || [];
}
async function fetchOffersFinancial() {
  if (!can('financials')) { offersFinancial = []; return; }
  const { data, error } = await sb.from('offers_financial_staff').select('*');
  if (error) { offersFinancial = []; return; }
  offersFinancial = data || [];
}
async function fetchEquipmentFinancial() {
  if (!can('financials')) { equipmentFinancial = []; return; }
  const { data, error } = await sb.from('equipment_financial_staff').select('*');
  if (error) { equipmentFinancial = []; return; }
  equipmentFinancial = data || [];
}

/** Tarih aralığında rezerve adet (iptal hariç işler) */
function reservedQty(equipmentId, fromIso, toIso) {
  const activeJobs = jobs.filter((j) => j.status !== 'cancelled' && j.status !== 'done');
  let sum = 0;
  for (const j of activeJobs) {
    const start = j.setup_at || j.event_at;
    const end = j.teardown_at || j.event_at;
    if (fromIso && end && end < fromIso) continue;
    if (toIso && start && start > toIso) continue;
    const rows = jobEquipment.filter((x) => x.job_id === j.id && x.equipment_id === equipmentId);
    rows.forEach((r) => { sum += num(r.quantity); });
  }
  return sum;
}

async function homeView() {
  const tasks = [];
  if (can('jobs')) tasks.push(fetchJobs());
  if (can('equipment')) tasks.push(fetchEquipment());
  if (can('offers')) tasks.push(fetchOffers());
  await Promise.all(tasks);

  const upcoming = can('jobs') ? jobs.filter((j) => j.status !== 'cancelled' && j.status !== 'done').slice(0, 5) : [];
  const accepted = can('offers') ? offers.filter((o) => o.status === 'accepted') : [];

  const cards = [];
  if (can('jobs')) cards.push(`<div class="card"><span class="card-label">Aktif iş</span><div class="metric">${jobs.filter(j=>!['cancelled','done'].includes(j.status)).length}</div></div>`);
  if (can('offers')) cards.push(`<div class="card"><span class="card-label">Kabul teklif</span><div class="metric">${accepted.length}</div></div>`);
  if (can('equipment')) cards.push(`<div class="card"><span class="card-label">Ekipman kalemi</span><div class="metric">${equipment.length}</div></div>`);

  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Özet</h1><p class="muted">Merhaba ${esc(staffUser?.display_name || '')}</p></div>
    </div>
    <div class="cards">
      ${cards.join('') || '<div class="card"><span class="card-label">Yetki</span><div class="metric" style="font-size:14px">Menü yetkisi tanımlı değil</div></div>'}
    </div>
    ${can('jobs') ? `<div class="panel">
      <h3 style="margin:0 0 8px">Yaklaşan işler</h3>
      ${upcoming.map((j) => `
        <div class="row-item">
          <div class="row-main">
            <strong>${esc(j.title)}</strong>
            <span class="muted">${esc(j.location || '—')} · ${esc((j.event_at || '').slice(0, 16).replace('T', ' '))}</span>
          </div>
          <span class="status">${esc(jobStatusTr[j.status] || j.status)}</span>
        </div>`).join('') || '<p class="muted">Yaklaşan iş yok</p>'}
    </div>` : ''}`;
}

async function jobsView() {
  await Promise.all([fetchJobs(), fetchJobEquipment(), fetchEquipment()]);
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>İşler</h1><p class="muted">Kurulum · etkinlik · söküm · malzeme adetleri</p></div>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>İş</th><th>Lokasyon</th><th>Kurulum</th><th>Etkinlik</th><th>Söküm</th><th>Durum</th><th></th>
      </tr></thead>
      <tbody>
        ${jobs.map((j) => `
          <tr>
            <td><strong>${esc(j.title)}</strong></td>
            <td>${esc(j.location || '—')}</td>
            <td>${esc((j.setup_at || '').slice(0, 16).replace('T', ' '))}</td>
            <td>${esc((j.event_at || '').slice(0, 16).replace('T', ' '))}</td>
            <td>${esc((j.teardown_at || '').slice(0, 16).replace('T', ' '))}</td>
            <td><span class="status">${esc(jobStatusTr[j.status] || j.status)}</span></td>
            <td><button class="btn" onclick="openJob('${j.id}')">Detay</button></td>
          </tr>`).join('') || '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">İş yok</td></tr>'}
      </tbody>
    </table></div></div>`;
}

window.openJob = async function openJob(id) {
  if (!can('jobs') && !can('view_assigned_jobs')) return;
  const j = jobs.find((x) => x.id === id);
  if (!j) return;
  await fetchJobEquipment();
  const mats = jobEquipment.filter((x) => x.job_id === id).map((row) => {
    const eq = equipment.find((e) => e.id === row.equipment_id);
    return { ...row, label: eq ? [eq.category, eq.brand, eq.model].filter(Boolean).join(' · ') : row.equipment_id };
  });
  const canAdvance = can('update_job_status') && !['done', 'cancelled'].includes(j.status);
  const canAccept = can('accept_job') && j.response_status === 'pending';
  const canReject = can('reject_job') && j.response_status === 'pending';
  $('#content').innerHTML = `
    <div class="page-head">
      <div>
        <button class="btn" onclick="loadView('jobs')">← İşler</button>
        <h1 style="margin-top:12px">${esc(j.title)}</h1>
        <p class="muted">${esc(j.location || '—')}</p>
      </div>
      <div class="actions">
        ${canAccept ? `<button class="btn btn-primary" onclick="respondJob('${j.id}','accepted')">İşi Kabul Et</button>` : ''}
        ${canReject ? `<button class="btn btn-danger" onclick="respondJob('${j.id}','rejected')">İşi Reddet</button>` : ''}
        ${canAdvance ? `
          ${j.status === 'planned' || j.status === 'confirmed' ? `<button class="btn" onclick="setJobStatus('${j.id}','in_progress')">Devama al</button>` : ''}
          ${j.status === 'in_progress' ? `<button class="btn btn-primary" onclick="setJobStatus('${j.id}','done')">Bitir</button>` : ''}` : ''}
        ${can('update_job_notes') ? `<button class="btn" onclick="updateJobNotes('${j.id}')">Notu düzenle</button>` : ''}
      </div>
    </div>
    <div class="cards">
      <div class="card"><span class="card-label">Kurulum</span><div class="metric" style="font-size:15px">${esc((j.setup_at || '—').slice(0, 16).replace('T', ' '))}</div></div>
      <div class="card"><span class="card-label">Etkinlik</span><div class="metric" style="font-size:15px">${esc((j.event_at || '—').slice(0, 16).replace('T', ' '))}</div></div>
      <div class="card"><span class="card-label">Söküm</span><div class="metric" style="font-size:15px">${esc((j.teardown_at || '—').slice(0, 16).replace('T', ' '))}</div></div>
      <div class="card"><span class="card-label">Durum</span><div class="metric" style="font-size:15px">${esc(jobStatusTr[j.status] || j.status)}</div></div>
    </div>
    <div class="panel">
      <h3 style="margin:0 0 8px">Malzeme listesi (adet)</h3>
      ${mats.length ? `<table class="data-table"><thead><tr><th>Ekipman</th><th>Adet</th><th>Not</th></tr></thead>
        <tbody>${mats.map((m) => `<tr><td>${esc(m.label)}</td><td><b>${m.quantity}</b></td><td class="muted">${esc(m.notes || '')}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Bu işe henüz malzeme bağlanmamış. Admin panelden işe ekipman ekleyebilir.</p>'}
      ${j.notes ? `<p class="muted" style="margin-top:12px">${esc(j.notes)}</p>` : ''}
    </div>`;
};

window.respondJob = async function respondJob(id, response) {
  if (response === 'accepted' && !can('accept_job')) return toast('İş kabul yetkiniz yok', false);
  if (response === 'rejected' && !can('reject_job')) return toast('İş red yetkiniz yok', false);
  const note = prompt(response === 'rejected' ? 'Red nedeni (opsiyonel):' : 'Not (opsiyonel):') || null;
  const { data, error } = await sb.rpc('staff_respond_job', { p_job_id: id, p_response: response, p_note: note });
  if (error) return toast(error.message, false);
  toast(response === 'accepted' ? 'İş kabul edildi' : 'İş reddedildi');
  await fetchJobs();
  openJob(id);
};

window.setJobStatus = async function setJobStatus(id, status) {
  if (!can('update_job_status')) return toast('Bu işlem için yetkiniz yok', false);
  const { error } = await sb.rpc('staff_update_job_status', { p_job_id: id, p_status: status });
  if (error) return toast(error.message, false);
  toast('Durum güncellendi');
  await fetchJobs();
  openJob(id);
};

window.updateJobNotes = async function updateJobNotes(id) {
  if (!can('update_job_notes')) return toast('İş notu güncelleme yetkiniz yok', false);
  const j = jobs.find((x) => x.id === id);
  if (!j) return;
  const note = prompt('İş notu:', j.notes || '');
  if (note === null) return;
  const { error } = await sb.rpc('staff_update_job_notes', { p_job_id: id, p_notes: note });
  if (error) return toast(error.message, false);
  toast('İş notu güncellendi');
  await fetchJobs();
  openJob(id);
};

async function equipmentView() {
  const tasks = [fetchEquipment(), fetchJobs(), fetchJobEquipment()];
  if (can('financials')) tasks.push(fetchEquipmentFinancial());
  await Promise.all(tasks);
  const finById = Object.fromEntries(equipmentFinancial.map(f => [f.id, f]));
  const showFin = can('financials');
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Ekipman</h1><p class="muted">Envanter adetleri · dolu / müsait${showFin ? '' : ' (maliyet görünmez)'}</p></div>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>Kategori</th><th>Marka</th><th>Model</th><th>Stok</th><th>Rezerve</th><th>Müsait</th><th>Durum</th>${showFin ? '<th>Maliyet/gün</th><th>Satış/gün</th>' : ''}
      </tr></thead>
      <tbody>
        ${equipment.map((e) => {
          const reserved = reservedQty(e.id);
          const free = Math.max(0, num(e.quantity) - reserved);
          const busy = reserved > 0;
          const fin = finById[e.id];
          return `<tr>
            <td>${esc(e.category)}</td>
            <td>${esc(e.brand || '—')}</td>
            <td>${esc(e.model || '—')}</td>
            <td>${num(e.quantity)}</td>
            <td>${reserved}</td>
            <td><b class="${free ? 'ok' : ''}">${free}</b></td>
            <td><span class="status ${busy ? 'busy' : 'free'}">${busy ? 'Kısmen dolu' : 'Müsait'}</span></td>
            ${showFin ? `<td>${fin ? money(fin.daily_cost) : '—'}</td><td>${fin ? money(fin.daily_price) : '—'}</td>` : ''}
          </tr>`;
        }).join('') || `<tr><td colspan="${showFin ? 9 : 7}" class="muted" style="text-align:center;padding:24px">Ekipman yok</td></tr>`}
      </tbody>
    </table></div>
    <p class="muted" style="margin-top:10px;font-size:13px">Rezerve = aktif işlere bağlı adet toplamı.${showFin ? '' : ' Maliyet ve satış fiyatı personelde gösterilmez.'}</p>
    </div>`;
}

async function offersView() {
  const tasks = [fetchOffers()];
  if (can('financials')) tasks.push(fetchOffersFinancial());
  await Promise.all(tasks);
  const finById = Object.fromEntries(offersFinancial.map(f => [f.id, f]));
  const showFin = can('financials');
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Teklifler</h1><p class="muted">${showFin ? 'Anlaşılan tutar + maliyet/kâr' : 'Sadece anlaşılan tutar · maliyet / kâr yok'}</p></div>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>No</th><th>Müşteri</th><th>Lokasyon</th><th>Tarih</th><th>Anlaşılan</th><th>Durum</th>${showFin ? '<th>Maliyet</th><th>Kâr</th>' : ''}
      </tr></thead>
      <tbody>
        ${offers.map((o) => {
          const fin = finById[o.id];
          return `
          <tr>
            <td>${esc(o.quote_number || '—')}</td>
            <td><strong>${esc(o.name)}</strong><div class="muted">${esc(o.company || '')}</div></td>
            <td>${esc(o.location || '—')}</td>
            <td>${esc(o.event_date || '—')}</td>
            <td><b>${money(o.agreed_amount)}</b></td>
            <td><span class="status">${esc(o.status)}</span></td>
            ${showFin ? `<td>${fin ? money(fin.estimated_cost) : '—'}</td><td>${fin ? money(fin.margin) : '—'}</td>` : ''}
          </tr>`;
        }).join('') || `<tr><td colspan="${showFin ? 8 : 6}" class="muted" style="text-align:center;padding:24px">Kayıt yok</td></tr>`}
      </tbody>
    </table></div></div>`;
}

async function customersView() {
  await fetchCustomers();
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Müşteriler</h1><p class="muted">İletişim bilgileri</p></div>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Ad</th><th>Firma</th><th>Telefon</th><th>E-posta</th><th>Son iletişim</th></tr></thead>
      <tbody>
        ${customers.map((c) => `
          <tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td>${esc(c.company || '—')}</td>
            <td>${esc(c.phone || '—')}</td>
            <td>${esc(c.email || '—')}</td>
            <td>${esc((c.last_contact_at || '').slice(0, 10) || '—')}</td>
          </tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">Kayıt yok</td></tr>'}
      </tbody>
    </table></div></div>`;
}

async function financeView() {
  await fetchPayments();
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Tahsilat / Ödemeler</h1><p class="muted">Ödeme kayıtları</p></div>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Teklif</th><th>Müşteri</th><th>Açıklama</th><th>Tutar</th><th>Vade</th><th>Ödendi</th><th>Durum</th></tr></thead>
      <tbody>
        ${payments.map((p) => `
          <tr>
            <td>${esc(p.quote_number || '—')}</td>
            <td>${esc(p.customer_name || '—')}</td>
            <td>${esc(p.description || '—')}</td>
            <td><b>${money(p.amount)}</b></td>
            <td>${esc(p.due_date || '—')}</td>
            <td>${esc((p.paid_at || '').slice(0, 10) || '—')}</td>
            <td><span class="status">${esc(p.status)}</span></td>
          </tr>`).join('') || '<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">Kayıt yok</td></tr>'}
      </tbody>
    </table></div></div>`;
}

async function pricingView() {
  await fetchPricing();
  $('#content').innerHTML = `
    <div class="page-head">
      <div><h1>Fiyat listesi</h1><p class="muted">Hizmet ve fiyatlandırma kuralları</p></div>
    </div>
    <div class="panel"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Ad</th><th>Açıklama</th><th>Fiyat / değer</th></tr></thead>
      <tbody>
        ${pricing.map((r) => `
          <tr>
            <td><strong>${esc(r.name)}</strong></td>
            <td class="muted">${esc(r.description || '—')}</td>
            <td>${money(r.base_price)}</td>
          </tr>`).join('') || '<tr><td colspan="3" class="muted" style="text-align:center;padding:24px">Kayıt yok</td></tr>'}
      </tbody>
    </table></div></div>`;
}

window.loadView = loadView;

async function init() {
  $('#loginForm')?.addEventListener('submit', login);
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    try {
      staffUser = JSON.parse(localStorage.getItem('sp_staff_meta') || 'null');
    } catch (_) { staffUser = null; }
    const { data: prof } = await sb.from('staff_profiles')
      .select('user_id,username,display_name,role,active,permissions')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (prof?.active) {
      staffUser = {
        id: prof.user_id,
        username: prof.username,
        display_name: prof.display_name,
        role: prof.role,
        permissions: { ...DEFAULT_PERMS, ...(prof.permissions || {}) }
      };
      localStorage.setItem('sp_staff_meta', JSON.stringify(staffUser));
      afterLogin();
      return;
    }
    await sb.auth.signOut();
  }
  showLogin();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else init();
