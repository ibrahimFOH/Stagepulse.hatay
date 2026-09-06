/* Stagepulse Admin — notification composer + FCM dispatch */
(() => {
  'use strict';
  const EDGE = `${SUPABASE_URL}/functions/v1/send-fcm-notification`;
  const escN = s => String(s ?? '').replace(/[&<>\'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const original = window.loadView;
  window.loadView = async function(v) {
    const result = await original(v);
    if (v === 'notifications') await injectComposer();
    setTimeout(refreshAdminUi, 0);
    return result;
  };
  async function injectComposer() {
    const { data: members, error } = await sb.from('org_memberships')
      .select('user_id,role:role_id(code,name,is_admin_role,active),active')
      .eq('active',true);
    if (error) { console.error('[stagepulse-notifications]', error); return; }
    const users = (members||[]).map(x=>{
      const role=Array.isArray(x.role)?x.role[0]:x.role;
      return {user_id:x.user_id,role:role?.name||role?.code||'Üye'};
    });
    if ($('#ntSend')) return;
    const box=document.createElement('div'); box.className='panel'; box.style.marginBottom='16px';
    box.innerHTML=`<h3 style="margin-top:0">Yeni bildirim gönder</h3><p class="muted">Seçilen kullanıcıya hem uygulama içi bildirim hem de kayıtlı cihazlara push gönderilir.</p><div class="grid2"><label>Alıcılar<select id="ntRecipients" multiple size="5">${users.map(u=>`<option value="${escN(u.user_id)}">${escN(u.user_id)} · ${escN(u.role)}</option>`).join('')}</select></label><div><label>Başlık<input id="ntTitle" value="Stagepulse bildirimi" maxlength="120"></label><label>Mesaj<textarea id="ntBody" rows="4" maxlength="1000" placeholder="Bildirim metni"></textarea></label></div></div><div class="modal-actions"><button class="btn btn-primary" id="ntSend">Bildirimi gönder</button></div><p id="ntResult" class="muted"></p>`;
    $('#content')?.prepend(box);
    $('#ntSend').onclick=send;
  }
  async function send(){
    const ids=[...($('#ntRecipients')?.selectedOptions||[])].map(o=>o.value).filter(Boolean);
    const title=$('#ntTitle')?.value?.trim()||'Stagepulse bildirimi';
    const body=$('#ntBody')?.value?.trim()||'';
    const out=$('#ntResult'); if(!ids.length||!body){if(out)out.textContent='En az bir alıcı ve mesaj gerekli.';return;}
    const btn=$('#ntSend'); if(btn)btn.disabled=true;
    try{
      const {data:{session}}=await sb.auth.getSession(); if(!session?.access_token)throw new Error('Admin oturumu yok.');
      const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({user_ids:ids,title,body,url:'/portal/',kind:'admin_manual'})});
      const j=await r.json().catch(()=>({})); if(!r.ok)throw new Error(j.error||'Push gönderimi başarısız.');
      if(out)out.textContent=`Gönderildi. Push: ${j.sent||0} · Eski cihaz: ${j.stale||0}`;
      $('#ntBody').value=''; toast('Bildirim gönderildi.');
    }catch(e){if(out)out.textContent=e.message||'Bildirim gönderilemedi.';toast(e.message||'Bildirim gönderilemedi.',false)}finally{if(btn)btn.disabled=false}
  }

  const labels = new Map([
    ['pending','Bekliyor'],['Pending','Bekliyor'],['accepted','Kabul edildi'],['Accepted','Kabul edildi'],['rejected','Reddedildi'],['Rejected','Reddedildi'],
    ['cancelled','İptal edildi'],['Cancelled','İptal edildi'],['active','Aktif'],['Active','Aktif'],['inactive','Pasif'],['Inactive','Pasif'],['paid','Ödendi'],['Paid','Ödendi'],
    ['reviewing','İnceleniyor'],['Reviewing','İnceleniyor'],['preparing','Hazırlanıyor'],['Preparing','Hazırlanıyor'],['sent','Gönderildi'],['Sent','Gönderildi'],
    ['new','Yeni'],['New','Yeni'],['offer_change','Teklif değişikliği'],['offer_update','Teklif güncellendi'],['staff_deleted','Personel silindi'],['staff_updated','Personel güncellendi'],
    ['staff_permissions_updated','Personel yetkileri güncellendi'],['system','Sistem'],['Optimize','Optimize Et'],['OPTIMIZE','OPTİMİZE ET'],['Add','Ekle'],['Delete','Sil'],['Edit','Düzenle'],
    ['Save','Kaydet'],['Cancel','Vazgeç'],['Open','Aç'],['Rename','Adlandır'],['Close','Kapat'],['Details','Detay'],['Status','Durum'],['Date','Tarih'],['Description','Açıklama'],
    ['Amount','Tutar'],['Payment','Ödeme'],['Due Date','Vade'],['Role','Rol'],['Position','Pozisyon'],['Department','Departman'],['Region','Bölge'],['Permissions','Yetkiler'],['Actions','İşlem'],
    ['Owner','Sahip'],['Patron / Owner','Patron / Sahip'],['Super Admin','Süper Admin'],['Upper Admin','Üst Admin'],['Regional Manager','Bölge Sorumlusu'],['Department Manager','Departman Yöneticisi'],['Employee','Çalışan'],['Management','Yönetim'],['System','Sistem']
  ]);
  const statusClasses = {yeni:'new',new:'new',bekliyor:'new',pending:'new',incelemede:'reviewing',reviewing:'reviewing',inceleniyor:'reviewing',hazırlanıyor:'preparing',preparing:'preparing',gönderildi:'sent',sent:'sent',kabul:'accepted','kabul edildi':'accepted',accepted:'accepted',aktif:'accepted',active:'accepted',ödendi:'accepted',paid:'accepted',red:'rejected','reddedildi':'rejected',rejected:'rejected',iptal:'cancelled','iptal edildi':'cancelled',cancelled:'cancelled',pasif:'rejected',inactive:'rejected'};

  function refreshAdminUi(){ syncMenu(); const root=$('#content'); if(!root)return; translate(root); decorateStatus(root); }
  function translate(root){
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[];
    while(w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n=>{const t=(n.nodeValue||'').trim(); if(labels.has(t)) n.nodeValue=n.nodeValue.replace(t,labels.get(t));});
    $$('input[placeholder],textarea[placeholder]',root).forEach(el=>{if(labels.has(el.placeholder)) el.placeholder=labels.get(el.placeholder);});
  }
  function decorateStatus(root){
    $$('.status',root).forEach(el=>{const raw=(el.textContent||'').trim().toLowerCase();const cls=statusClasses[raw]||'';el.className=`status ${cls}`.trim();});
    $$('.admin-table tbody tr',root).forEach(tr=>{const heads=[...(tr.closest('table')?.querySelectorAll('thead th')||[])];[...tr.cells].forEach((td,i)=>{if((heads[i]?.textContent||'').trim()==='Durum'&&!td.querySelector('.status')){const raw=(td.textContent||'').trim().toLowerCase();td.innerHTML=`<span class="status ${statusClasses[raw]||''}">${labels.get(raw)||raw}</span>`;}});});
  }
  function syncMenu(){
    const hash=(location.hash||'#dashboard').slice(1).split('?')[0].toLowerCase();
    const aliases={permissions:'rbac',permission:'rbac','role-permission':'rbac','role-permissions':'rbac','company-organization':'organization','management-scope':'scope','admin-accounts':'accounts'};
    const view=aliases[hash]||hash||'dashboard';
    const textMap={'komuta merkezi':'command-center','genel bakış':'dashboard','analitik':'analytics','müşteriler':'customers','teklifler':'offers','fiyatlandırma':'pricing','gelir · gider':'settlements','işler · takvim':'calendar','ekipman':'equipment','personel':'personnel','ödemeler':'finance','bildirimler':'notifications','aktivite':'activity','medya':'media','ayarlar':'settings','yönetim kapsamım':'scope','şirket organizasyonu':'organization','rol · yetki merkezi':'rbac','yönetici hesapları':'accounts','çıkış':'logout'};
    $$('#sideNav button[data-view],#sideNav button:not([data-view])').forEach(b=>{const key=(b.dataset.view||textMap[(b.textContent||'').trim().toLowerCase()]||'').toLowerCase();b.classList.toggle('active',key===view);});
  }
  const css=document.createElement('style'); css.textContent=`.admin-body .sp-admin-crud{display:none!important}`; document.head.appendChild(css);
  setInterval(refreshAdminUi,1200);
  window.addEventListener('hashchange',()=>setTimeout(refreshAdminUi,50));
  window.addEventListener('stagepulse:admin-ready',()=>setTimeout(refreshAdminUi,100));
  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(refreshAdminUi,100));
  setTimeout(refreshAdminUi,300);
})();
