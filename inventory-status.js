/* Stagepulse inventory v3 — scalable admin/staff inventory UI. */
(() => {
  const boot = () => {
    const client = (typeof sb !== 'undefined') ? sb : null;
    if (!window.supabase || !client) return;
    const $ = (s) => document.querySelector(s);
    const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
    const num = v => Math.max(0, Number.parseInt(v, 10) || 0);
    const isAdmin = location.pathname.startsWith('/admin');
    const canUpdate = () => isAdmin || (typeof can === 'function' && can('equipment.update'));
    const notify = (msg, ok=true) => typeof toast === 'function' ? toast(msg, ok) : console.log(msg);
    const label = e => [e.category, e.brand, e.model].filter(Boolean).join(' · ') || 'Ekipman';
    const available = e => Math.max(0, num(e.quantity)-num(e.faulty_quantity)-num(e.maintenance_quantity)-num(e.reserved_quantity)-num(e.in_use_quantity));
    const healthy = e => Math.max(0, num(e.quantity)-num(e.faulty_quantity)-num(e.maintenance_quantity));
    const PAGE = 50;
    const state = { page: 0, search: '', active: 'all', total: 0, rows: [] };

    async function count(source) {
      const q = client.from(source).select('id', { count:'exact', head:true });
      if (state.search) q.or(`category.ilike.%${state.search}%,brand.ilike.%${state.search}%,model.ilike.%${state.search}%`);
      if (state.active !== 'all') q.eq('active', state.active === 'active');
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    }

    async function loadRows() {
      const source = isAdmin ? 'equipment' : 'equipment_staff';
      let q = client.from(source).select('id,category,brand,model,quantity,active,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity');
      if (state.search) q = q.or(`category.ilike.%${state.search}%,brand.ilike.%${state.search}%,model.ilike.%${state.search}%`);
      if (state.active !== 'all') q = q.eq('active', state.active === 'active');
      const from = state.page * PAGE;
      const { data, error, count: exactCount } = await q.order('category').range(from, from + PAGE - 1);
      if (error) throw error;
      state.total = exactCount ?? await count(source);
      state.rows = data || [];
      return state.rows;
    }

    async function loadOne(id) {
      const source = isAdmin ? 'equipment' : 'equipment_staff';
      const { data, error } = await client.from(source)
        .select('id,category,brand,model,quantity,active,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Ekipman kaydı bulunamadı. Listeyi yenileyin.');
      return data;
    }

    function pager() {
      const pages = Math.max(1, Math.ceil(state.total/PAGE));
      return `<div class="sp-pager"><button class="btn" data-sp-prev ${state.page<=0?'disabled':''}>‹ Önceki</button><span>Sayfa ${state.page+1} / ${pages} · ${state.total.toLocaleString('tr-TR')} kayıt</span><button class="btn" data-sp-next ${state.page>=pages-1?'disabled':''}>Sonraki ›</button></div>`;
    }

    async function editor(e) {
      if (!e || !canUpdate()) return;
      try { e = await loadOne(e.id); }
      catch (err) { console.error('Inventory editor load:', err); return notify(err.message || 'Ekipman yeniden okunamadı.', false); }
      document.getElementById('spInventoryModal')?.remove();
      const modal=document.createElement('div'); modal.id='spInventoryModal'; modal.className='modal';
      modal.innerHTML=`<div class="modal-card" style="max-width:720px"><button class="close" type="button" id="spInvClose">×</button><h2>Envanter durumunu düzenle</h2><p class="muted">${esc(label(e))}</p><div class="panel" style="margin-top:12px"><div class="sp-status-preview"><span>Toplam stok <b>${num(e.quantity)}</b></span><span>Sağlam <b>${healthy(e)}</b></span><span>Boşta <b>${available(e)}</b></span></div></div><div class="grid2" style="margin-top:12px"><label>Arızalı adet<input id="spInvFaulty" type="number" min="0" max="${num(e.quantity)}" value="${num(e.faulty_quantity)}"></label><label>Bakımda adet<input id="spInvMaintenance" type="number" min="0" max="${num(e.quantity)}" value="${num(e.maintenance_quantity)}"></label><label>Rezerve adet<input id="spInvReserved" type="number" min="0" max="${num(e.quantity)}" value="${num(e.reserved_quantity)}"></label><label>Kullanımda adet<input id="spInvInUse" type="number" min="0" max="${num(e.quantity)}" value="${num(e.in_use_quantity)}"></label></div><div id="spInvPreview" class="panel" style="margin-top:12px"></div><label style="display:block;margin-top:12px">Not<textarea id="spInvNote" rows="2" placeholder="Örn. 1 adet sürücü arızası"></textarea></label><div class="modal-actions"><button class="btn btn-primary" id="spInvSave">Kaydet</button><button class="btn" id="spInvCancel">İptal</button></div></div>`;
      document.body.appendChild(modal);
      const close=()=>modal.remove(); $('#spInvClose')?.addEventListener('click',close); $('#spInvCancel')?.addEventListener('click',close);
      const vals=()=>({f:num($('#spInvFaulty')?.value),m:num($('#spInvMaintenance')?.value),r:num($('#spInvReserved')?.value),u:num($('#spInvInUse')?.value)});
      const preview=()=>{const v=vals(), t=num(e.quantity), used=v.f+v.m+v.r+v.u, left=t-used; $('#spInvPreview').innerHTML=left<0?'<b style="color:#ff7b7b">Hata:</b> Durum adetleri toplam stoktan fazla olamaz.':`<div class="sp-status-preview"><span>Sağlam <b>${Math.max(0,t-v.f-v.m)}</b></span><span>Boşta <b>${left}</b></span><span>Arızalı <b>${v.f}</b></span><span>Bakımda <b>${v.m}</b></span></div>`; return left>=0;};
      ['spInvFaulty','spInvMaintenance','spInvReserved','spInvInUse'].forEach(id=>document.getElementById(id)?.addEventListener('input',preview)); preview();
      $('#spInvSave')?.addEventListener('click',async()=>{const v=vals(); if(!preview()) return notify('Durum adetleri toplam stoktan fazla olamaz.',false); let latest; try{latest=await loadOne(e.id);}catch(err){return notify(err.message||'Ekipman yeniden okunamadı.',false);} const total=num(latest.quantity); if(v.f+v.m+v.r+v.u>total)return notify(`Durum adetleri toplam stoktan (${total}) fazla olamaz.`,false); const {error}=await client.from('equipment').update({faulty_quantity:v.f,maintenance_quantity:v.m,reserved_quantity:v.r,in_use_quantity:v.u,updated_at:new Date().toISOString()}).eq('id',e.id); if(error)return notify(error.message,false); close(); notify('Envanter durumu güncellendi.'); window.dispatchEvent(new CustomEvent('stagepulse:inventory-changed')); await refresh();});
    }

    function renderStatus(rows) {
      const old=document.getElementById('spInventoryStatusPanel'); old?.remove(); const content=$('#content'); if(!content || !location.hash.endsWith('equipment')) return;
      const panel=document.createElement('div'); panel.id='spInventoryStatusPanel'; panel.className='panel sp-inventory-panel';
      panel.innerHTML=`<div class="panel-head sp-inventory-head"><div><h3>Envanter durumları</h3><p class="muted">Fiziksel durumlar toplam stoktan ayrı yönetilir. Aktif/Pasif yalnızca kayıt statüsüdür.</p></div><span class="status">Canlı senkronizasyon</span></div><div class="sp-inventory-tools"><input id="spInvSearch" type="search" value="${esc(state.search)}" placeholder="Kategori, marka veya model ara…"><select id="spInvActive"><option value="all" ${state.active==='all'?'selected':''}>Tüm kayıtlar</option><option value="active" ${state.active==='active'?'selected':''}>Aktif</option><option value="inactive" ${state.active==='inactive'?'selected':''}>Pasif</option></select></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Ekipman</th><th>Toplam</th><th>Sağlam</th><th>Arızalı</th><th>Bakımda</th><th>Boşta</th><th>Rezerve</th><th>Kullanımda</th><th>Durum</th>${canUpdate()?'<th></th>':''}</tr></thead><tbody>${rows.map(e=>`<tr><td><strong>${esc(label(e))}</strong></td><td>${num(e.quantity)}</td><td class="ok">${healthy(e)}</td><td>${num(e.faulty_quantity)}</td><td>${num(e.maintenance_quantity)}</td><td><b>${available(e)}</b></td><td>${num(e.reserved_quantity)}</td><td>${num(e.in_use_quantity)}</td><td>${e.active===false?'<span class="status cancelled">Pasif</span>':'<span class="status accepted">Aktif</span>'}</td>${canUpdate()?`<td><button class="btn" data-edit-inv="${e.id}">Düzenle</button></td>`:''}</tr>`).join('')||'<tr><td colspan="10" class="muted" style="text-align:center;padding:24px">Kayıt bulunamadı.</td></tr>'}</tbody></table></div>${pager()}<p class="muted sp-help">Sağlam = toplam − arızalı − bakımda. Boşta = toplam − arızalı − bakımda − rezerve − kullanımda.</p>`;
      content.appendChild(panel);
      panel.querySelectorAll('[data-edit-inv]').forEach(b=>b.addEventListener('click',()=>editor(rows.find(x=>x.id===b.dataset.editInv))));
      $('#spInvSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){state.search=e.target.value.trim();state.page=0;refresh();}});
      $('#spInvActive')?.addEventListener('change',e=>{state.active=e.target.value;state.page=0;refresh();});
      panel.querySelector('[data-sp-prev]')?.addEventListener('click',()=>{if(state.page>0){state.page--;refresh();}});
      panel.querySelector('[data-sp-next]')?.addEventListener('click',()=>{if(state.page<Math.ceil(state.total/PAGE)-1){state.page++;refresh();}});
    }

    async function refresh(){if(!location.hash.endsWith('equipment')) return; try{renderStatus(await loadRows());}catch(e){console.error('Inventory status:',e);}}

    if(isAdmin){
      window.equipmentView=async function(){ state.page=0; state.search=''; state.active='all'; await refresh(); };
    }

    const observer=new MutationObserver(()=>{if(location.hash.endsWith('equipment')&&!document.getElementById('spInventoryStatusPanel')) refresh();});
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',()=>setTimeout(refresh,80));
    window.addEventListener('stagepulse:inventory-changed',refresh);
    setTimeout(()=>{if(location.hash.endsWith('equipment')) refresh();},350);
  };
  window.addEventListener('load',()=>setTimeout(boot,500));
})();
