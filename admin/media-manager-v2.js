/* Stagepulse Admin — resilient media manager fallback. */
(() => {
  'use strict';
  if (window.STAGEPULSE_MEDIA_MANAGER_V2) return;
  window.STAGEPULSE_MEDIA_MANAGER_V2 = true;
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const edge=()=>db()?.functions;
  async function list(){const r=await edge().invoke('admin-github-media',{body:{action:'list'}});if(r.error)throw r.error;if(r.data?.error)throw new Error(r.data.error);return r.data||{};}
  function render(items,write){
    const c=document.getElementById('content');if(!c)return;
    const rows=(items||[]).map(x=>{const isImg=/\.(jpe?g|png|webp|gif|avif)$/i.test(x.name||'');const href=x.download_url||x.html_url||'#';return `<div class="sp-media-item"><div class="sp-media-preview">${isImg?`<img src="${esc(href)}" alt="${esc(x.name)}" loading="lazy">`:'<span>FILE</span>'}</div><div class="sp-media-info"><strong>${esc(x.name)}</strong><small>${esc(x.path)} · ${Math.round((Number(x.size)||0)/1024)} KB</small></div><a class="btn sp-btn-edit" href="${esc(href)}" target="_blank" rel="noopener">Aç</a></div>`;}).join('');
    c.innerHTML=`<div class="page-head"><div><h1>Medya</h1><p class="muted">Fotoğraf, video ve PDF dosyaları</p></div><button type="button" class="btn sp-btn-primary" id="spMediaRefresh">Yenile</button></div><section class="panel"><div class="sp-media-toolbar"><strong>${items?.length||0} medya</strong><span class="muted">${write?'Yazma aktif':'Salt okunur'}</span></div><div class="sp-media-grid">${rows||'<p class="muted">Medya dosyası bulunamadı.</p>'}</div></section>`;
    document.getElementById('spMediaRefresh')?.addEventListener('click',load);
  }
  async function load(){const c=document.getElementById('content');if(c)c.innerHTML='<div class="panel"><p class="muted">Medya yükleniyor…</p></div>';try{const d=await list();render(d.items||[],!!d.write_enabled);}catch(e){if(c)c.innerHTML=`<div class="panel"><h3>Medya yöneticisi başlatılamadı</h3><p class="muted">${esc(e.message||'Bilinmeyen hata')}</p><button type="button" class="btn sp-btn-primary" id="spMediaRetry">Yeniden dene</button></div>`;document.getElementById('spMediaRetry')?.addEventListener('click',load);}}
  const original=window.mediaView;
  window.mediaView=async function(){return load();};
  const style=document.createElement('style');style.textContent=`.admin-body .sp-media-toolbar{display:flex;justify-content:space-between;gap:12px;margin-bottom:14px}.admin-body .sp-media-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.admin-body .sp-media-item{display:grid;grid-template-columns:72px minmax(0,1fr);gap:10px;align-items:center;padding:10px;border:1px solid #292f3b;border-radius:12px;background:#10141a}.admin-body .sp-media-preview{width:72px;height:60px;border-radius:8px;background:#0a0d11;display:grid;place-items:center;overflow:hidden;color:#727c8d;font-size:10px;font-weight:800}.admin-body .sp-media-preview img{width:100%;height:100%;object-fit:cover}.admin-body .sp-media-info{min-width:0}.admin-body .sp-media-info strong,.admin-body .sp-media-info small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.admin-body .sp-media-info small{margin-top:4px;color:#737d8e;font-size:10px}.admin-body .sp-media-item>a{grid-column:1/-1;width:100%;text-align:center;text-decoration:none}@media(max-width:760px){.admin-body .sp-media-grid{grid-template-columns:1fr}.admin-body .sp-media-item{grid-template-columns:64px minmax(0,1fr) auto}.admin-body .sp-media-preview{width:64px;height:54px}.admin-body .sp-media-item>a{grid-column:3;grid-row:1;width:auto}.admin-body .sp-media-toolbar{font-size:12px}}`;document.head.appendChild(style);
  window.addEventListener('hashchange',()=>{if((location.hash||'').slice(1).split('?')[0].toLowerCase()==='media')setTimeout(load,80);});
})();