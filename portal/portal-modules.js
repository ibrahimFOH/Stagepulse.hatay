/* Stagepulse Portal — live modules for notifications, analytics, activity and settings. */
(() => {
  const escM = (s) => String(s ?? '').replace(/[&<>\'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDate = (v) => v ? String(v).slice(0,16).replace('T',' ') : '—';

  window.notificationsView = async function notificationsView() {
    if (!can('notifications.view')) return toast('Bildirimleri görüntüleme yetkiniz yok', false);
    const { data, error } = await sb.from('notifications').select('id,kind,title,body,read_at,created_at,offer_id').order('created_at',{ascending:false}).limit(100);
    if (error) throw error;
    const rows = data || [];
    $('#content').innerHTML = `<div class="page-head"><div><h1>Bildirimler</h1><p class="muted">Size gönderilen sistem bildirimleri</p></div><button class="btn" ${rows.some(x=>!x.read_at)?'':'disabled'} onclick="window.__spMarkAllNotificationsRead()">Tümünü okundu yap</button></div><div class="panel">${rows.map(n=>`<div class="row-item" style="${n.read_at?'opacity:.6':''}"><div class="row-main"><strong>${escM(n.title)}</strong><span class="muted">${escM(n.body||'')} · ${escM(fmtDate(n.created_at))}</span></div><div class="row-side">${!n.read_at?`<button class="btn" onclick="window.__spMarkNotificationRead(${n.id})">Okundu</button>`:''}<span class="status">${escM(n.kind||'sistem')}</span></div></div>`).join('') || '<p class="muted">Bildirim yok.</p>'}</div>`;
  };

  window.__spMarkNotificationRead = async function(id) {
    if (!can('notifications.view')) return;
    const { error } = await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_user_id',window.staffUser?.id);
    if (error) return toast(error.message,false);
    await notificationsView();
  };
  window.__spMarkAllNotificationsRead = async function() {
    if (!can('notifications.view')) return;
    const { error } = await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_user_id',window.staffUser?.id).is('read_at',null);
    if (error) return toast(error.message,false);
    toast('Bildirimler okundu.'); await notificationsView();
  };

  window.activityView = async function activityView() {
    if (!can('activity.view')) return toast('Aktivite görüntüleme yetkiniz yok',false);
    const { data, error } = await sb.from('activity_logs').select('id,action,entity_type,metadata,created_at').order('created_at',{ascending:false}).limit(100);
    if (error) throw error;
    $('#content').innerHTML = `<div class="page-head"><div><h1>Aktivite</h1><p class="muted">Sistem işlem geçmişi</p></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Tarih</th><th>İşlem</th><th>Tür</th><th>Detay</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${escM(fmtDate(x.created_at))}</td><td>${escM(x.action)}</td><td>${escM(x.entity_type||'—')}</td><td><code>${escM(JSON.stringify(x.metadata||{}).slice(0,180))}</code></td></tr>`).join('')||'<tr><td colspan="4" class="muted">Kayıt yok.</td></tr>'}</tbody></table></div></div>`;
  };

  window.analyticsView = async function analyticsView() {
    if (!can('analytics.view')) return toast('Analitik yetkiniz yok',false);
    const tasks=[];
    if (can('offers.view')) tasks.push(sb.from('offers_staff').select('id,status,created_at,total').limit(1000));
    if (can('schedule.view')) tasks.push(sb.from('my_jobs_staff').select('id,status,event_at').limit(1000));
    const [offersRes,jobsRes] = await Promise.all(tasks);
    const offers = offersRes?.data || [];
    const jobs = jobsRes?.data || [];
    const accepted=offers.filter(x=>x.status==='accepted').length;
    const activeJobs=jobs.filter(x=>!['done','cancelled'].includes(x.status)).length;
    const rate=offers.length?Math.round(accepted/offers.length*100):0;
    $('#content').innerHTML = `<div class="page-head"><div><h1>Analitik</h1><p class="muted">Personel hesabınızın erişebildiği operasyon özeti</p></div></div><div class="cards"><div class="card"><span class="card-label">Teklif</span><div class="metric">${offers.length}</div></div><div class="card"><span class="card-label">Kabul</span><div class="metric">${accepted}</div></div><div class="card"><span class="card-label">Dönüşüm</span><div class="metric">${rate}%</div></div><div class="card"><span class="card-label">Aktif iş</span><div class="metric">${activeJobs}</div></div></div>`;
  };

  window.settingsView = async function settingsView() {
    if (!can('settings.view')) return toast('Ayarları görüntüleme yetkiniz yok',false);
    const { data: profile, error: pe } = await sb.from('staff_profiles').select('username,display_name,phone,role').eq('user_id',window.staffUser?.id).maybeSingle();
    if (pe) throw pe;
    const { data: pref } = await sb.from('staff_notification_preferences').select('enabled,offers,jobs,schedule,system').eq('user_id',window.staffUser?.id).maybeSingle();
    const p=pref||{enabled:true,offers:true,jobs:true,schedule:true,system:true};
    $('#content').innerHTML = `<div class="page-head"><div><h1>Ayarlar</h1><p class="muted">Profil ve bildirim tercihleri</p></div></div><div class="grid2"><div class="panel"><h3>Profil</h3><label>Görünen ad<input id="spProfileName" value="${escM(profile?.display_name||'')}"></label><label>Telefon<input id="spProfilePhone" value="${escM(profile?.phone||'')}"></label><label>Kullanıcı adı<input value="${escM(profile?.username||'')}" disabled></label><label>Rol<input value="${escM(roleTr[profile?.role]||profile?.role||'')}" disabled></label><button class="btn btn-primary" onclick="window.__spSaveProfile()">Profili kaydet</button></div><div class="panel"><h3>Bildirim tercihleri</h3><label><input id="spPrefMaster" type="checkbox" ${p.enabled?'checked':''}> Bildirimleri açık tut</label><label><input id="spPrefOffers" type="checkbox" ${p.offers?'checked':''}> Teklif bildirimleri</label><label><input id="spPrefJobs" type="checkbox" ${p.jobs?'checked':''}> İş bildirimleri</label><label><input id="spPrefSchedule" type="checkbox" ${p.schedule?'checked':''}> Takvim bildirimleri</label><label><input id="spPrefSystem" type="checkbox" ${p.system?'checked':''}> Sistem bildirimleri</label><button class="btn btn-primary" onclick="window.__spSaveNotificationPrefs()">Tercihleri kaydet</button></div></div>`;
  };

  window.__spSaveProfile = async function() {
    if (!can('profile.update')) return toast('Profil düzenleme yetkiniz yok',false);
    const { error } = await sb.rpc('staff_update_profile',{p_display_name:$('#spProfileName')?.value?.trim()||null,p_phone:$('#spProfilePhone')?.value?.trim()||null});
    if (error) return toast(error.message,false);
    window.staffUser.display_name=$('#spProfileName').value.trim(); $('#staffName').textContent=window.staffUser.display_name||'Personel'; toast('Profil kaydedildi.');
  };
  window.__spSaveNotificationPrefs = async function() {
    if (!can('settings.view')) return toast('Ayar yetkiniz yok',false);
    const { error } = await sb.rpc('staff_update_notification_preferences',{p_master:$('#spPrefMaster').checked,p_offers:$('#spPrefOffers').checked,p_jobs:$('#spPrefJobs').checked,p_schedule:$('#spPrefSchedule').checked,p_system:$('#spPrefSystem').checked});
    if (error) return toast(error.message,false);
    toast('Bildirim tercihleri kaydedildi.');
  };
})();
