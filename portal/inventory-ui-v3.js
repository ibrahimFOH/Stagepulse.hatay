/* Stagepulse Inventory UI v6 — canonical personnel/admin equipment UI. */
(() => {
  const PAGE_SIZE=50;
  let page=0,total=0,rows=[],q='';
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Math.max(0,Number(v)||0);
  const healthy=e=>Math.max(0,n(e.quantity)-n(e.faulty_quantity)-n(e.maintenance_quantity));
  const available=e=>Math.max(0,n(e.quantity)-n(e.faulty_quantity)-n(e.maintenance_quantity)-n(e.reserved_quantity)-n(e.in_use_quantity));
  const isAdmin=location.pathname.startsWith('/admin');
  const source=()=>isAdmin?'equipment':'equipment_staff';
  const hasCan=()=>typeof window.can==='function';
  const canEdit=()=>isAdmin||(hasCan()&&(window.can('equipment.manage')||window.can('equipment.update')||window.can('equipment_status_update')));
  const canView=()=>isAdmin||(hasCan()&&(window.can('equipment')||window.can('jobs')));
  const notify=(msg,ok=true)=>typeof toast==='function'?toast(msg,ok):console.log(msg);
  let modalReturnFocus=null;
  const modalKeydown=event=>{if(event.key==='Escape')window.spPersonnelInventoryClose();};
  const style=document.createElement('style');
  style.textContent=`
    .sp-pinv-toolbar{display:flex;gap:10px;margin-bottom:14px}.sp-pinv-toolbar input{flex:1}.sp-pinv-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.sp-pinv-stat{padding:14px;border:1px solid #282828;border-radius:14px;background:#111}.sp-pinv-stat span{display:block;color:#999;font-size:12px}.sp-pinv-stat b{display:block;margin-top:4px;font-size:21px}.sp-pinv-status{display:flex;gap:5px;flex-wrap:wrap}.sp-pinv-chip{border:1px solid #292929;border-radius:999px;padding:4px 8px;font-size:11px;background:#151515;color:#ccc;font-weight:600;white-space:nowrap}.sp-pinv-chip b{color:inherit}.sp-pinv-chip:nth-child(1){border-color:#1f6b45;background:#0c2418;color:#73dda1;box-shadow:0 0 8px rgba(105,223,145,.12)}.sp-pinv-chip:nth-child(2){border-color:#713838;background:#261010;color:#ff8b8b;box-shadow:0 0 8px rgba(255,115,115,.12)}.sp-pinv-chip:nth-child(3){border-color:#6e5b0a;background:#241f08;color:#f4d35e;box-shadow:0 0 8px rgba(244,211,94,.12)}.sp-pinv-chip:nth-child(4){border-color:#51418a;background:#17132a;color:#b6a5ff;box-shadow:0 0 8px rgba(169,146,255,.12)}.sp-pinv-chip:nth-child(5){border-color:#315c8f;background:#0d1929;color:#83b5ff;box-shadow:0 0 8px rgba(117,169,255,.12)}.sp-pinv-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.78);backdrop-filter:blur(7px)}.sp-pinv-card{width:min(680px,100%);max-height:92vh;overflow:auto;background:#101010;border:1px solid #343434;border-radius:22px;padding:20px;box-shadow:0 30px 90px #000}.sp-pinv-head{display:flex;justify-content:space-between;gap:10px}.sp-pinv-head h2{margin:0}.sp-pinv-close{width:40px;height:40px;border-radius:10px;background:#181818;color:#fff;border:1px solid #333;font-size:22px}.sp-pinv-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.sp-pinv-grid label{font-size:13px;font-weight:600}.sp-pinv-grid input{margin-top:6px;width:100%;box-sizing:border-box}.sp-pinv-section{margin-top:16px;padding:14px;border:1px solid #292929;border-radius:16px;background:#0d0d0d}.sp-pinv-status-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sp-pinv-status-grid input{margin-top:5px;width:100%;box-sizing:border-box}.sp-pinv-live{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.sp-pinv-live div{background:#151515;padding:9px;border-radius:9px}.sp-pinv-live span{display:block;color:#888;font-size:11px}.sp-pinv-live b{font-size:17px}.sp-pinv-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:16px}@media(max-width:650px){.sp-pinv-summary{grid-template-columns:1fr 1fr}.sp-pinv-grid,.sp-pinv-status-grid{grid-template-columns:1fr}.sp-pinv-live{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  async function load(){
    if(!canView())return;
    let query=sb.from(source()).select('id,category,brand,model,quantity,active,notes,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,updated_at',{count:'exact'}).order('category').order('brand',{nullsFirst:true}).range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);
    if(q)query=query.or(`category.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`);
    const {data,error,count}=await query;if(error)throw error;rows=data||[];total=count||0;render();
  }

  async function loadOne(id){
    const {data,error}=await sb.from(source()).select('id,category,brand,model,quantity,active,notes,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,updated_at').eq('id',id).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Ekipman kaydı bulunamadı. Listeyi yenileyin.');
    return data;
  }

  function render(){
    const qty=rows.reduce((a,e)=>a+n(e.quantity),0),fault=rows.reduce((a,e)=>a+n(e.faulty_quantity),0),maint=rows.reduce((a,e)=>a+n(e.maintenance_quantity),0),free=rows.reduce((a,e)=>a+available(e),0);
    $('#content').innerHTML=`<div class="page-head"><div><h1>Ekipman</h1><p class="muted">Envanter · durum adetleri · sadece yetkili personel düzenleyebilir</p></div></div><div class="sp-pinv-toolbar"><input id="spPInvSearch" placeholder="Kategori, marka veya model ara…" value="${esc(q)}"><button class="btn" id="spPInvRefresh">Yenile</button></div><div class="sp-pinv-summary"><div class="sp-pinv-stat"><span>Bu sayfa toplam</span><b>${qty}</b></div><div class="sp-pinv-stat"><span>Arızalı</span><b>${fault}</b></div><div class="sp-pinv-stat"><span>Bakımda</span><b>${maint}</b></div><div class="sp-pinv-stat"><span>Sağlam / boşta</span><b>${free}</b></div></div><div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Ekipman</th><th>Toplam</th><th>Durum adetleri</th><th>Aktif</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td><strong>${esc([e.category,e.brand].filter(Boolean).join(' · '))}</strong><div class="muted small">${esc(e.model||'—')}</div></td><td><b>${n(e.quantity)}</b></td><td><div class="sp-pinv-status"><span class="sp-pinv-chip">Sağlam <b>${healthy(e)}</b></span><span class="sp-pinv-chip">Arıza <b>${n(e.faulty_quantity)}</b></span><span class="sp-pinv-chip">Bakım <b>${n(e.maintenance_quantity)}</b></span><span class="sp-pinv-chip">Rezerve <b>${n(e.reserved_quantity)}</b></span><span class="sp-pinv-chip">Kullanımda <b>${n(e.in_use_quantity)}</b></span></div></td><td>${e.active===false?'<span class="status cancelled">Pasif</span>':'<span class="status accepted">Aktif</span>'}</td><td>${canEdit()?`<button class="btn" onclick="window.spPersonnelInventory('${e.id}')">Durum</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="muted" style="text-align:center;padding:28px">Ekipman bulunamadı.</td></tr>'}</tbody></table></div></div><div class="sp-pinv-pager"><button class="btn" id="spPPrev" ${page===0?'disabled':''}>‹ Önceki</button><span>${total?page*PAGE_SIZE+1:0}–${Math.min((page+1)*PAGE_SIZE,total)} / ${total}</span><button class="btn" id="spPNext" ${((page+1)*PAGE_SIZE>=total)?'disabled':''}>Sonraki ›</button></div>`;
    $('#spPInvSearch')?.addEventListener('input',()=>{q=$('#spPInvSearch').value.trim();page=0;clearTimeout(window.__spPinvT);window.__spPinvT=setTimeout(load,280)});$('#spPInvRefresh')?.addEventListener('click',load);$('#spPPrev')?.addEventListener('click',()=>{if(page>0){page--;load()}});$('#spPNext')?.addEventListener('click',()=>{if((page+1)*PAGE_SIZE<total){page++;load()}});
  }

  async function modal(id){
    if(!canEdit())return notify('Ekipman durumunu değiştirme yetkiniz yok.',false);
    let e;
    try{e=await loadOne(id)}catch(err){return notify(err.message||'Ekipman yeniden okunamadı.',false)}
    const total=n(e.quantity);window.spPersonnelInventoryClose();modalReturnFocus=document.activeElement;
    document.body.insertAdjacentHTML('beforeend',`<div class="sp-pinv-modal" id="spPInvModal" role="dialog" aria-modal="true" aria-labelledby="spPInvTitle" aria-describedby="spPInvDescription"><div class="sp-pinv-card"><div class="sp-pinv-head"><div><p class="muted small">ENVANTER DURUMU</p><h2 id="spPInvTitle">${esc([e.brand,e.model].filter(Boolean).join(' ')||e.category)}</h2><p class="muted" id="spPInvDescription">Toplam stok <strong>${total}</strong> adet · Aktif/Pasif admin tarafından yönetilir</p></div><button type="button" class="sp-pinv-close" aria-label="Envanter penceresini kapat" onclick="window.spPersonnelInventoryClose()">×</button></div><div class="sp-pinv-section"><h3>Durum adetlerini değiştir</h3><div class="sp-pinv-status-grid"><label for="spPFault">Arızalı<input id="spPFault" type="number" min="0" max="${total}" value="${n(e.faulty_quantity)}"></label><label for="spPMaint">Bakımda<input id="spPMaint" type="number" min="0" max="${total}" value="${n(e.maintenance_quantity)}"></label><label for="spPReserved">Rezerve<input id="spPReserved" type="number" min="0" max="${total}" value="${n(e.reserved_quantity)}"></label><label for="spPUse">Kullanımda<input id="spPUse" type="number" min="0" max="${total}" value="${n(e.in_use_quantity)}"></label></div><div class="sp-pinv-live" aria-live="polite"><div><span>Toplam stok</span><b id="spPTotal">${total}</b></div><div><span>Arızalı</span><b id="spPFaultLive">${n(e.faulty_quantity)}</b></div><div><span>Sağlam</span><b id="spPHealthy">${healthy(e)}</b></div><div><span>Boşta</span><b id="spPAvailable">${available(e)}</b></div></div></div><div class="sp-pinv-actions"><button type="button" class="btn btn-primary" onclick="window.spPersonnelInventorySave('${e.id}')">Kaydet</button><button type="button" class="btn" onclick="window.spPersonnelInventoryClose()">İptal</button></div></div></div>`);
    document.addEventListener('keydown',modalKeydown);
    $('#spPFault')?.focus();
    ['spPFault','spPMaint','spPReserved','spPUse'].forEach(k=>$('#'+k)?.addEventListener('input',()=>{const t=total,f=n($('#spPFault').value),m=n($('#spPMaint').value),r=n($('#spPReserved').value),u=n($('#spPUse').value);$('#spPTotal').textContent=t;$('#spPFaultLive').textContent=f;$('#spPHealthy').textContent=Math.max(0,t-f-m);$('#spPAvailable').textContent=Math.max(0,t-f-m-r-u)}));
  }

  window.spPersonnelInventory=modal;
  window.spPersonnelInventoryClose=()=>{document.removeEventListener('keydown',modalKeydown);document.getElementById('spPInvModal')?.remove();if(modalReturnFocus?.isConnected)modalReturnFocus.focus();modalReturnFocus=null;};
  window.spPersonnelInventorySave=async(id)=>{
    if(!canEdit())return notify('Ekipman durumunu değiştirme yetkiniz yok.',false);
    const f=n($('#spPFault').value),m=n($('#spPMaint').value),r=n($('#spPReserved').value),u=n($('#spPUse').value);
    let latest;try{latest=await loadOne(id)}catch(err){return notify(err.message||'Ekipman yeniden okunamadı.',false)}
    const totalNow=n(latest.quantity);
    if(f+m+r+u>totalNow)return notify(`Durum adetleri toplam stoktan (${totalNow}) fazla olamaz.`,false);
    const res=await sb.from('equipment').update({faulty_quantity:f,maintenance_quantity:m,reserved_quantity:r,in_use_quantity:u,updated_at:new Date().toISOString()}).eq('id',id);
    if(res.error)return notify(res.error.message,false);
    notify('Ekipman durumu güncellendi.');window.spPersonnelInventoryClose();window.dispatchEvent(new CustomEvent('stagepulse:inventory-changed'));await load();
  };
  window.equipmentView=async()=>{page=0;await load()};
  const boot=()=>{if(location.hash==='#equipment')setTimeout(()=>window.loadView?.('equipment'),0)};
  window.addEventListener('hashchange',boot);window.addEventListener('stagepulse:inventory-changed',()=>{if(location.hash==='#equipment')load()});boot();
})();
