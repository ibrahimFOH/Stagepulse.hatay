(()=>{'use strict';
const SUPABASE_URL='https://itasctyjzyewcykozuex.supabase.co';
const KEY='sb_publishable_tP3CMhVAjv6FNtrkYfVEOA_dbF9m8Jb';
const API=SUPABASE_URL+'/functions/v1/license-core';
const $=id=>document.getElementById(id);
let token='',expiresAt=0,rows=[],busy=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(id,value,kind=''){const el=$(id);if(!el)return;el.textContent=value||'';el.className=kind;}
function logged(on){$('login').classList.toggle('hidden',on);$('app').classList.toggle('hidden',!on);$('logout').classList.toggle('hidden',!on);$('conn').textContent=on?'Ortak hesap bağlı':'Oturum kapalı';}
function clearSession(){token='';expiresAt=0;logged(false);}
async function authLogin(email,password){
 const response=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({email:email.trim(),password})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.access_token)throw Error(data.msg||data.message||'E-posta veya şifre doğrulanamadı.');
 token=data.access_token;expiresAt=Date.now()+Number(data.expires_in||3600)*1000;
}
async function call(action,data={}){
 if(!token||Date.now()>=expiresAt){clearSession();throw Error('Oturum sona erdi. Yeniden giriş yap.');}
 const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+token},body:JSON.stringify({action,...data})});
 const result=await response.json().catch(()=>({error:'Sunucudan geçersiz yanıt alındı.'}));
 if(response.status===401){clearSession();throw Error(result.error||'Oturum sona erdi.');}
 if(!response.ok||result.ok===false)throw Error(result.error||('HTTP '+response.status));
 return result;
}
function status(l){
 if(l.status!=='active')return 'İptal edildi';
 if(l.payment_status!=='paid')return 'Ödeme bekliyor';
 if(l.expires_at&&Date.parse(l.expires_at)<=Date.now())return 'Süresi doldu';
 return 'Aktif';
}
function isActive(l){return status(l)==='Aktif';}
function date(v){if(!v)return 'Süresiz';const d=new Date(v);return Number.isNaN(d.getTime())?'Bilinmiyor':new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium'}).format(d);}
function product(v){return ({stagepulse:'Stagepulse','ses-merkezi':'Ses Merkezi',jarvis:'JARVIS'})[v]||v;}
function filtered(){const q=$('search').value.toLocaleLowerCase('tr-TR'),f=$('filter').value;return rows.filter(l=>(f==='all'||(f==='active'?isActive(l):!isActive(l)))&&[l.customer_name,l.product_code,l.status,l.payment_status,l.id].join(' ').toLocaleLowerCase('tr-TR').includes(q));}
function render(){
 const active=rows.filter(isActive).length;
 $('total').textContent=rows.length;$('active').textContent=active;$('revoked').textContent=rows.length-active;
 const list=filtered();
 $('licenses').innerHTML=list.length?list.map(l=>{
  const on=isActive(l);
  return '<article class="license"><div class="heading"><h3>'+esc(l.customer_name)+'</h3><span class="badge '+(on?'':'off')+'">'+esc(status(l))+'</span></div><small>'+esc(product(l.product_code))+' · '+esc(l.plan_code||'standart')+'</small><div class="meta"><div><small>Bitiş</small><b>'+esc(date(l.expires_at))+'</b></div><div><small>Cihaz</small><b>'+Number(l.active_devices||0)+' / '+Number(l.max_devices||1)+'</b></div><div><small>Ödeme</small><b>'+esc(l.payment_status||'—')+'</b></div><div><small>Oluşturma</small><b>'+esc(date(l.created_at))+'</b></div></div>'+(on?'<button class="secondary" data-revoke="'+esc(l.id)+'">Lisansı iptal et</button>':'')+'</article>';
 }).join(''):'<div class="panel">Bu filtrede lisans bulunamadı.</div>';
}
async function refresh(){
 if(busy)return;busy=true;
 try{const r=await call('admin_list');rows=r.licenses||[];render();$('conn').textContent='Ortak hesap bağlı';message('msg','');}
 catch(e){message('msg',e.message,'error');$('conn').textContent='Bağlantı hatası';}
 finally{busy=false;}
}
$('loginForm').onsubmit=async e=>{
 e.preventDefault();$('loginBtn').disabled=true;message('loginMsg','Supabase hesabı doğrulanıyor…');
 try{await authLogin($('email').value,$('password').value);$('password').value='';logged(true);await refresh();}
 catch(err){clearSession();message('loginMsg',err.message,'error');}
 finally{$('loginBtn').disabled=false;}
};
$('logout').onclick=clearSession;
$('refresh').onclick=refresh;
$('search').oninput=render;
$('filter').onchange=render;
$('createForm').onsubmit=async e=>{
 e.preventDefault();$('createBtn').disabled=true;$('keyResult').classList.add('hidden');
 try{
  let expiry=null;
  if($('expiry').value){const d=new Date($('expiry').value+'T23:59:59');if(d.getTime()<=Date.now())throw Error('Bitiş tarihi gelecekte olmalı.');expiry=d.toISOString();}
  const r=await call('admin_create',{app_id:$('product').value,customer_name:$('customer').value.trim(),max_devices:Number($('devices').value),expires_at:expiry,payment_status:$('payment').value,notes:$('notes').value.trim()});
  $('keyValue').textContent=r.license_key;$('keyResult').classList.remove('hidden');$('createForm').reset();
  message('msg','Lisans oluşturuldu. Anahtarı şimdi güvenli yere kopyala.','success');await refresh();
 }catch(err){message('msg',err.message,'error');}
 finally{$('createBtn').disabled=false;}
};
$('copyKey').onclick=async()=>{try{await navigator.clipboard.writeText($('keyValue').textContent);$('copyKey').textContent='Kopyalandı ✓';}catch{message('msg','Anahtarı seçip elle kopyala.','error');}};
$('hideKey').onclick=()=>{$('keyValue').textContent='';$('keyResult').classList.add('hidden');};
$('licenses').onclick=async e=>{
 const btn=e.target.closest('[data-revoke]');if(!btn)return;
 const license=rows.find(x=>x.id===btn.dataset.revoke);if(!license||!confirm(license.customer_name+' lisansı iptal edilsin mi?'))return;
 btn.disabled=true;
 try{await call('admin_revoke',{license_id:license.id});message('msg','Lisans iptal edildi.','success');await refresh();}
 catch(err){message('msg',err.message,'error');}
 finally{btn.disabled=false;}
};
const csv=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
$('export').onclick=()=>{
 const fields=['customer_name','product_code','status','payment_status','max_devices','active_devices','expires_at','created_at','id'];
 const data=[fields.join(';'),...filtered().map(l=>fields.map(f=>csv(l[f])).join(';'))];
 const blob=new Blob(['\ufeff'+data.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='stagepulse-ortak-lisanslar.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
logged(false);
})();