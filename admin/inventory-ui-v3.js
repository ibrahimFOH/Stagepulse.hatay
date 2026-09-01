/* Stagepulse Inventory UI v3 — admin. No full-collection loading. */
(() => {
  const PAGE_SIZE = 50;
  let page = 0;
  let total = 0;
  let filters = { q: '', category: '', active: '' };
  let rows = [];
  const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const n = (v) => Math.max(0, Number(v) || 0);
  const money = (v) => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(n(v));
  const available = e => Math.max(0, n(e.quantity)-n(e.faulty_quantity)-n(e.maintenance_quantity)-n(e.reserved_quantity)-n(e.in_use_quantity));
  const stateTotal = e => n(e.faulty_quantity)+n(e.maintenance_quantity)+n(e.reserved_quantity)+n(e.in_use_quantity);

  const style = document.createElement('style');
  style.textContent = `
    .sp-inv-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 180px 150px auto;gap:10px;margin-bottom:14px}
    .sp-inv-toolbar input,.sp-inv-toolbar select{width:100%;box-sizing:border-box}
    .sp-inv-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
    .sp-inv-stat{padding:14px 16px;border:1px solid #282828;border-radius:14px;background:#111}.sp-inv-stat span{display:block;color:#999;font-size:12px}.sp-inv-stat b{display:block;margin-top:4px;font-size:22px}
    .sp-inv-status{display:flex;gap:5px;flex-wrap:wrap;min-width:260px}.sp-inv-chip{border:1px solid #2b2b2b;border-radius:999px;padding:4px 8px;font-size:11px;color:#cfcfcf;background:#151515}.sp-inv-chip strong{color:#fff}
    .sp-inv-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.76);backdrop-filter:blur(7px)}
    .sp-inv-card{width:min(720px,100%);max-height:min(92vh,900px);overflow:auto;background:#101010;border:1px solid #343434;border-radius:22px;box-shadow:0 30px 90px #000;padding:22px}
    .sp-inv-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:18px}.sp-inv-head h2{margin:0}.sp-inv-close{border:1px solid #333;background:#181818;color:#fff;border-radius:10px;font-size:22px;width:42px;height:42px}
    .sp-inv-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.sp-inv-grid label{display:block;font-weight:600;font-size:13px}.sp-inv-grid input,.sp-inv-grid select,.sp-inv-grid textarea{margin-top:6px;width:100%;box-sizing:border-box}
    .sp-inv-section{margin-top:18px;padding:16px;border:1px solid #292929;border-radius:16px;background:#0d0d0d}.sp-inv-section h3{margin:0 0 12px;font-size:15px}
    .sp-inv-status-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.sp-inv-status-grid label{font-size:12px;color:#aaa}.sp-inv-status-grid input{margin-top:5px}
    .sp-inv-live{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.sp-inv-live div{padding:10px;border-radius:10px;background:#151515}.sp-inv-live span{display:block;color:#888;font-size:11px}.sp-inv-live b{font-size:17px}
    .sp-inv-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px}.sp-inv-pager{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:14px}.sp-inv-pager span{color:#999;font-size:13px}
    @media(max-width:700px){.sp-inv-toolbar{grid-template-columns:1fr 1fr}.sp-inv-toolbar input{grid-column:1/-1}.sp-inv-summary{grid-template-columns:1fr 1fr}.sp-inv-grid,.sp-inv-status-grid{grid-template-columns:1fr}.sp-inv-live{grid-template-columns:1fr 1fr}.sp-inv-card{padding:16px;border-radius:18px}}
  `;
  document.head.appendChild(style);

  async function load() {
    let q = sb.from('equipment').select('id,category,brand,model,quantity,daily_cost,daily_price,active,notes,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,updated_at', { count:'exact' }).order('category').order('brand',{nullsFirst:true}).order('model',{nullsFirst:true});
    if (filters.q) q = q.or(`category.ilike.%${filters.q}%,brand.ilike.%${filters.q}%,model.ilike.%${filters.q}%`);
    if (filters.category) q = q.eq('category', filters.category);
    if (filters.active !== '') q = q.eq('active', filters.active === 'true');
    const from = page * PAGE_SIZE;
    const {data,error,count} = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows = data || []; total = count || 0; render();
  }

  async function categories() {
    const {data} = await sb.from('equipment').select('category').not('category','is',null).order('category');
    return [...new Set((data||[]).map(x=>x.category).filter(Boolean))];
  }

  function render() {
    const totalQty = rows.reduce((a,e)=>a+n(e.quantity),0);
    const faultQty = rows.reduce((a,e)=>a+n(e.faulty_quantity),0);
    const maintQty = rows.reduce((a,e)=>a+n(e.maintenance_quantity),0);
    const freeQty = rows.reduce((a,e)=>a+available(e),0);
    $('#content').innerHTML = `
      <div class="page-head"><div><h1>Ekipman</h1><p class="muted">Envanter · fiziksel durumlar ayrı, Aktif/Pasif ayrı</p></div><button class="btn btn-primary" onclick="window.spInventoryModal()">+ Ekipman ekle</button></div>
      <div class="sp-inv-toolbar"><input id="spInvSearch" placeholder="Kategori, marka veya model ara…" value="${esc(filters.q)}"><select id="spInvCategory"><option value="">Tüm kategoriler</option></select><select id="spInvActive"><option value="">Aktif + Pasif</option><option value="true" ${filters.active==='true'?'selected':''}>Aktif</option><option value="false" ${filters.active==='false'?'selected':''}>Pasif</option></select><button class="btn" id="spInvRefresh">Yenile</button></div>
      <div class="sp-inv-summary"><div class="sp-inv-stat"><span>Bu sayfa toplam adet</span><b>${totalQty}</b></div><div class="sp-inv-stat"><span>Arızalı</span><b>${faultQty}</b></div><div class="sp-inv-stat"><span>Bakımda</span><b>${maintQty}</b></div><div class="sp-inv-stat"><span>Boşta</span><b>${freeQty}</b></div></div>
      <div class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Kategori</th><th>Marka / Model</th><th>Toplam</th><th>Fiziksel durum</th><th>Maliyet</th><th>Satış</th><th>Durum</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td>${esc(e.category)}</td><td><strong>${esc(e.brand||'—')}</strong><div class="muted small">${esc(e.model||'—')}</div></td><td><b>${n(e.quantity)}</b></td><td><div class="sp-inv-status"><span class="sp-inv-chip">Sağlam <strong>${available(e)}</strong></span><span class="sp-inv-chip">Arızalı <strong>${n(e.faulty_quantity)}</strong></span><span class="sp-inv-chip">Bakım <strong>${n(e.maintenance_quantity)}</strong></span><span class="sp-inv-chip">Rezerve <strong>${n(e.reserved_quantity)}</strong></span><span class="sp-inv-chip">Kullanımda <strong>${n(e.in_use_quantity)}</strong></span></div></td><td>${money(e.daily_cost)}</td><td>${money(e.daily_price)}</td><td>${e.active===false?'<span class="status cancelled">Pasif</span>':'<span class="status accepted">Aktif</span>'}</td><td><button class="btn" onclick="window.spInventoryModal('${e.id}')">Düzenle</button></td></tr>`).join('')||'<tr><td colspan="8" class="muted" style="text-align:center;padding:30px">Kayıt bulunamadı.</td></tr>'}</tbody></table></div></div>
      <div class="sp-inv-pager"><button class="btn" ${page===0?'disabled':''} id="spInvPrev">‹ Önceki</button><span>${total ? page*PAGE_SIZE+1 : 0}–${Math.min((page+1)*PAGE_SIZE,total)} / ${total}</span><button class="btn" ${(page+1)*PAGE_SIZE>=total?'disabled':''} id="spInvNext">Sonraki ›</button></div>`;
    categories().then(cs=>{const s=$('#spInvCategory');if(s){s.innerHTML='<option value="">Tüm kategoriler</option>'+cs.map(c=>`<option value="${esc(c)}" ${filters.category===c?'selected':''}>${esc(c)}</option>`).join('')}});
    $('#spInvSearch')?.addEventListener('input',()=>{filters.q=$('#spInvSearch').value.trim();page=0;clearTimeout(window.__spInvTimer);window.__spInvTimer=setTimeout(load,280)});
    $('#spInvCategory')?.addEventListener('change',()=>{filters.category=$('#spInvCategory').value;page=0;load()});
    $('#spInvActive')?.addEventListener('change',()=>{filters.active=$('#spInvActive').value;page=0;load()});
    $('#spInvRefresh')?.addEventListener('click',load);$('#spInvPrev')?.addEventListener('click',()=>{page--;load()});$('#spInvNext')?.addEventListener('click',()=>{page++;load()});
  }

  function modal(id) {
    const e = id ? rows.find(x=>x.id===id) : null;
    const s = e || {category:'',brand:'',model:'',quantity:1,daily_cost:0,daily_price:0,active:true,notes:'',faulty_quantity:0,maintenance_quantity:0,reserved_quantity:0,in_use_quantity:0};
    const input = (id,label,value,type='text') => `<label>${label}<input id="${id}" type="${type}" value="${esc(value)}" min="0" step="1"></label>`;
    document.getElementById('spInvModal')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="sp-inv-modal" id="spInvModal"><div class="sp-inv-card"><div class="sp-inv-head"><div><p class="muted small">${e?'ENVANTER DÜZENLE':'YENİ ENVANTER'}</p><h2>${e?esc([e.brand,e.model].filter(Boolean).join(' ')||e.category):'Yeni ekipman'}</h2></div><button class="sp-inv-close" onclick="window.spInventoryClose()">×</button></div><div class="sp-inv-grid"><label>Kategori *<input id="spEqCat" value="${esc(s.category)}"></label><label>Marka<input id="spEqBrand" value="${esc(s.brand||'')}"></label><label>Model<input id="spEqModel" value="${esc(s.model||'')}"></label>${input('spEqQty','Toplam adet',n(s.quantity),'number')}<label>Günlük maliyet (₺)<input id="spEqCost" type="number" min="0" value="${n(s.daily_cost)}"></label><label>Günlük satış (₺)<input id="spEqPrice" type="number" min="0" value="${n(s.daily_price)}"></label><label>Aktif / Pasif<select id="spEqActive"><option value="1" ${s.active!==false?'selected':''}>Aktif</option><option value="0" ${s.active===false?'selected':''}>Pasif</option></select></label></div><div class="sp-inv-section"><h3>Fiziksel durum adetleri</h3><div class="sp-inv-status-grid">${input('spEqFault','Arızalı',n(s.faulty_quantity),'number')}${input('spEqMaint','Bakımda',n(s.maintenance_quantity),'number')}${input('spEqReserved','Rezerve',n(s.reserved_quantity),'number')}${input('spEqUse','Kullanımda',n(s.in_use_quantity),'number')}</div><div class="sp-inv-live"><div><span>Toplam</span><b id="spEqTotalLive">${n(s.quantity)}</b></div><div><span>Durumda</span><b id="spEqStateLive">${stateTotal(s)}</b></div><div><span>Boşta / sağlam</span><b id="spEqAvailLive">${available(s)}</b></div></div></div><label style="display:block;margin-top:14px">Not<textarea id="spEqNotes" rows="3">${esc(s.notes||'')}</textarea></label><div class="sp-inv-actions"><button class="btn btn-primary" onclick="window.spInventorySave('${e?.id||''}')">Kaydet</button>${e?`<button class="btn btn-danger" onclick="window.spInventoryDelete('${e.id}')">Sil</button>`:''}<button class="btn" onclick="window.spInventoryClose()">İptal</button></div></div></div>`);
    ['spEqQty','spEqFault','spEqMaint','spEqReserved','spEqUse'].forEach(k=>$('#'+k)?.addEventListener('input',()=>{const total=n($('#spEqQty').value),states=n($('#spEqFault').value)+n($('#spEqMaint').value)+n($('#spEqReserved').value)+n($('#spEqUse').value);$('#spEqTotalLive').textContent=total;$('#spEqStateLive').textContent=states;$('#spEqAvailLive').textContent=Math.max(0,total-states)}));
  }
  window.spInventoryModal=modal;window.spInventoryClose=()=>document.getElementById('spInvModal')?.remove();
  window.spInventorySave=async(id)=>{const payload={category:$('#spEqCat').value.trim(),brand:$('#spEqBrand').value.trim()||null,model:$('#spEqModel').value.trim()||null,quantity:n($('#spEqQty').value),daily_cost:n($('#spEqCost').value),daily_price:n($('#spEqPrice').value),active:$('#spEqActive').value==='1',notes:$('#spEqNotes').value.trim()||null,faulty_quantity:n($('#spEqFault').value),maintenance_quantity:n($('#spEqMaint').value),reserved_quantity:n($('#spEqReserved').value),in_use_quantity:n($('#spEqUse').value),updated_at:new Date().toISOString()};if(!payload.category)return toast('Kategori zorunlu',false);if(payload.faulty_quantity+payload.maintenance_quantity+payload.reserved_quantity+payload.in_use_quantity>payload.quantity)return toast('Durum adetleri toplam adedi aşamaz.',false);const r=id?await sb.from('equipment').update(payload).eq('id',id):await sb.from('equipment').insert([payload]);if(r.error)return toast(r.error.message,false);toast(id?'Ekipman güncellendi.':'Ekipman eklendi.');window.spInventoryClose();await load()};
  window.spInventoryDelete=async(id)=>{if(!confirm('Bu ekipman kaydı silinsin mi?'))return;const r=await sb.from('equipment').delete().eq('id',id);if(r.error)return toast(r.error.message,false);toast('Ekipman silindi.');window.spInventoryClose();await load()};
  window.equipmentView=async()=>{page=0;await load()};
})();