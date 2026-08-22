/* Stagepulse Admin — notification composer + FCM dispatch */
(() => {
  const EDGE = `${SUPABASE_URL}/functions/v1/send-fcm-notification`;
  const escN = s => String(s ?? '').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const original = window.loadView;
  window.loadView = async function(v) {
    const result = await original(v);
    if (v === 'notifications') await injectComposer();
    return result;
  };
  async function injectComposer() {
    const { data: admins } = await sb.from('admin_profiles').select('user_id,username,display_name').eq('active',true);
    const { data: staff } = await sb.from('staff_profiles').select('user_id,username,display_name,role').eq('active',true).order('display_name');
    const users = [...(admins||[]).map(x=>({...x,role:'admin'})), ...(staff||[])];
    const box=document.createElement('div'); box.className='panel'; box.style.marginBottom='16px';
    box.innerHTML=`<h3 style="margin-top:0">Yeni bildirim gönder</h3><p class="muted">Seçilen kullanıcıya hem uygulama içi bildirim hem de kayıtlı cihazlara push gönderilir.</p><div class="grid2"><label>Alıcılar<select id="ntRecipients" multiple size="5">${users.map(u=>`<option value="${escN(u.user_id)}">${escN(u.display_name||u.username)} · ${escN(u.role)}</option>`).join('')}</select></label><div><label>Başlık<input id="ntTitle" value="Stagepulse bildirimi" maxlength="120"></label><label>Mesaj<textarea id="ntBody" rows="4" maxlength="1000" placeholder="Bildirim metni"></textarea></label></div></div><div class="modal-actions"><button class="btn btn-primary" id="ntSend">Bildirimi gönder</button></div><p id="ntResult" class="muted"></p>`;
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
      const rows=ids.map(recipient_user_id=>({recipient_user_id,kind:'admin_manual',title,body}));
      const {error:ie}=await sb.from('notifications').insert(rows); if(ie)throw ie;
      const {data:{session}}=await sb.auth.getSession(); if(!session?.access_token)throw new Error('Admin oturumu yok.');
      const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({user_ids:ids,title,body,url:'/portal/',kind:'admin_manual'})});
      const j=await r.json().catch(()=>({})); if(!r.ok)throw new Error(j.error||'Push gönderimi başarısız.');
      if(out)out.textContent=`Gönderildi. Uygulama içi: ${ids.length} · Push: ${j.sent||0} · Eski cihaz: ${j.stale||0}`;
      $('#ntBody').value=''; toast('Bildirim gönderildi.');
    }catch(e){if(out)out.textContent=e.message||'Bildirim gönderilemedi.';toast(e.message||'Bildirim gönderilemedi.',false)}finally{if(btn)btn.disabled=false}
  }
})();
