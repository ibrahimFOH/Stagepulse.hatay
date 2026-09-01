/* Stagepulse Personel — complete CRUD controls
 * Canonical permissions are authoritative. Delete actions are soft-delete.
 */
(() => {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const can = key => typeof window.can === 'function' ? window.can(key) : window.staffUser?.permissions?.[key] === true;
  const toast = msg => typeof window.toast === 'function' ? window.toast(msg, false) : alert(msg);
  const ok = msg => typeof window.toast === 'function' ? window.toast(msg, true) : alert(msg);
  const input = (id,label,type='text',value='') => `<label>${label}<input id="${id}" type="${type}" value="${esc(value)}"></label>`;
  const panel = (title, fields, button) => `<div class="panel staff-crud-panel sp-crud-v2"><div class="panel-head"><h3>${title}</h3></div><form>${fields.join('')}<button class="btn btn-primary" type="submit">${button}</button></form></div>`;
  const mount = html => { const c=document.querySelector('#content'); if(!c)return null; const x=document.createElement('div'); x.innerHTML=html; x.dataset.spCrudV2='1'; c.prepend(x); return x; };
  const getRows = view => Array.isArray(view) ? view : [];

  async function customersCrud(){
    if(!can('customers.update') && !can('customers.delete')) return;
    const {data,error}=await sb.from('customers_staff').select('id,name,company,phone,email,last_contact_at,created_at').order('created_at',{ascending:false});
    if(error){ toast(error.message); return; }
    const rows=getRows(data);
    if(can('customers.update')){
      const box=mount(panel('Müşteri düzenle', [`<label>Müşteri<select id="spCEdit">${rows.map(x=>`<option value="${x.id}">${esc(x.name||'')}${x.company?' · '+esc(x.company):''}</option>`).join('')}</select></label>`, input('spCName','Ad / müşteri'),input('spCCompany','Firma'),input('spCPhone','Telefon'),input('spCEmail','E-posta','email'),input('spCNotes','Not')], 'Müşteriyi kaydet'));
      const sel=box?.querySelector('#spCEdit');
      const fill=()=>{const x=rows.find(r=>r.id===sel?.value);if(!x)return;box.querySelector('#spCName').value=x.name||'';box.querySelector('#spCCompany').value=x.company||'';box.querySelector('#spCPhone').value=x.phone||'';box.querySelector('#spCEmail').value=x.email||'';};
      sel?.addEventListener('change',fill); fill();
      box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const {error}=await sb.rpc('staff_update_customer',{p_id:sel.value,p_name:box.querySelector('#spCName').value.trim(),p_company:box.querySelector('#spCCompany').value.trim()||null,p_phone:box.querySelector('#spCPhone').value.trim()||null,p_email:box.querySelector('#spCEmail').value.trim()||null,p_notes:box.querySelector('#spCNotes').value.trim()||null});if(error)return toast(error.message);ok('Müşteri güncellendi.');await window.loadView('customers');});
    }
    if(can('customers.delete')){
      const box=mount(panel('Müşteri sil', [`<label>Müşteri<select id="spCDel">${rows.map(x=>`<option value="${x.id}">${esc(x.name||'')}${x.company?' · '+esc(x.company):''}</option>`).join('')}</select></label>`], 'Müşteriyi sil'));
      box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Seçilen müşteri silinsin mi?'))return;const {error}=await sb.rpc('staff_delete_customer',{p_id:box.querySelector('#spCDel').value});if(error)return toast(error.message);ok('Müşteri silindi.');await window.loadView('customers');});
    }
  }

  async function offersDelete(){
    if(!can('offers.delete')) return;
    const {data,error}=await sb.from('offers_staff').select('id,quote_number,name,status').order('created_at',{ascending:false});
    if(error){toast(error.message);return;}
    const rows=getRows(data);
    const box=mount(panel('Teklif sil', [`<label>Teklif<select id="spODel">${rows.map(x=>`<option value="${x.id}">${esc(x.quote_number||x.id)} · ${esc(x.name||'')} · ${esc(x.status||'')}</option>`).join('')}</select></label>`], 'Teklifi sil'));
    box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Seçilen teklif arşivlensin mi?'))return;const {error}=await sb.rpc('staff_delete_offer',{p_id:box.querySelector('#spODel').value});if(error)return toast(error.message);ok('Teklif arşivlendi.');await window.loadView('offers');});
  }

  async function equipmentCrud(){
    if(!can('equipment.update') && !can('equipment.delete')) return;
    const {data,error}=await sb.from('equipment_staff').select('id,category,brand,model,quantity,active,notes,created_at').order('category');
    if(error){toast(error.message);return;}
    const rows=getRows(data);
    if(can('equipment.update')){
      const box=mount(panel('Ekipman düzenle', [`<label>Ekipman<select id="spEEdit">${rows.map(x=>`<option value="${x.id}">${esc(x.category||'')} · ${esc(x.brand||'')} ${esc(x.model||'')}</option>`).join('')}</select></label>`,input('spECat','Kategori'),input('spEBrand','Marka'),input('spEModel','Model'),input('spEQty','Adet','number'),input('spENotes','Not')], 'Ekipmanı kaydet'));
      const sel=box?.querySelector('#spEEdit');const fill=()=>{const x=rows.find(r=>r.id===sel?.value);if(!x)return;box.querySelector('#spECat').value=x.category||'';box.querySelector('#spEBrand').value=x.brand||'';box.querySelector('#spEModel').value=x.model||'';box.querySelector('#spEQty').value=x.quantity??0;box.querySelector('#spENotes').value=x.notes||'';};sel?.addEventListener('change',fill);fill();
      box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();const {error}=await sb.rpc('staff_upsert_equipment',{p_id:sel.value,p_category:box.querySelector('#spECat').value.trim(),p_brand:box.querySelector('#spEBrand').value.trim()||null,p_model:box.querySelector('#spEModel').value.trim()||null,p_quantity:Number(box.querySelector('#spEQty').value)||0,p_notes:box.querySelector('#spENotes').value.trim()||null});if(error)return toast(error.message);ok('Ekipman güncellendi.');await window.loadView('equipment');});
    }
    if(can('equipment.delete')){
      const box=mount(panel('Ekipman sil', [`<label>Ekipman<select id="spEDel">${rows.map(x=>`<option value="${x.id}">${esc(x.category||'')} · ${esc(x.brand||'')} ${esc(x.model||'')}</option>`).join('')}</select></label>`], 'Ekipmanı sil'));
      box?.querySelector('form')?.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('Seçilen ekipman pasifleştirilsin mi?'))return;const {error}=await sb.rpc('staff_delete_equipment',{p_id:box.querySelector('#spEDel').value});if(error)return toast(error.message);ok('Ekipman pasifleştirildi.');await window.loadView('equipment');});
    }
  }

  const oldOffers=window.offersView, oldCustomers=window.customersView, oldEquipment=window.equipmentView;
  if(oldOffers) window.offersView=async function(){const r=await oldOffers.apply(this,arguments);await offersDelete();return r;};
  if(oldCustomers) window.customersView=async function(){const r=await oldCustomers.apply(this,arguments);await customersCrud();return r;};
  if(oldEquipment) window.equipmentView=async function(){const r=await oldEquipment.apply(this,arguments);await equipmentCrud();return r;};
})();
