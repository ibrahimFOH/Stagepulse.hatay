/* Stagepulse — complete organization permission matrix */
(function(){
  'use strict';
  if(window.STAGEPULSE_ORG_PERMISSIONS_V2)return;
  window.STAGEPULSE_ORG_PERMISSIONS_V2=true;
  var api=function(){return window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;};
  var host=null, catalog=null, members=[];
  var esc=function(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[c];});};
  var call=async function(action,body){var c=api();if(!c)throw new Error('Yönetim bağlantısı hazır değil.');var r=await c.functions.invoke('org-admin-control',{body:Object.assign({action:action},body||{})});if(r.error)throw r.error;if(r.data&&r.data.error)throw new Error(r.data.error);return r.data||{};};
  var selected=function(){return document.getElementById('spOrgPermMember')?.value||'';};
  var selectedMember=function(){return members.find(function(m){return m.user_id===selected();})||null;};
  var render=function(){
    if(!host||!catalog)return;
    var m=selectedMember();
    var groups={};
    (catalog.capabilities||[]).forEach(function(x){(groups[x.category||'Diğer']||(groups[x.category||'Diğer']=[])).push(x);});
    var enabled=new Set((m?.capabilities||[]).map(function(x){return x.key||x.capability_key;}));
    host.innerHTML='<div class="sp-org-perm-head"><div><h3>Yetki Merkezi</h3><p>Tüm aktif sistem yetkileri; kullanıcı bazında anlık olarak açılıp kapatılabilir.</p></div><label>Personel / yönetici<select id="spOrgPermMember">'+members.filter(function(x){return x.user_id;}).map(function(x){var p=x.profile||{};return '<option value="'+esc(x.user_id)+'" '+(m&&m.user_id===x.user_id?'selected':'')+'>'+esc(p.display_name||p.username||p.email||x.user_id)+'</option>';}).join('')+'</select></label></div>'+
      '<div class="sp-perm-summary"><strong>'+(m?esc((m.profile||{}).display_name||(m.profile||{}).username||(m.profile||{}).email||'Seçili hesap'):'Hesap seçin')+'</strong><span id="spPermCount">'+enabled.size+' / '+(catalog.capabilities||[]).length+' yetki açık</span></div>'+
      '<div class="sp-perm-actions"><button type="button" class="btn sp-btn-primary" id="spPermAll">Tümünü Aç</button><button type="button" class="btn sp-btn-edit" id="spPermReadOnly">Sadece Görüntüleme</button><button type="button" class="btn sp-btn-danger" id="spPermNone">Tümünü Kapat</button></div>'+
      '<div class="sp-perm-groups">'+Object.keys(groups).sort().map(function(cat){return '<section class="sp-perm-group"><div class="sp-perm-group-head"><h4>'+esc(cat)+'</h4><span>'+groups[cat].length+' yetki</span></div>'+groups[cat].map(function(x){var on=enabled.has(x.key);return '<label class="sp-perm-item '+(on?'is-on':'')+'"><input type="checkbox" data-perm-key="'+esc(x.key)+'" '+(on?'checked':'')+'><span><b>'+esc(x.name)+'</b><small>'+esc(x.description||x.key)+'</small><code>'+esc(x.key)+'</code></span></label>';}).join('')+'</section>';}).join('')+'</div>';
    var sel=document.getElementById('spOrgPermMember');if(sel)sel.onchange=function(){render();};
    host.querySelectorAll('[data-perm-key]').forEach(function(i){i.addEventListener('change',function(){setPerm(i.dataset.permKey,i.checked,i);});});
    document.getElementById('spPermAll').onclick=function(){bulk(true);};
    document.getElementById('spPermNone').onclick=function(){bulk(false);};
    document.getElementById('spPermReadOnly').onclick=function(){bulkReadOnly();};
  };
  var updateCount=function(){var n=host?.querySelectorAll('[data-perm-key]:checked').length||0;var t=host?.querySelectorAll('[data-perm-key]').length||0;var e=document.getElementById('spPermCount');if(e)e.textContent=n+' / '+t+' yetki açık';};
  var setPerm=async function(key,on,input){var uid=selected();if(!uid)return;if(input)input.disabled=true;try{await call('set_capability',{user_id:uid,capability_key:key,enabled:on});var m=selectedMember();if(m){m.capabilities=m.capabilities||[];if(on&&!m.capabilities.some(function(x){return (x.key||x.capability_key)===key;}))m.capabilities.push((catalog.capabilities||[]).find(function(x){return x.key===key;})||{key:key});if(!on)m.capabilities=m.capabilities.filter(function(x){return (x.key||x.capability_key)!==key;});}input?.closest('.sp-perm-item')?.classList.toggle('is-on',on);updateCount();window.toast?.('Yetki güncellendi.',true);}catch(e){if(input)input.checked=!on;window.toast?.(e.message||'Yetki güncellenemedi.',false);}finally{if(input)input.disabled=false;}};
  var bulk=async function(on){var boxes=[].slice.call(host.querySelectorAll('[data-perm-key]'));if(!selected()||!boxes.length)return;for(var i=0;i<boxes.length;i++){if(boxes[i].checked!==on)await setPerm(boxes[i].dataset.permKey,on,boxes[i]);}};
  var bulkReadOnly=async function(){var boxes=[].slice.call(host.querySelectorAll('[data-perm-key]'));for(var i=0;i<boxes.length;i++){var key=boxes[i].dataset.permKey;var read=/\.view$|\.export$|\.preview$|\.visibility$|\.pdf\.download$|\.pdf\.preview$/.test(key);if(boxes[i].checked!==read)await setPerm(key,read,boxes[i]);}};
  var load=async function(){
    try{var ctx=await call('my_context');if(!ctx.owner){return inject('<div class="sp-org-perm-denied"><strong>Yetki Merkezi</strong><span>Bu alan yalnızca Patron hesabına açıktır.</span></div>');}
      catalog=await call('catalog');var data=await call('members');members=data.members||[];inject();render();
    }catch(e){inject('<div class="sp-org-perm-error">Yetki merkezi yüklenemedi: '+esc(e.message||'Bilinmeyen hata')+'</div>');}
  };
  var inject=function(html){var content=document.getElementById('content');if(!content)return;var existing=document.getElementById('spOrgPermissionsV2');if(existing)existing.remove();host=document.createElement('section');host.id='spOrgPermissionsV2';host.className='panel sp-org-permissions-v2';host.innerHTML=html||'';content.insertBefore(host,content.firstElementChild||null);};
  var maybe=function(){var h=(location.hash||'').split('?')[0].replace('#','').toLowerCase();if(h!=='organization')return;if(document.getElementById('spOrgPermissionsV2'))return;setTimeout(load,250);};
  window.addEventListener('hashchange',maybe);window.addEventListener('stagepulse-organization-open',maybe);document.addEventListener('DOMContentLoaded',maybe);setTimeout(maybe,1400);
})();
