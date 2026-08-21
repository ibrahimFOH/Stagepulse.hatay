/* Stagepulse Personel Portalı — safe staff-only secondary modules */
(() => {
  const text = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (v) => { try { return new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)); } catch (_) { return '—'; } };
  const has = (p) => typeof window.can === 'function' ? window.can(p) : false;
  const panel = (title, body) => `<div class="page-head"><div><h1>${text(title)}</h1></div></div><div class="panel">${body}</div>`;

  window.analyticsView = async function () {
    const tasks = [];
    if (has('schedule.view')) tasks.push(sb.from('my_jobs_staff').select('id,status,event_at').order('event_at',{ascending:false}).limit(100));
    if (has('offers.view')) tasks.push(sb.from('offers_staff').select('id,status,event_date').order('event_date',{ascending:false}).limit(100));
    if (has('equipment.view')) tasks.push(sb.from('equipment_staff').select('id,active,quantity').limit(500));
    const results = await Promise.all(tasks);
    const jobs = results.find(r => Array.isArray(r.data) && r.data.some(x => 'event_at' in x))?.data || [];
    const offers = results.find(r => Array.isArray(r.data) && r.data.some(x => 'event_date' in x))?.data || [];
    const equipment = results.find(r => Array.isArray(r.data) && r.data.some(x => 'quantity' in x))?.data || [];
    const activeJobs = jobs.filter(x => !['done','cancelled'].includes(x.status)).length;
    const acceptedOffers = offers.filter(x => x.status === 'accepted').length;
    const pendingOffers = offers.filter(x => ['pending','sent','new'].includes(x.status)).length;
    const equipmentUnits = equipment.reduce((n,x)=>n + (Number(x.quantity)||0),0);
    $('#content').innerHTML = panel('Analitik', `<div class="cards"><div class="card"><span class="card-label">Aktif işler</span><div class="metric">${activeJobs}</div></div><div class="card"><span class="card-label">Kabul edilen teklifler</span><div class="metric">${acceptedOffers}</div></div><div class="card"><span class="card-label">Bekleyen teklifler</span><div class="metric">${pendingOffers}</div></div><div class="card"><span class="card-label">Ekipman adedi</span><div class="metric">${equipmentUnits}</div></div></div><p class="muted">Bu ekran yalnızca personelin erişebildiği canlı verilerden hesaplanır.</p>`);
  };

  window.activityView = async function () {
    if (!has('schedule.view')) { $('#content').innerHTML = panel('Aktivite','<p class="muted">Bu bölüm için yetkiniz yok.</p>'); return; }
    const {data,error} = await sb.from('my_jobs_staff').select('id,title,status,event_at,location').order('event_at',{ascending:false}).limit(20);
    if (error) throw error;
    const rows = (data||[]).map(j=>`<div class="row-item"><div class="row-main"><strong>${text(j.title)}</strong><span class="muted">${text(j.location||'—')} · ${text(fmt(j.event_at))}</span></div><span class="status">${text(j.status||'—')}</span></div>`).join('');
    $('#content').innerHTML = panel('Aktivite', rows || '<p class="muted">Henüz atanmış iş aktivitesi yok.</p>');
  };

  window.notificationsView = async function () {
    const tasks = [];
    if (has('offers.view')) tasks.push(sb.from('offers_staff').select('id,quote_number,name,status,event_date,created_at').order('created_at',{ascending:false}).limit(20));
    if (has('schedule.view')) tasks.push(sb.from('my_jobs_staff').select('id,title,status,event_at,created_at').order('created_at',{ascending:false}).limit(20));
    const results = await Promise.all(tasks);
    const offers = results.find(r => Array.isArray(r.data) && r.data.some(x => 'quote_number' in x))?.data || [];
    const jobs = results.find(r => Array.isArray(r.data) && r.data.some(x => 'title' in x))?.data || [];
    const items = [
      ...offers.map(o=>({date:o.created_at,title:`Teklif: ${o.quote_number||o.name||'Yeni teklif'}`,body:`Durum: ${o.status||'—'}`})),
      ...jobs.map(j=>({date:j.created_at,title:`İş: ${j.title||'Atanmış iş'}`,body:`Durum: ${j.status||'—'}`}))
    ].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
    $('#content').innerHTML = panel('Bildirimler', items.map(x=>`<div class="row-item"><div class="row-main"><strong>${text(x.title)}</strong><span class="muted">${text(x.body)} · ${text(fmt(x.date))}</span></div></div>`).join('') || '<p class="muted">Yeni bildirim yok.</p>');
  };

  window.settingsView = async function () {
    const {data,error} = await sb.from('staff_profiles').select('display_name,role,active,phone,email,updated_at').limit(1).maybeSingle();
    if (error) throw error;
    const p = data || {};
    $('#content').innerHTML = panel('Ayarlar', `<div class="cards"><div class="card"><span class="card-label">Ad Soyad</span><div class="metric" style="font-size:16px">${text(p.display_name||'—')}</div></div><div class="card"><span class="card-label">Rol</span><div class="metric" style="font-size:16px">${text(p.role||'—')}</div></div><div class="card"><span class="card-label">Durum</span><div class="metric" style="font-size:16px">${p.active?'Aktif':'Pasif'}</div></div></div><div class="row-item"><div class="row-main"><strong>İletişim</strong><span class="muted">${text(p.email||p.phone||'Kayıtlı iletişim bilgisi yok')}</span></div></div><p class="muted">Personel güvenliği nedeniyle yöneticiye ait işletme ayarları bu ekranda gösterilmez.</p>`);
  };
})();
