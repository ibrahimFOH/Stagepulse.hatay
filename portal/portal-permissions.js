/* Stagepulse Portal — canonical permission gateway */
(() => {
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const STAFF_EDGE = `${SUPABASE_URL}/functions/v1/staff-session`;
  const ALIAS = {
    jobs:'schedule.view', equipment:'equipment.view', offers:'offers.view', customers:'customers.view', finance:'payments.view', pricing:'pricing.view',
    view_assigned_jobs:'schedule.view', accept_job:'jobs.accept', reject_job:'jobs.reject', update_job_status:'jobs.status.update',
    update_job_notes:'jobs.notes.update', manage_job_equipment:'jobs.equipment.manage', view_job_contacts:'schedule.view', view_job_documents:'jobs.documents.view',
    equipment_checkout:'equipment.checkout', equipment_return:'equipment.return', report_issue:'issues.create', view_team:'team.view',
    financials:'financials.view', dashboard_view:'dashboard.view', analytics:'analytics.view', activity_view:'activity.view',
    notifications_view:'notifications.view', settings_manage:'settings.update', calendar_view:'schedule.view', calendar_edit:'schedule.manage',
    settlements_view:'settlements.view', personnel_view:'staff.view', pricing_manage:'pricing.manage', file_upload:'files.upload',
    offer_approve:'offers.approve', whatsapp_send:'notifications.send', personnel_manage:'staff.manage'
  };
  const canonical = (key) => ALIAS[key] || key;
  const views = {
    home: 'dashboard.view', jobs: 'schedule.view', equipment: 'equipment.view', offers: 'offers.view',
    customers: 'customers.view', finance: 'payments.view', pricing: 'pricing.view', analytics: 'analytics.view',
    activity: 'activity.view', notifications: 'notifications.view', settings: 'settings.view'
  };
  const navItems = [['home','Özet'],['jobs','İşler'],['equipment','Ekipman'],['offers','Teklifler'],['customers','Müşteriler'],['finance','Ödemeler / Finans'],['pricing','Fiyatlandırma'],['analytics','Analitik'],['activity','Aktivite'],['notifications','Bildirimler'],['settings','Ayarlar']];
  let live = Object.create(null), recoveryShown = false, lastActivity = Date.now(), sessionTimer = null, sessionBusy = false;
  const canLive = (key) => live[canonical(key)] === true || live[key] === true;
  const firstAllowed = () => navItems.map(([v]) => v).find(v => canLive(views[v])) || null;
  const permissionCount = () => Object.values(live).filter(v => v === true).length;
  const markActivity = () => { lastActivity = Date.now(); };

  async function session() {
    if (sessionBusy) return window.staffUser || null;
    sessionBusy = true;
    try {
      const { data: { session: s } } = await sb.auth.getSession();
      if (!s?.user?.id) return null;
      const response = await fetch(STAFF_EDGE, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session' }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Personel oturumu doğrulanamadı.');
      const profile = body.user;
      if (!profile?.active) throw new Error('Personel hesabı aktif değil.');
      live = Object.create(null);
      for (const key of Object.keys(body.permissions || {})) if (body.permissions[key] === true) live[key] = true;
      window.staffUser = profile;
      // Do not persist auth/session material; keep only non-sensitive display metadata.
      localStorage.setItem('sp_staff_meta', JSON.stringify({ id: profile.id, display_name: profile.display_name, role: profile.role }));
      document.documentElement.dataset.portalPermissionCount = String(permissionCount());
      return profile;
    } finally { sessionBusy = false; }
  }

  async function forceLogout(message = 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.') {
    clearTimeout(sessionTimer); sessionTimer = null;
    await sb.auth.signOut().catch(() => {});
    localStorage.removeItem('sp_staff_meta'); window.staffUser = null; showLogin(); toast(message, false);
  }
  function scheduleSessionCheck() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(async () => {
      if (!window.staffUser) return;
      if (Date.now() - lastActivity > SESSION_TIMEOUT_MS) { await forceLogout('Güvenlik nedeniyle oturumunuz kapatıldı.'); return; }
      try { await session(); } catch (_) { await forceLogout(); return; }
      scheduleSessionCheck();
    }, 5 * 60 * 1000);
  }

  function resetModal() {
    if (recoveryShown) return;
    recoveryShown = true;
    document.getElementById('spPortalReset')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="portal-reset" id="spPortalReset" role="dialog" aria-modal="true"><div class="login-card"><div class="brand">STAGEPULSE</div><h1>Yeni şifre</h1><p class="muted">Bu ekran yalnızca geçerli bir recovery oturumu için kullanılabilir.</p><label>Yeni şifre<input id="spPortalPass1" type="password" minlength="10" autocomplete="new-password"></label><label>Yeni şifre tekrar<input id="spPortalPass2" type="password" minlength="10" autocomplete="new-password"></label><button class="btn btn-primary" id="spPortalSave" type="button">Şifreyi güncelle</button><p id="spPortalResetErr" class="err" role="alert"></p></div></div>`);
    $('#spPortalSave').onclick = async () => {
      const a = $('#spPortalPass1').value, b = $('#spPortalPass2').value, e = $('#spPortalResetErr');
      if (a.length < 10 || !/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(a) || !/\d/.test(a)) { e.textContent = 'Şifre en az 10 karakter, bir harf ve bir rakam içermeli.'; return; }
      if (a !== b) { e.textContent = 'Şifreler eşleşmiyor.'; return; }
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) { e.textContent = error.message; return; }
      await forceLogout('Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.'); $('#spPortalReset')?.remove(); recoveryShown = false;
    };
    $('#spPortalPass1')?.focus();
  }

  sb.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') resetModal(); if (event === 'SIGNED_OUT') { window.staffUser = null; live = Object.create(null); clearTimeout(sessionTimer); } });

  async function login(e) {
    e.preventDefault(); e.stopImmediatePropagation();
    const u = $('#loginUser')?.value?.trim().toLowerCase(), p = $('#loginPass')?.value || '', err = $('#loginErr');
    if (err) { err.hidden = true; err.textContent = ''; }
    if (!u || !p) { if (err) { err.hidden = false; err.textContent = 'Kullanıcı adı ve şifre gerekli.'; } return; }
    const submit = $('#loginForm button[type="submit"]');
    if (submit) { submit.disabled = true; submit.dataset.oldText = submit.textContent; submit.textContent = 'Giriş yapılıyor…'; }
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email: `${u}@staff.stagepulse.com.tr`, password: p });
      if (error || !data.session) throw error || new Error('Giriş başarısız');
      await session(); afterLoginV2();
    } catch (x) {
      if (err) { err.hidden = false; err.textContent = x.message || 'Giriş başarısız'; }
      await sb.auth.signOut().catch(() => {});
    } finally { if (submit) { submit.disabled = false; submit.textContent = submit.dataset.oldText || 'Giriş'; } }
  }

  function nav() {
    const n = $('#sideNav'); if (!n) return;
    n.querySelectorAll('button[data-view]').forEach(b => b.remove());
    navItems.forEach(([v,label]) => { const allowed = canLive(views[v]); const b = document.createElement('button'); b.type = 'button'; b.dataset.view = v; b.textContent = label; b.setAttribute('aria-label', label); b.hidden = !allowed; b.onclick = () => loadLiveView(v); n.appendChild(b); });
    let badge = document.getElementById('portalPermissionBadge'); if (!badge) { badge = document.createElement('small'); badge.id = 'portalPermissionBadge'; n.appendChild(badge); } badge.textContent = `${permissionCount()} aktif yetki`;
  }
  function patch() { window.can = canLive; window.perms = () => ({ ...live }); window.loadView = loadLiveView; nav(); }
  function afterLoginV2() { showApp(); $('#staffName').textContent = window.staffUser?.display_name || 'Personel'; $('#staffRole').textContent = roleTr[window.staffUser?.role] || window.staffUser?.role || ''; patch(); markActivity(); scheduleSessionCheck(); const h = (location.hash || '').slice(1), f = firstAllowed(); loadLiveView(views[h] && canLive(views[h]) ? h : (f || null)); }
  function external(v) { const labels = { analytics:'Analitik', activity:'Aktivite', notifications:'Bildirimler', settings:'Ayarlar' }; $('#content').innerHTML = `<div class="panel portal-placeholder"><h2>${esc(labels[v] || 'Bölüm')}</h2><p class="muted">Bu bölüm için yetkiniz aktif. Modül verisi hazır olduğunda burada görüntülenecek.</p></div>`; }
  async function loadLiveView(v) {
    markActivity(); const need = views[v];
    if (!need || !canLive(need)) { const f = firstAllowed(); if (f && f !== v) return loadLiveView(f); $('#content').innerHTML = '<div class="panel"><b>Erişim yetkiniz yok.</b><p class="muted">Bu sayfa için yöneticinizden yetki istemelisiniz.</p></div>'; return; }
    history.replaceState(null, '', '#' + v); $$('#sideNav button').forEach(b => b.classList.toggle('active', b.dataset.view === v)); $('#sidebar')?.classList.remove('open'); const ov = $('#mobileOverlay'); if (ov) { ov.hidden = true; ov.classList.remove('open'); }
    const map = { home:window.homeView, jobs:window.jobsView, equipment:window.equipmentView, offers:window.offersView, customers:window.customersView, finance:window.financeView, pricing:window.pricingView, analytics:window.analyticsView, activity:window.activityView, notifications:window.notificationsView, settings:window.settingsView };
    const fn = map[v];
    try { if (typeof fn === 'function') return await fn(); return external(v); }
    catch (error) { console.error('Portal view error:', error); $('#content').innerHTML = `<div class="panel portal-error"><b>Bu bölüm yüklenemedi.</b><p class="muted">${esc(error?.message || 'Beklenmeyen bir hata oluştu.')}</p><button class="btn" type="button" onclick="loadView('home')">Özete dön</button>`; }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    ['pointerdown','keydown','touchstart'].forEach(event => window.addEventListener(event, markActivity, { passive:true }));
    const f = $('#loginForm'); f?.addEventListener('submit', login, true);
    try { const u = await session(); if (u) { afterLoginV2(); return; } } catch (e) { console.warn('Portal session restore failed:', e); await sb.auth.signOut().catch(() => {}); }
    showLogin();
  }, { once:true });
})();
