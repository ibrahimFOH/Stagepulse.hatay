/* Stagepulse Patron Center — owner-only executive workspace. */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const dt=v=>v?new Date(v).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—';
  const role=v=>({owner:'Patron / Owner',super_admin:'Süper Admin',ceo:'CEO',upper_admin:'Üst Admin'}[v]||v||'—');
  let state=null, selected=null;
  async function load(){
    const c=db(); if(!c)return;
    const r=await c.rpc('owner_control_center');
    if(r.error)throw r.error;
    if(!r.data?.authorized){renderDenied();return;}
    state=r.data; const nonOwner=(state.admin_members||[]).filter(x=>x.role_code!=='owner'); selected=selected&&nonOwner.some(x=>x.user_id===selected)?selected:(nonOwner[0]?.user_id||null); render();
  }
  function renderDenied(){const root=$('#content');if(root)root.innerHTML='<div class="panel"><h2>Patron Merkezi</h2><p class="muted">Bu alan yalnızca Patron / Owner hesabına açıktır.</p></div>';}
  function render(){
    const root=$('#content'); if(!root||!state)return;
    const m=state.metrics||{}, members=state.admin_members||[], caps=state.capabilities||[], grants=state.grants||[], selectedUser=members.find(x=>x.user_id===selected), grantMap=new Map(grants.filter(x=>x.user_id===selected).map(x=>[x.capability_key,x.enabled]));
    const grouped={};caps.forEach(c=>(grouped[c.category||'Diğer']??=[]).push(c));
    root.innerHTML=`<div class="sp-owner-center">
      <section class="sp-owner-hero"><div><span class="sp-owner-badge">PATRON MERKEZİ</span><h2>Şirketi tek ekrandan yönet</h2><p class="muted">Yetkiler, satış, operasyon, finans ve kritik sistem durumları.</p></div><div class="actions"><button class="btn" data-refresh>Yenile</button></div></section>
      <section class="sp-owner-metrics">
        ${metric('Açık teklifler',m.offers_open)}${metric('Kabul edilen',m.offers_accepted)}${metric('Aktif işler',m.jobs_active)}${metric('Aktif ekipman',m.equipment)}${metric('Düşük stok',m.equipment_low_stock)}${metric('Bekleyen ödeme',money(m.payments_pending))}${metric('Gecikmiş ödeme',money(m.payments_overdue))}${metric('Toplam teklif',m.offers)}${metric('Toplam iş',m.jobs)}${metric('Okunmamış',m.unread_notifications)}
      </section>
      <section class="sp-owner-actions"><button class="btn btn-primary" data-go="offers">Teklifler</button><button class="btn" data-go="calendar">İşler · Takvim</button><button class="btn" data-go="equipment">Ekipman</button><button class="btn" data-go="personnel">Personel</button><button class="btn" data-go="finance">Ödemeler</button><button class="btn" data-go="pricing">Fiyatlandırma</button></section>
      <section class="sp-owner-grid">
        <div class="sp-owner-panel"><h3>Yönetici erişimleri</h3><div>${members.map(u=>`<div class="sp-owner-user"><div class="sp-owner-user-main"><strong>${esc(u.email||u.user_id)}</strong><small>${esc(role(u.role_code))} · ${u.role_code==='owner'?'Sınırsız':`${u.enabled_capabilities}/${u.total_capabilities} yetki`}</small>${u.role_code!=='owner'?`<div class="sp-owner-progress"><i style="width:${Math.min(100,Math.round((u.enabled_capabilities/Math.max(1,u.total_capabilities))*100))}%"></i></div>`:''}</div><button class="btn" data-select-user="${esc(u.user_id)}">${u.role_code==='owner'?'Patron':'Yetkileri yönet'}</button></div>`).join('')}</div></div>
        <div class="sp-owner-panel"><h3>Son sistem hareketleri</h3><div class="sp-owner-activity">${(state.recent_activity||[]).map(a=>`<div><strong>${esc(a.action||'İşlem')}</strong><br><small>${esc(a.entity_type||'')} · ${dt(a.created_at)}</small></div>`).join('')||'<div class="sp-owner-empty">Aktivite yok.</div>'}</div></div>
      </section>
      ${selectedUser?permissionPanel(selectedUser,caps,grouped,grantMap):''}
    </div>`;
    bind();
  }
  function metric(label,value){return `<div class="sp-owner-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`}
  function permissionPanel(u,caps,grouped,grantMap){return `<section class="sp-owner-panel"><div class="sp-owner-perm-head"><div><h3>Yetki merkezi</h3><div class="muted">${esc(u.email||u.user_id)} · ${esc(role(u.role_code))}</div></div><div><input id="spOwnerPermSearch" placeholder="Yetki ara…"><select id="spOwnerPermCategory"><option value="">Tüm kategoriler</option>${Object.keys(grouped).sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div></div><div class="sp-owner-perms" id="spOwnerPerms">${caps.map(c=>perm(c,grantMap.get(c.key)===true)).join('')}</div></section>`}
  function perm(c,on){return `<label class="sp-owner-perm" data-key="${esc(c.key)}" data-cat="${esc(c.category||'Diğer')}"><input type="checkbox" data-cap="${esc(c.key)}" ${on?'checked':''}><span><strong>${esc(c.name||c.key)}</strong><small>${esc(c.description||c.key)}</small></span><span class="sp-owner-cat">${esc(c.category||'Diğer')}</span></label>`}
  function bind(){
    $('#content')?.querySelector('[data-refresh]')?.addEventListener('click',()=>load().catch(e=>window.toast?.(e.message||'Yüklenemedi.',false)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.go}));
    document.querySelectorAll('[data-select-user]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.selectUser;render()}));
    const search=$('#spOwnerPermSearch'),cat=$('#spOwnerPermCategory');
    const filter=()=>{const q=(search?.value||'').toLowerCase(),cv=cat?.value||'';document.querySelectorAll('.sp-owner-perm').forEach(x=>x.hidden=!!((q&&!((x.dataset.key||'').toLowerCase().includes(q)||(x.textContent||'').toLowerCase().includes(q)))||(cv&&x.dataset.cat!==cv)))};
    search?.addEventListener('input',filter);cat?.addEventListener('change',filter);
    document.querySelectorAll('[data-cap]').forEach(i=>i.addEventListener('change',async()=>{const c=db();i.disabled=true;try{const r=await c.rpc('owner_set_admin_capability',{p_user_id:selected,p_capability_key:i.dataset.cap,p_enabled:i.checked});if(r.error)throw r.error;window.toast?.(i.checked?'Yetki açıldı.':'Yetki kapatıldı.',true);const g=state.grants.find(x=>x.user_id===selected&&x.capability_key===i.dataset.cap);if(g)g.enabled=i.checked;else state.grants.push({user_id:selected,capability_key:i.dataset.cap,enabled:i.checked});const u=state.admin_members.find(x=>x.user_id===selected);if(u)u.enabled_capabilities+=i.checked?1:-1;render();}catch(e){i.checked=!i.checked;window.toast?.(e.message||'Yetki değiştirilemedi.',false)}finally{i.disabled=false}}));
  }
  function open(){if(!location.hash.slice(1).startsWith('patron-center'))return;load().catch(e=>{console.error(e);const root=$('#content');if(root)root.innerHTML=`<div class="panel"><h2>Patron Merkezi yüklenemedi</h2><p class="muted">${esc(e.message||'Bilinmeyen hata')}</p></div>`});}
  function boot(){if($('#patronCenterNav'))return;const nav=$('#sideNav');if(!nav)return;const b=document.createElement('button');b.id='patronCenterNav';b.type='button';b.textContent='Patron Merkezi';b.dataset.view='patron-center';b.addEventListener('click',()=>location.hash='patron-center');nav.insertBefore(b,nav.firstElementChild?.nextSibling||nav.firstChild);open()}
  window.addEventListener('stagepulse-admin-ready',boot);window.addEventListener('hashchange',open);document.addEventListener('DOMContentLoaded',boot);setTimeout(boot,1000);
})();