/* Stagepulse Admin — production staff/auth layer */
(() => {
  const STAFF_EDGE = `${SUPABASE_URL}/functions/v1/staff-manage`;
  const PASS_MSG = 'Şifre en az 10 karakter, bir harf ve bir rakam içermeli.';
  let permissionCatalog = [];
  let staffRows = [];
  let permissionDraft = {};

  const esc2 = (s) => String(s ?? '').replace(/[&<>\'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const strong = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 128 && /[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p) && /\d/.test(p);
  const groups = (rows) => rows.reduce((a, r) => { const k = r.category || 'Genel'; (a[k] ||= []).push(r); return a; }, {});

  async function staffApiV2(body) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Yönetici oturumu yok.');
    return apiFetch(STAFF_EDGE, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', apikey:SUPABASE_KEY, Authorization:`Bearer ${session.access_token}` },
      body: JSON.stringify(body)
    });
  }

  async function loadStaffData() {
    const [catalogRes, staffRes] = await Promise.all([staffApiV2({ action:'catalog' }), staffApiV2({ action:'list' })]);
    permissionCatalog = catalogRes.permissions || [];
    staffRows = staffRes.staff || [];
  }

  function toggleButton(key, enabled, label, action = '') {
    return `<button type="button" class="sp-toggle ${enabled ? 'is-on' : ''}" role="switch" aria-checked="${enabled}" data-perm-key="${esc2(key)}" onclick="window.__spToggle('${esc2(key)}', this, '${esc2(action)}')"><span class="sp-toggle-track"><span class="sp-toggle-knob"></span></span><span class="sp-toggle-copy"><b>${esc2(label)}</b><small>${enabled ? 'Açık' : 'Kapalı'}</small></span></button>`;
  }

  async function personnelViewV2() {
    try {
      await loadStaffData();
      $('#content').innerHTML = `<div class="page-head"><div><h1>Personel</h1><p class="muted">${staffRows.length} personel · ${permissionCatalog.length} ayrı yetki · değişiklikler anında kaydedilir</p></div><button class="btn btn-primary" onclick="window.__spStaffModal('')">+ Personel ekle</button></div><div class="panel"><div class="staff-grid">${staffRows.map(p => { const active=p.active===true; const enabled=permissionCatalog.filter(x=>p.permissions?.[x.key]===true).length; return `<article class="staff-card"><div class="staff-card-top"><div><span class="status ${active?'accepted':'cancelled'}">${active?'Aktif':'Pasif'}</span><h3>${esc2(p.display_name||p.username)}</h3><p>@${esc2(p.username)} · ${esc2(staffRoles[p.role]||p.role||'')}</p></div><button class="btn" onclick="window.__spStaffModal('${esc2(p.user_id)}')">Düzenle</button></div><div class="staff-card-meta"><span>${enabled}/${permissionCatalog.length} yetki açık</span><span>${esc2(p.phone||'Telefon yok')}</span></div></article>`; }).join('') || '<div class="empty muted">Henüz personel hesabı yok.</div>'}</div></div>`;
    } catch(e) { $('#content').innerHTML=`<div class="notice"><b>Personel servisi kullanılamıyor</b><p>${esc2(e.message||e)}</p></div>`; }
  }

  function getProfile(userId) { return staffRows.find(x=>x.user_id===userId)||null; }

  async function staffModalV2(userId='') {
    const p=getProfile(userId);
    permissionDraft=Object.fromEntries(permissionCatalog.map(x=>[x.key,p?.permissions?.[x.key]===true]));
    const grouped=groups(permissionCatalog);
    $('#offerModal')?.remove();
    const categoryHtml=Object.entries(grouped).map(([cat,rows])=>`<section class="sp-permission-group"><div class="sp-group-title">${esc2(cat)}</div><div class="sp-permission-list">${rows.map(r=>toggleButton(r.key,permissionDraft[r.key],r.label)).join('')}</div></section>`).join('');
    const activeToggle=p ? toggleButton('__active__',p.active===true,'Personel hesabı','active') : '';
    document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="offerModal" data-user-id="${esc2(userId)}"><div class="modal-card sp-staff-modal"><button class="close" type="button" onclick="$('#offerModal').remove()">×</button><div class="modal-top"><div><span class="muted small">${p?'Mevcut personel':'Yeni hesap'}</span><h2>${p?esc2(p.display_name):'Yeni personel'}</h2></div><span class="status accepted">${permissionCatalog.length} yetki</span></div><div class="grid2"><label>Görünen ad *<input id="spName" value="${esc2(p?.display_name||'')}"></label><label>Kullanıcı adı *<input id="spUsername" value="${esc2(p?.username||'')}" ${p?'readonly':''} placeholder="ahmet"></label><label>Rol<select id="spRole">${Object.entries(staffRoles).map(([k,v])=>`<option value="${k}" ${(p?.role||'crew')===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Telefon<input id="spPhone" value="${esc2(p?.phone||'')}"></label><label>${p?'Yeni şifre (opsiyonel)':'Şifre *'}<input id="spPassword" type="password" minlength="10" autocomplete="new-password" placeholder="En az 10 karakter, harf + rakam"></label>${p?`<label>Personel durumu<div class="sp-active-row">${activeToggle}</div></label>`:''}</div><div class="sp-permissions-head"><div><h3>Personel yetkileri</h3><p class="muted">Her yetki bağımsız Aç/Kapa anahtarıdır. Mevcut hesaplarda değişiklik anında kaydedilir.</p></div></div><div class="sp-permissions-shell">${categoryHtml}</div><div class="modal-actions"><button class="btn btn-primary" onclick="window.__spSaveStaff('${esc2(userId)}')">${p?'Bilgileri kaydet':'Personeli oluştur'}</button>${p?`<button class="btn" onclick="window.__spResetPassword('${esc2(userId)}')">Şifreyi sıfırla</button><button class="btn btn-danger" onclick="window.__spDeleteStaff('${esc2(userId)}')">Sil</button>`:''}<button class="btn" onclick="$('#offerModal').remove()">Kapat</button></div></div></div>`);
  }

  window.__spToggle=async(key,el,action='')=>{
    if(action==='active'){
      const userId=$('#offerModal')?.dataset?.userId||''; if(!userId)return;
      const current=el.getAttribute('aria-checked')==='true'; const next=!current;
      el.disabled=true;
      try{await staffApiV2({action:'set_active',user_id:userId,active:next});el.classList.toggle('is-on',next);el.setAttribute('aria-checked',String(next));const copy=el.querySelector('small');if(copy)copy.textContent=next?'Açık':'Kapalı';toast(next?'Personel aktif edildi.':'Personel pasif edildi.');}
      catch(e){toast(e.message||'Durum kaydedilemedi.',false)} finally{el.disabled=false} return;
    }
    const next=!permissionDraft[key]; permissionDraft[key]=next; el.classList.toggle('is-on',next); el.setAttribute('aria-checked',String(next)); const copy=el.querySelector('small'); if(copy)copy.textContent=next?'Açık':'Kapalı';
    const userId=$('#offerModal')?.dataset?.userId||''; if(!userId)return;
    el.disabled=true;
    try{await staffApiV2({action:'permissions',user_id:userId,permissions:{...permissionDraft}});toast(`${el.querySelector('b')?.textContent||'Yetki'} ${next?'açıldı':'kapatıldı'}.`);}
    catch(e){permissionDraft[key]=!next;el.classList.toggle('is-on',!next);el.setAttribute('aria-checked',String(!next));if(copy)copy.textContent=!next?'Açık':'Kapalı';toast(e.message||'Yetki kaydedilemedi.',false)} finally{el.disabled=false}
  };

  window.__spSaveStaff=async(userId)=>{
    const display_name=$('#spName')?.value?.trim();const username=$('#spUsername')?.value?.trim().toLowerCase();const role=$('#spRole')?.value||'crew';const phone=$('#spPhone')?.value?.trim()||null;const pw=$('#spPassword')?.value||'';
    if(!display_name||!username)return toast('Ad ve kullanıcı adı zorunlu.',false);if(!userId&&!strong(pw))return toast(PASS_MSG,false);if(pw&&!strong(pw))return toast(PASS_MSG,false);
    try{if(!userId)await staffApiV2({action:'create',username,display_name,password:pw,role,phone,permissions:{...permissionDraft}});else await staffApiV2({action:'update',user_id:userId,display_name,role,phone,password:pw||undefined});toast(userId?'Personel bilgileri kaydedildi.':'Personel oluşturuldu.');$('#offerModal')?.remove();await personnelViewV2();}catch(e){toast(e.message||'Kaydedilemedi.',false)}
  };
  window.__spResetPassword=async(userId)=>{const p=getProfile(userId);if(!p)return;const pw=window.prompt(`Yeni şifre (${p.username}) — en az 10 karakter, harf + rakam:`)||'';if(!strong(pw))return toast(PASS_MSG,false);try{await staffApiV2({action:'reset_password',user_id:userId,password:pw});toast('Şifre sıfırlandı.');}catch(e){toast(e.message||'Şifre sıfırlanamadı.',false)}};
  window.__spDeleteStaff=async(userId)=>{if(!confirm('Bu personel hesabı ve yetkileri kalıcı olarak silinsin mi?'))return;try{await staffApiV2({action:'delete',user_id:userId});toast('Personel silindi.');$('#offerModal')?.remove();await personnelViewV2();}catch(e){toast(e.message||'Silinemedi.',false)}};
  window.__spStaffModal=(id)=>staffModalV2(id||'');
  window.personnelView=personnelViewV2;
  window.staffModal=(id)=>staffModalV2(id||'');
  window.saveStaff=window.__spSaveStaff;
  window.deleteStaff=window.__spDeleteStaff;

  const originalLoadView=window.loadView;
  window.loadView=async function(v){if(v==='personnel'){await personnelViewV2();document.querySelectorAll('#sideNav button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('#viewTitle').textContent='Personel';$('#viewSubtitle').textContent='Portal hesapları ve yetkiler';if(location.hash!=='#personnel')history.replaceState(null,'','#personnel');closeMobileNav();return;}return originalLoadView(v)};
})();
