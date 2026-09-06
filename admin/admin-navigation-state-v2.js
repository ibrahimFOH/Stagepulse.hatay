/* Stagepulse Admin — canonical management navigation + management center. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_NAV_STATE_V2) return;
  window.STAGEPULSE_ADMIN_NAV_STATE_V2 = true;

  const MANAGEMENT = [
    ['scope', 'Yönetim Kapsamım'],
    ['organization', 'Şirket Organizasyonu'],
    ['accounts', 'Yönetici Hesapları'],
    ['rbac', 'Rol · Yetki Merkezi']
  ];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const norm = v => String(v || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;
  const call = async (action, body = {}) => {
    const c = client();
    if (!c) throw new Error('Yönetim bağlantısı hazır değil.');
    const r = await c.functions.invoke('org-admin-control', { body: { action, ...body } });
    if (r.error) throw r.error;
    if (r.data?.error) throw new Error(r.data.error);
    return r.data || {};
  };

  let catalog = null;
  let members = [];

  function style() {
    if ($('#sp-management-center-style')) return;
    const s = document.createElement('style'); s.id = 'sp-management-center-style';
    s.textContent = `
      #spManagementCenter{display:grid;gap:14px}.sp-mc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.sp-mc-head h2{margin:0 0 5px}.sp-mc-head p{margin:0;color:#9da6b4}.sp-mc-tabs{display:flex;gap:7px;flex-wrap:wrap}.sp-mc-tabs button{border:1px solid #343a45;background:#171b22;color:#dfe4eb;border-radius:9px;padding:9px 12px;font-weight:800;cursor:pointer}.sp-mc-tabs button.active{background:#ffb000;color:#111;border-color:#ffb000}.sp-mc-card{background:#11151b;border:1px solid #2b3039;border-radius:14px;padding:15px;min-width:0}.sp-mc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sp-mc-grid label{display:grid;gap:5px;color:#aeb5c0;font-size:12px;font-weight:800}.sp-mc-grid input,.sp-mc-grid select{width:100%;box-sizing:border-box;padding:10px;background:#0c0f14;color:#fff;border:1px solid #343a45;border-radius:9px}.sp-mc-table{width:100%;border-collapse:collapse}.sp-mc-table th,.sp-mc-table td{padding:10px;border-bottom:1px solid #292f39;text-align:left;vertical-align:middle}.sp-mc-table th{color:#9da6b4;font-size:11px}.sp-mc-actions{display:flex;gap:7px;flex-wrap:wrap}.sp-mc-actions button{border:1px solid #343a45;background:#191d24;color:#fff;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer}.sp-mc-actions .primary{background:#ffb000;color:#111;border-color:#ffb000}.sp-mc-cap{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #252a32}.sp-mc-cap small{display:block;color:#7f8998;margin-top:3px}.sp-mc-error{border:1px solid #633030;background:#32171b;color:#ff9baa;border-radius:10px;padding:12px}.sp-mc-ok{border:1px solid #245439;background:#102319;color:#79e5a7;border-radius:10px;padding:10px}.sp-mc-muted{color:#8f98a6}.sp-mc-danger{color:#ff9baa!important}.sp-mc-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}@media(max-width:700px){.sp-mc-grid{grid-template-columns:1fr}.sp-mc-table{display:block;overflow:auto;white-space:nowrap}}
    `; document.head.appendChild(s);
  }

  function dedupeManagement() {
    const nav = $('#sideNav'); if (!nav) return;
    const seenView = new Set(), seenLabel = new Set();
    $$('button', nav).forEach(b => {
      if (b.id === 'logoutBtn' || b.classList.contains('nav-logout')) return;
      const view = norm(b.dataset.view), label = norm(b.textContent);
      if (!MANAGEMENT.some(([v,l]) => v === view || norm(l) === label)) return;
      if ((view && seenView.has(view)) || (label && seenLabel.has(label))) { b.remove(); return; }
      if (view) seenView.add(view); if (label) seenLabel.add(label);
    });
  }

  function ensureMissingNav() {
    const nav = $('#sideNav'); if (!nav) return;
    const settings = nav.querySelector('button[data-view="settings"]');
    const logout = nav.querySelector('#logoutBtn,button.nav-logout');
    let after = settings;
    MANAGEMENT.forEach(([view,label]) => {
      let b = nav.querySelector(`button[data-view="${view}"]`);
      if (!b) { b = document.createElement('button'); b.type='button'; b.dataset.view=view; b.textContent=label; if (after?.parentNode) after.parentNode.insertBefore(b, after.nextSibling); else if (logout) nav.insertBefore(b, logout); else nav.appendChild(b); }
      b.classList.add('nav-management-entry'); after = b;
    });
    dedupeManagement();
  }

  function setActive(view) {
    $$('#sideNav button[data-view]').forEach(b => b.classList.toggle('active', norm(b.dataset.view) === norm(view)));
  }

  function tabBar(active) {
    return `<div class="sp-mc-tabs">${MANAGEMENT.map(([v,l]) => `<button type="button" data-mc-tab="${v}" class="${v===active?'active':''}">${l}</button>`).join('')}</div>`;
  }

  async function loadData() {
    if (!catalog) catalog = await call('catalog');
    const data = await call('members'); members = data.members || [];
    return {catalog, members};
  }

  function memberName(m) { const p=m?.profile||{}; return p.display_name || p.username || p.email || m?.user_id || 'Hesap'; }
  function roleName(m) { return m?.role?.name || m?.role?.code || '-'; }
  function positionName(m) { return m?.position?.name || m?.position?.code || '-'; }
  function optionList(items, value, labelKey='name') { return (items||[]).map(x => `<option value="${esc(x.code||x.id)}" ${String(x.code||x.id)===String(value||'')?'selected':''}>${esc(x[labelKey]||x.name||x.code||x.id)}</option>`).join(''); }

  async function renderScope(host) {
    try {
      const ctx = await call('my_context');
      if (!ctx.membership) throw new Error('Aktif organizasyon üyeliği bulunamadı.');
      host.innerHTML = `${tabBar('scope')}<div class="sp-mc-card"><div class="sp-mc-head"><div><h3>Yönetim Kapsamım</h3><p>Oturum açan hesabın gerçek organizasyon rolü ve yetki kapsamı.</p></div></div><div class="sp-mc-grid" style="margin-top:12px"><label>Rol<input readonly value="${esc(ctx.membership.role?.name||ctx.membership.role?.code||'-')}"></label><label>Pozisyon<input readonly value="${esc(ctx.membership.position?.name||ctx.membership.position?.code||'-')}"></label><label>Departman<input readonly value="${esc(ctx.membership.department?.name||'-')}"></label><label>Bölge<input readonly value="${esc(ctx.membership.region?.name||'-')}"></label></div></div><div class="sp-mc-card"><h3>Aktif Yetkiler</h3><p class="sp-mc-muted">${(ctx.capabilities||[]).length} yetki açık.</p><div>${(ctx.capabilities||[]).map(x=>`<div class="sp-mc-cap"><span><b>${esc(x.name||x.key)}</b><small>${esc(x.description||x.key)}</small></span><code>${esc(x.key)}</code></div>`).join('') || '<p class="sp-mc-muted">Tanımlı yetki yok.</p>'}</div></div>`;
      bindTabs(host);
    } catch(e) { host.innerHTML = `${tabBar('scope')}<div class="sp-mc-error">Yönetim kapsamı yüklenemedi: ${esc(e.message||'Bilinmeyen hata')}</div>`; bindTabs(host); }
  }

  async function renderOrganization(host) {
    try {
      const data = await loadData();
      host.innerHTML = `${tabBar('organization')}<div class="sp-mc-card"><div class="sp-mc-head"><div><h3>Şirket Organizasyonu</h3><p>Tek organizasyon görünümü: üyeler, roller, pozisyonlar, departmanlar ve bölgeler.</p></div><span class="sp-mc-muted">${members.length} kayıt</span></div><div style="overflow:auto;margin-top:12px"><table class="sp-mc-table"><thead><tr><th>Hesap</th><th>Rol</th><th>Pozisyon</th><th>Departman</th><th>Bölge</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>${members.map(m=>`<tr><td>${esc(memberName(m))}<br><small class="sp-mc-muted">${esc(m.profile?.email||'')}</small></td><td>${esc(roleName(m))}</td><td>${esc(positionName(m))}</td><td>${esc(m.department?.name||'-')}</td><td>${esc(m.region?.name||'-')}</td><td>${m.active?'Aktif':'Pasif'}</td><td><div class="sp-mc-actions"><button type="button" data-edit-member="${esc(m.user_id)}" class="primary">Düzenle</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
      bindTabs(host); bindMemberEditors(host);
    } catch(e) { host.innerHTML = `${tabBar('organization')}<div class="sp-mc-error">Şirket organizasyonu yüklenemedi: ${esc(e.message||'Bilinmeyen hata')}</div>`; bindTabs(host); }
  }

  function memberEditor(m) {
    const c=catalog||{roles:[],positions:[],departments:[],regions:[]};
    return `<div class="sp-mc-card" data-editor="${esc(m.user_id)}" style="margin-top:12px"><h3>${esc(memberName(m))}</h3><div class="sp-mc-grid"><label>Rol<select data-k="role_code">${optionList(c.roles,m.role?.code)}</select></label><label>Pozisyon<select data-k="position_code">${optionList(c.positions,m.position?.code)}</select></label><label>Departman<select data-k="department_id"><option value="">Yok</option>${optionList(c.departments,m.department_id)}</select></label><label>Bölge<select data-k="region_id"><option value="">Yok</option>${optionList(c.regions,m.region_id)}</select></label><label>Yönetici UUID<input data-k="manager_user_id" value="${esc(m.manager_user_id||'')}"></label><label>Aktif<select data-k="active"><option value="true" ${m.active?'selected':''}>Aktif</option><option value="false" ${!m.active?'selected':''}>Pasif</option></select></label></div><div class="sp-mc-form-actions"><button type="button" data-cancel-editor>Vazgeç</button><button type="button" class="primary" data-save-member="${esc(m.user_id)}">Kaydet</button></div></div>`;
  }
  function bindMemberEditors(host) {
    $$('[data-edit-member]',host).forEach(b=>b.onclick=()=>{const m=members.find(x=>x.user_id===b.dataset.editMember);if(!m)return;host.querySelector('[data-editor]')?.remove();b.closest('tr')?.after(Object.assign(document.createElement('tr'),{innerHTML:`<td colspan="7">${memberEditor(m)}</td>`}));bindMemberEditors(host);});
    $$('[data-cancel-editor]',host).forEach(b=>b.onclick=()=>b.closest('[data-editor]')?.remove());
    $$('[data-save-member]',host).forEach(b=>b.onclick=async()=>{const box=b.closest('[data-editor]');const id=b.dataset.saveMember;const payload={user_id:id};$$('[data-k]',box).forEach(x=>payload[x.dataset.k]=x.value);payload.active=payload.active==='true';try{b.disabled=true;await call('save_membership',payload);await renderOrganization(host);}catch(e){window.toast?.(e.message||'Üyelik kaydedilemedi.',false);b.disabled=false;}});
  }

  async function renderAccounts(host) {
    try {
      const data=await loadData();
      const c=data.catalog;
      host.innerHTML=`${tabBar('accounts')}<div class="sp-mc-card"><div class="sp-mc-head"><div><h3>Yönetici Hesapları</h3><p>Auth hesabı + organizasyon üyeliği tek yönetim akışından oluşturulur.</p></div><button type="button" class="sp-mc-actions primary" id="spCreateAccount">Yeni hesap</button></div><div id="spAccountCreate" hidden style="margin-top:12px"><div class="sp-mc-grid"><label>Kullanıcı adı<input id="spAccUsername" autocomplete="off"></label><label>Ad Soyad<input id="spAccDisplay"></label><label>Şifre<input id="spAccPassword" type="password" autocomplete="new-password"></label><label>Rol<select id="spAccRole"><option value="">Seçin</option>${optionList(c.roles.filter(x=>x.code!=='owner'))}</select></label><label>Pozisyon<select id="spAccPosition"><option value="">Seçin</option>${optionList(c.positions)}</select></label><label>Departman<select id="spAccDept"><option value="">Yok</option>${optionList(c.departments)}</select></label><label>Bölge<select id="spAccRegion"><option value="">Yok</option>${optionList(c.regions)}</select></label></div><div class="sp-mc-form-actions"><button type="button" id="spAccCancel">Vazgeç</button><button type="button" class="primary" id="spAccSave">Hesabı oluştur</button></div></div></div><div class="sp-mc-card"><div style="overflow:auto"><table class="sp-mc-table"><thead><tr><th>Hesap</th><th>Rol</th><th>Pozisyon</th><th>Durum</th><th>Son giriş</th><th>İşlem</th></tr></thead><tbody>${members.map(m=>`<tr><td>${esc(memberName(m))}<br><small class="sp-mc-muted">${esc(m.profile?.username||m.profile?.email||'')}</small></td><td>${esc(roleName(m))}</td><td>${esc(positionName(m))}</td><td>${m.active?'Aktif':'Pasif'}</td><td>${esc(m.profile?.last_sign_in_at||'-')}</td><td>${m.role?.code==='owner'?'<span class="sp-mc-muted">Patron</span>':`<button type="button" data-edit-account="${esc(m.user_id)}" class="primary">Düzenle</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;
      bindTabs(host);
      $('#spCreateAccount',host).onclick=()=>{const x=$('#spAccountCreate',host);x.hidden=!x.hidden;};
      $('#spAccCancel',host).onclick=()=>$('#spAccountCreate',host).hidden=true;
      $('#spAccSave',host).onclick=async()=>{const b=$('#spAccSave',host);try{b.disabled=true;await call('create_member',{username:$('#spAccUsername',host).value,display_name:$('#spAccDisplay',host).value,password:$('#spAccPassword',host).value,role_code:$('#spAccRole',host).value,position_code:$('#spAccPosition',host).value,department_id:$('#spAccDept',host).value||null,region_id:$('#spAccRegion',host).value||null});await renderAccounts(host);window.toast?.('Hesap oluşturuldu.',true);}catch(e){window.toast?.(e.message||'Hesap oluşturulamadı.',false);b.disabled=false;}};
      $$('[data-edit-account]',host).forEach(b=>b.onclick=()=>{const m=members.find(x=>x.user_id===b.dataset.editAccount);if(!m)return;host.querySelector('[data-editor]')?.remove();const tr=b.closest('tr');const row=document.createElement('tr');row.innerHTML=`<td colspan="6">${memberEditor(m)}</td>`;tr.after(row);bindMemberEditors(host);});
    } catch(e) { host.innerHTML=`${tabBar('accounts')}<div class="sp-mc-error">Yönetici hesapları yüklenemedi: ${esc(e.message||'Bilinmeyen hata')}</div>`;bindTabs(host); }
  }

  async function renderRbac(host) {
    try {
      const data=await loadData(), c=data.catalog;
      const selected=members.find(m=>m.user_id===host.dataset.rbacUser)||members.find(m=>m.role?.code!=='owner')||members[0];
      const caps=selected?.capabilities||[]; const enabled=new Set(caps.map(x=>x.key||x.capability_key));
      const groups={};(c.capabilities||[]).forEach(x=>(groups[x.category||'Diğer']??=[]).push(x));
      host.innerHTML=`${tabBar('rbac')}<div class="sp-mc-card"><div class="sp-mc-head"><div><h3>Rol · Yetki Merkezi</h3><p>Kullanıcı bazlı yetki matrisi. Patron hesabı değiştirilemez.</p></div><label style="min-width:min(420px,100%)">Hesap<select id="spRbacMember">${members.filter(m=>m.user_id).map(m=>`<option value="${esc(m.user_id)}" ${m.user_id===selected?.user_id?'selected':''}>${esc(memberName(m))} · ${esc(roleName(m))}</option>`).join('')}</select></label></div><div class="sp-mc-actions" style="margin:12px 0"><button type="button" id="spRbacRead">Sadece Görüntüleme</button><button type="button" id="spRbacAll" class="primary">Tümünü Aç</button><button type="button" id="spRbacNone" class="sp-mc-danger">Tümünü Kapat</button></div>${Object.keys(groups).sort().map(cat=>`<section><h4>${esc(cat)}</h4>${groups[cat].map(x=>`<label class="sp-mc-cap"><span><b>${esc(x.name)}</b><small>${esc(x.description||x.key)}</small><code>${esc(x.key)}</code></span><input type="checkbox" data-rbac-key="${esc(x.key)}" ${enabled.has(x.key)?'checked':''} ${selected?.role?.code==='owner'?'disabled':''}></label>`).join('')}</section>`).join('')}</div>`;
      bindTabs(host);
      $('#spRbacMember',host).onchange=()=>{host.dataset.rbacUser=$('#spRbacMember',host).value;renderRbac(host);};
      $$('[data-rbac-key]',host).forEach(i=>i.onchange=async()=>{try{await call('set_capability',{user_id:selected.user_id,capability_key:i.dataset.rbacKey,enabled:i.checked});i.disabled=true;renderRbac(host);}catch(e){i.checked=!i.checked;window.toast?.(e.message||'Yetki güncellenemedi.',false);}});
      const bulk=async mode=>{if(!selected||selected.role?.code==='owner')return;const boxes=$$('[data-rbac-key]',host);for(const i of boxes){const on=mode==='all'?true:mode==='none'?false:/\.(view|export|preview|visibility)$/.test(i.dataset.rbacKey);if(i.checked!==on)await call('set_capability',{user_id:selected.user_id,capability_key:i.dataset.rbacKey,enabled:on});}renderRbac(host);};
      $('#spRbacRead',host).onclick=()=>bulk('read');$('#spRbacAll',host).onclick=()=>bulk('all');$('#spRbacNone',host).onclick=()=>bulk('none');
    } catch(e) { host.innerHTML=`${tabBar('rbac')}<div class="sp-mc-error">Rol · Yetki Merkezi yüklenemedi: ${esc(e.message||'Bilinmeyen hata')}</div>`;bindTabs(host); }
  }

  function bindTabs(host) { $$('[data-mc-tab]',host).forEach(b=>b.onclick=()=>openManagement(b.dataset.mcTab)); }

  async function openManagement(view) {
    ensureMissingNav(); setActive(view); style();
    location.hash='#'+view;
    const content=$('#content'); if(!content)return;
    content.innerHTML='<div id="spManagementCenter" class="sp-management-center"><div class="sp-mc-card">Yükleniyor…</div></div>';
    const host=$('#spManagementCenter');
    if(view==='scope') await renderScope(host); else if(view==='organization') await renderOrganization(host); else if(view==='accounts') await renderAccounts(host); else if(view==='rbac') await renderRbac(host);
  }

  const hook=()=>{ ensureMissingNav(); const h=norm((location.hash||'#dashboard').slice(1).split('?')[0]); if(MANAGEMENT.some(([v])=>v===h)) openManagement(h); };
  document.addEventListener('click',e=>{const b=e.target.closest?.('#sideNav button[data-view]');if(!b)return;const v=b.dataset.view;if(MANAGEMENT.some(([x])=>x===v)){e.preventDefault();e.stopImmediatePropagation();openManagement(v);}},true);
  window.addEventListener('hashchange',()=>{const h=norm((location.hash||'').slice(1).split('?')[0]);if(MANAGEMENT.some(([v])=>v===h))openManagement(h);});
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(hook,0));
  document.addEventListener('DOMContentLoaded',hook);
  setTimeout(hook,1000);
})();