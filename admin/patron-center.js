/* Stagepulse Patron Center — owner-only executive cockpit. */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const dt=v=>v?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';
  const role=v=>({owner:'Patron / Owner',super_admin:'Süper Admin',ceo:'CEO',upper_admin:'Üst Admin'}[v]||v||'—');
  let state=null, selected=null, owner=false, bootInFlight=false;

  async function isOwner(){
    const c=db();
    if(!c)return false;
    const rpc=await c.rpc('is_org_owner');
    if(!rpc.error&&rpc.data===true)return true;
    const session=await c.auth.getSession();
    const uid=session?.data?.session?.user?.id;
    if(!uid)return false;
    const membership=await c.from('org_memberships').select('role_id,active').eq('user_id',uid).maybeSingle();
    if(membership.error||!membership.data?.active||!membership.data.role_id)return false;
    const r=await c.from('org_roles').select('code').eq('id',membership.data.role_id).maybeSingle();
    return !r.error&&r.data?.code==='owner';
  }

  async function load(){const c=db();if(!c)throw new Error('Yönetim bağlantısı hazır değil.');const r=await c.rpc('owner_control_center');if(r.error)throw r.error;if(!r.data?.authorized){renderDenied();return}state=r.data;const nonOwner=(state.admin_members||[]).filter(x=>x.role_code!=='owner');selected=selected&&nonOwner.some(x=>x.user_id===selected)?selected:(nonOwner[0]?.user_id||null);render()}
  function renderDenied(){const root=$('#content');if(root)root.innerHTML='<div class="panel"><h2>Patron Merkezi</h2><p class="muted">Bu alan yalnızca Patron / Owner hesabına açıktır.</p></div>'}
  function metric(label,value,kind=''){return `<div class="sp-owner-metric ${kind}"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`}
  function render(){
    const root=$('#content');if(!root||!state)return;
    const m=state.metrics||{}, members=state.admin_members||[], caps=state.capabilities||[], grants=state.grants||[], alerts=state.alerts||[];
    const selectedUser=members.find(x=>x.user_id===selected);
    const grantMap=new Map(grants.filter(x=>x.user_id===selected).map(x=>[x.capability_key,x.enabled]));
    const grouped={};caps.forEach(c=>(grouped[c.category||'Diğer']??=[]).push(c));
    root.innerHTML=`<div class="sp-owner-center">
      <section class="sp-owner-hero"><div><span class="sp-owner-badge">PATRON MERKEZİ · EXECUTIVE COCKPIT</span><h2>Şirketi tek ekrandan yönet</h2><p class="muted">Satış, operasyon, finans, ekip, ekipman, risk ve yetkiler tek görünümde.</p></div><div class="actions"><button class="btn" data-refresh>Yenile</button></div></section>
      <section class="sp-owner-metrics">
        ${metric('Açık teklifler',m.offers_open,'warn')}${metric('Kabul edilen',m.offers_accepted,'ok')}${metric('Aktif işler',m.jobs_active)}${metric('Aktif ekipman',m.equipment)}${metric('Düşük stok',m.equipment_low_stock,m.equipment_low_stock?'warn':'ok')}${metric('Bekleyen ödeme',money(m.payments_pending),'warn')}${metric('Gecikmiş ödeme',money(m.payments_overdue),m.payments_overdue?'danger':'ok')}${metric('Toplam teklif',m.offers)}${metric('Toplam iş',m.jobs)}${metric('Okunmamış',m.unread_notifications,m.unread_notifications?'warn':'ok')}
      </section>
      <section class="sp-owner-alerts"><div class="sp-owner-section-title"><h3>Kritik durumlar</h3><small>Önce müdahale edilmesi gerekenler</small></div>${alerts.length?alerts.map(a=>`<button class="sp-owner-alert ${a.priority==='Yüksek'?'danger':a.priority==='Orta'?'warn':'info'}" data-alert-key="${esc(a.key)}"><span class="sp-owner-alert-dot"></span><span><strong>${esc(a.title)}</strong><small>${esc(a.detail)}</small></span><b>${esc(a.value??'')}</b></button>`).join(''):'<div class="sp-owner-empty">Kritik uyarı yok.</div>'}</section>
      <section class="sp-owner-actions"><button class="btn btn-primary" data-go="offers">Teklifler</button><button class="btn" data-go="calendar">İşler · Takvim</button><button class="btn" data-go="equipment">Ekipman</button><button class="btn" data-go="personnel">Personel</button><button class="btn" data-go="finance">Ödemeler</button><button class="btn" data-go="pricing">Fiyatlandırma</button></section>
      <section class="sp-owner-grid">
        <div class="sp-owner-panel"><div class="sp-owner-section-title"><h3>Yönetici erişimleri</h3><small>Patron sınırsızdır; diğer yöneticiler açık yetkileri kadar işlem yapar.</small></div><div>${members.map(u=>`<div class="sp-owner-user"><div class="sp-owner-user-main"><strong>${esc(u.email||u.user_id)}</strong><small>${esc(role(u.role_code))} · ${u.role_code==='owner'?'Sınırsız':`${u.enabled_capabilities}/${u.total_capabilities} yetki`}</small>${u.role_code!=='owner'?`<div class="sp-owner-progress"><i style="width:${Math.min(100,Math.round((u.enabled_capabilities/Math.max(1,u.total_capabilities))*100))}%"></i></div>`:''}</div><button class="btn" data-select-user="${esc(u.user_id)}">${u.role_code==='owner'?'Patron':'Yetkileri yönet'}</button></div>`).join('')}</div></div>
        <div class="sp-owner-panel"><div class="sp-owner-section-title"><h3>Son sistem hareketleri</h3><small>Son 30 kayıt</small></div><div class="sp-owner-activity">${(state.recent_activity||[]).map(a=>`<div><strong>${esc(a.action||'İşlem')}</strong><br><small>${esc(a.entity_type||'')} · ${dt(a.created_at)}</small></div>`).join('')||'<div class="sp-owner-empty">Aktivite yok.</div>'}</div></div>
      </section>
      <section class="sp-owner-panel sp-owner-focus"><div class="sp-owner-section-title"><div><h3>Patron hızlı karar alanı</h3><small>Günün operasyonunu ilgili modüle tek dokunuşla aç.</small></div></div><div class="sp-owner-focus-grid"><div><b>Satış</b><span>${esc(m.offers_open||0)} açık teklif · ${esc(m.offers_accepted||0)} kabul</span><button class="btn" data-go="offers">Satışa git</button></div><div><b>Operasyon</b><span>${esc(m.jobs_active||0)} aktif iş · ${esc(m.equipment_low_stock||0)} düşük stok</span><button class="btn" data-go="calendar">Operasyona git</button></div><div><b>Finans</b><span>${money(m.payments_pending)} bekleyen · ${money(m.payments_overdue)} gecikmiş</span><button class="btn" data-go="finance">Finansa git</button></div><div><b>Ekip</b><span>${esc(m.unread_notifications||0)} okunmamış bildirim</span><button class="btn" data-go="personnel">Ekibe git</button></div></div></section>
      ${selectedUser?permissionPanel(selectedUser,caps,grouped,grantMap):''}
    </div>`;
    bind();
  }
  function permissionPanel(u,caps,grouped,grantMap){return `<section class="sp-owner-panel"><div class="sp-owner-perm-head"><div><h3>Yetki merkezi</h3><div class="muted">${esc(u.email||u.user_id)} · ${esc(role(u.role_code))}</div></div><div><input id="spOwnerPermSearch" placeholder="Yetki ara…"><select id="spOwnerPermCategory"><option value="">Tüm kategoriler</option>${Object.keys(grouped).sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div></div><div class="sp-owner-perm-summary"><span>Aktif: <b>${u.enabled_capabilities}</b></span><span>Toplam: <b>${u.total_capabilities}</b></span><span>Kapsam: <b>${Math.round((u.enabled_capabilities/Math.max(1,u.total_capabilities))*100)}%</b></span></div><div class="sp-owner-perms" id="spOwnerPerms">${caps.map(c=>perm(c,grantMap.get(c.key)===true)).join('')}</div></section>`}
  function perm(c,on){return `<label class="sp-owner-perm" data-key="${esc(c.key)}" data-cat="${esc(c.category||'Diğer')}"><input type="checkbox" data-cap="${esc(c.key)}" ${on?'checked':''}><span><strong>${esc(c.name||c.key)}</strong><small>${esc(c.description||c.key)}</small></span><span class="sp-owner-cat">${esc(c.category||'Diğer')}</span></label>`}
  function bind(){
    $('#content')?.querySelector('[data-refresh]')?.addEventListener('click',()=>load().catch(e=>window.toast?.(e.message||'Yüklenemedi.',false)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.go}));
    document.querySelectorAll('[data-alert-key]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.alertKey;if(k==='payment_overdue')location.hash='finance';else if(k==='low_stock')location.hash='equipment';else if(k==='unread_notifications')location.hash='notifications'}));
    document.querySelectorAll('[data-select-user]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.selectUser;render()}));
    const search=$('#spOwnerPermSearch'),cat=$('#spOwnerPermCategory');
    const filter=()=>{const q=(search?.value||'').toLowerCase(),cv=cat?.value||'';document.querySelectorAll('.sp-owner-perm').forEach(x=>x.hidden=!!((q&&!((x.dataset.key||'').toLowerCase().includes(q)||(x.textContent||'').toLowerCase().includes(q)))||(cv&&x.dataset.cat!==cv)))};
    search?.addEventListener('input',filter);cat?.addEventListener('change',filter);
    document.querySelectorAll('[data-cap]').forEach(i=>i.addEventListener('change',async()=>{const c=db();i.disabled=true;try{const r=await c.rpc('owner_set_admin_capability',{p_user_id:selected,p_capability_key:i.dataset.cap,p_enabled:i.checked});if(r.error)throw r.error;window.toast?.(i.checked?'Yetki açıldı.':'Yetki kapatıldı.',true);const g=state.grants.find(x=>x.user_id===selected&&x.capability_key===i.dataset.cap);if(g)g.enabled=i.checked;else state.grants.push({user_id:selected,capability_key:i.dataset.cap,enabled:i.checked});const u=state.admin_members.find(x=>x.user_id===selected);if(u)u.enabled_capabilities+=i.checked?1:-1;render()}catch(e){i.checked=!i.checked;window.toast?.(e.message||'Yetki değiştirilemedi.',false)}finally{i.disabled=false}}));
  }
  async function open(){if(!location.hash.slice(1).startsWith('patron-center'))return;if(!owner)owner=await isOwner();if(!owner){renderDenied();return}load().catch(e=>{console.error(e);const root=$('#content');if(root)root.innerHTML=`<div class="panel"><h2>Patron Merkezi yüklenemedi</h2><p class="muted">${esc(e.message||'Bilinmeyen hata')}</p></div>`})}
  async function boot(){
    if(bootInFlight)return;
    const nav=$('#sideNav');
    if(!nav)return;
    const existing=nav.querySelectorAll('#patronCenterNav');
    if(existing.length>1)existing.forEach((b,i)=>{if(i>0)b.remove()});
    if($('#patronCenterNav')){open();return}
    bootInFlight=true;
    try{
      owner=await isOwner();
      if(!owner)return;
      const current=$('#patronCenterNav');
      if(current)return;
      const b=document.createElement('button');
      b.id='patronCenterNav';
      b.type='button';
      b.textContent='Patron Merkezi';
      b.dataset.view='patron-center';
      b.addEventListener('click',()=>location.hash='patron-center');
      nav.insertBefore(b,nav.firstElementChild?.nextSibling||nav.firstChild);
      open();
    }finally{bootInFlight=false}
  }
  window.addEventListener('stagepulse-admin-ready',boot);
  window.addEventListener('stagepulse:admin-ready',boot);
  window.addEventListener('stagepulse:logged-in',boot);
  window.addEventListener('hashchange',open);
  document.addEventListener('DOMContentLoaded',boot);
  setInterval(boot,1500);
})();