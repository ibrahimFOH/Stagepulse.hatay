(() => {
  'use strict';
  if (window.STAGEPULSE_PDF_EDITOR) return;
  window.STAGEPULSE_PDF_EDITOR = true;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.__stagepulseAdminClient||window.sb||window.supabaseClient||null;
  const runtime=()=>window.STAGEPULSE_RUNTIME||{};
  const money=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const fmtDate=v=>v?String(v).slice(0,10):'—';
  const labels={brand:'Başlık',customer:'Müşteri',scope:'Yapılacak iş / kapsam',items:'Ekipman & malzeme listesi',totals:'Ücret',attachments:'Sahne / Sistem Görseli',footer:'Alt bilgi'};
  let current=null;

  function injectStyle(){
    if(q('#sp-pdf-editor-style'))return;
    const s=document.createElement('style');s.id='sp-pdf-editor-style';
    s.textContent=`
      .sp-pdf-editor{display:grid;grid-template-columns:minmax(300px,460px) minmax(420px,1fr);gap:18px;align-items:start}
      .sp-pdf-panel{background:#11151b;border:1px solid #2b3039;border-radius:16px;padding:16px;color:#f4f4f4}
      .sp-pdf-panel h2,.sp-pdf-panel h3{margin:0 0 12px}.sp-pdf-muted{color:#9da5b2;font-size:12px}
      .sp-pdf-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.sp-pdf-toolbar .btn{font-weight:900}
      .sp-pdf-field{display:grid;gap:6px;margin:10px 0}.sp-pdf-field label,.sp-pdf-check{font-size:12px;font-weight:800;color:#b7bec9}
      .sp-pdf-field input,.sp-pdf-field textarea,.sp-pdf-field select{width:100%;box-sizing:border-box;background:#0c0f14;color:#fff;border:1px solid #343a45;border-radius:9px;padding:10px}
      .sp-pdf-field textarea{min-height:90px;resize:vertical}.sp-pdf-check{display:flex;align-items:center;gap:8px;margin:8px 0}.sp-pdf-check input{accent-color:#ffb000}
      .sp-pdf-sections{display:grid;gap:7px;margin-top:8px}.sp-pdf-section-row,.sp-pdf-attachment{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:10px;border:1px solid #2b3039;border-radius:10px;background:#0c0f14}
      .sp-pdf-section-actions{display:flex;gap:4px}.sp-pdf-section-actions button{min-width:30px;padding:6px}.sp-pdf-attachment{grid-template-columns:1fr}.sp-pdf-attachment-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.sp-pdf-attachment-grid{display:grid;grid-template-columns:1fr 150px;gap:8px}.sp-pdf-attachment-grid input,.sp-pdf-attachment-grid select{width:100%;box-sizing:border-box;padding:8px;background:#0c0f14;color:#fff;border:1px solid #343a45;border-radius:8px}
      .sp-pdf-preview-wrap{background:#0a0c10;border-radius:14px;padding:14px;overflow:auto;min-height:720px}.sp-pdf-page{width:min(100%,595px);min-height:842px;background:#fff;color:#171717;margin:0 auto 16px;padding:48px;box-sizing:border-box;box-shadow:0 8px 32px rgba(0,0,0,.28);font-family:Arial,sans-serif}.sp-pdf-page h1{margin:0;color:#e39a00;font-size:27px}.sp-pdf-page h2{font-size:15px;margin:22px 0 10px}.sp-pdf-page h3{font-size:13px;margin:14px 0 8px}.sp-pdf-page p{font-size:10px;margin:5px 0;line-height:1.45}.sp-pdf-box{border:1px solid #d2d2d2;background:#fafafa;padding:10px;margin:7px 0 13px}.sp-pdf-table{width:100%;border-collapse:collapse;font-size:9px}.sp-pdf-table th,.sp-pdf-table td{border-bottom:1px solid #ddd;padding:7px 4px;text-align:left}.sp-pdf-table th:nth-child(n+3),.sp-pdf-table td:nth-child(n+3){text-align:right}.sp-pdf-total{font-size:18px;font-weight:900;color:#e39a00;margin-top:14px}.sp-pdf-attach-card{border:1px dashed #aaa;padding:12px;margin-top:10px}.sp-pdf-upload{display:grid;grid-template-columns:1fr 140px;gap:8px;align-items:end}.sp-pdf-upload input,.sp-pdf-upload select{width:100%;box-sizing:border-box;padding:9px;background:#0c0f14;color:#fff;border:1px solid #343a45;border-radius:8px}
      .sp-pdf-empty{padding:18px;border:1px dashed #343a45;border-radius:10px;color:#9da5b2;text-align:center}.sp-pdf-status{margin-top:8px;font-size:12px}.sp-pdf-status.ok{color:#86efac}.sp-pdf-status.err{color:#ff8c9f}
      @media(max-width:1050px){.sp-pdf-editor{grid-template-columns:1fr}.sp-pdf-preview-wrap{min-height:0}.sp-pdf-page{width:100%;padding:32px}}
      @media(max-width:620px){.sp-pdf-attachment-grid,.sp-pdf-upload{grid-template-columns:1fr}.sp-pdf-page{padding:24px;min-height:0}}
    `;
    document.head.appendChild(s);
  }

  async function listOffers(){
    const c=db();if(!c)throw Error('Supabase bağlantısı hazır değil.');
    const {data,error}=await c.from('teklifler').select('id,quote_number,name,company,event_type,event_date,location,total,status,updated_at').order('created_at',{ascending:false}).limit(250);
    if(error)throw error;return data||[];
  }

  async function loadEditor(id){
    const c=db();if(!c)throw Error('Supabase bağlantısı hazır değil.');
    const {data,error}=await c.rpc('admin_get_offer_pdf_editor',{p_offer_id:id});
    if(error)throw error;
    const items=(await c.from('offer_items').select('description,quantity,unit_price,total,notes').eq('offer_id',id).order('created_at')).data||[];
    current={...data,items};return current;
  }

  async function saveLayout(){
    if(!current)return;
    const c=db();const layout={
      version:1,title:q('#spPdfTitle')?.value||'Teklif',subtitle:q('#spPdfSubtitle')?.value||'',
      show_validity:q('#spPdfValidity')?.checked!==false,show_customer:q('#spPdfCustomer')?.checked!==false,
      show_scope:q('#spPdfScope')?.checked!==false,show_items:q('#spPdfItems')?.checked!==false,
      show_totals:q('#spPdfTotals')?.checked!==false,show_attachments:q('#spPdfAttachments')?.checked!==false,
      show_footer:q('#spPdfFooter')?.checked!==false,custom_note:q('#spPdfNote')?.value||'',
      attachment_heading:q('#spPdfAttachmentHeading')?.value||'Sahne / Sistem Görseli',
      sections:current.layout?.sections||['brand','customer','scope','items','totals','attachments','footer']
    };
    const {data,error}=await c.rpc('admin_save_offer_pdf_layout',{p_offer_id:current.offer.id,p_layout:layout});if(error)throw error;
    current.layout=data;setStatus('PDF düzeni kaydedildi.',true);renderPreview();
  }

  async function saveAttachment(id,row){
    const c=db();const title=q(`[data-att-title="${id}"]`)?.value||'';const kind=q(`[data-att-kind="${id}"]`)?.value||'stage_plot';const include=q(`[data-att-include="${id}"]`)?.checked!==false;const visible=q(`[data-att-visible="${id}"]`)?.checked!==false;
    const {error}=await c.rpc('admin_set_offer_attachment_pdf_options',{p_attachment_id:id,p_title:title,p_kind:kind,p_include_in_pdf:include,p_customer_visible:visible});if(error)throw error;Object.assign(row,{title,kind,include_in_pdf:include,customer_visible:visible});setStatus('Ek ayarları kaydedildi.',true);renderPreview();
  }

  async function uploadAttachment(file,kind,title){
    if(!current||!file)return;const c=db();if(!c)throw Error('Supabase bağlantısı hazır değil.');
    if(file.size>50*1024*1024)throw Error('Dosya 50 MB sınırını aşamaz.');
    const allowed=['application/pdf','image/jpeg','image/png','image/webp','image/gif','image/avif'];if(!allowed.includes(file.type))throw Error('Yalnızca PDF veya görsel dosyaları eklenebilir.');
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-');const path=`offers/${current.offer.id}/attachments/${Date.now()}-${safe}`;
    const up=await c.storage.from('offer-assets').upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;
    const {error}=await c.rpc('admin_register_offer_document_attachment',{p_offer_id:current.offer.id,p_storage_path:path,p_file_name:file.name,p_mime_type:file.type,p_size_bytes:file.size,p_kind:kind,p_title:title||file.name,p_sort_order:(current.attachments||[]).length+1,p_customer_visible:true,p_include_in_pdf:true});
    if(error){await c.storage.from('offer-assets').remove([path]);throw error;}
    setStatus('Ek dosya yüklendi.',true);await refreshCurrent();
  }

  async function deleteAttachment(id,path){
    if(!confirm('Bu eki teklif PDFinden kaldırmak istediğinize emin misiniz?'))return;const c=db();const {error}=await c.rpc('admin_delete_offer_attachment',{p_attachment_id:id});if(error)throw error;if(path)await c.storage.from('offer-assets').remove([path]);await refreshCurrent();setStatus('Ek kaldırıldı.',true);
  }

  async function refreshCurrent(){if(!current)return;current=await loadEditor(current.offer.id);renderEditor(current);}

  function setStatus(text,ok=true){const el=q('#spPdfStatus');if(el){el.textContent=text;el.className=`sp-pdf-status ${ok?'ok':'err'}`;}}

  function sectionRows(){
    const arr=Array.isArray(current.layout?.sections)?current.layout.sections.slice():['brand','customer','scope','items','totals','attachments','footer'];
    return arr.map((key,i)=>`<div class="sp-pdf-section-row"><div><strong>${esc(labels[key]||key)}</strong><div class="sp-pdf-muted">${key}</div></div><div class="sp-pdf-section-actions"><button class="btn" type="button" data-up="${i}" ${i===0?'disabled':''}>↑</button><button class="btn" type="button" data-down="${i}" ${i===arr.length-1?'disabled':''}>↓</button></div></div>`).join('');
  }

  function attachmentRows(){
    const a=current.attachments||[];if(!a.length)return '<div class="sp-pdf-empty">Henüz SPL 3D, Stage Plot veya başka bir PDF/görsel eklenmedi.</div>';
    return a.map(x=>`<div class="sp-pdf-attachment"><div class="sp-pdf-attachment-head"><strong>${esc(x.file_name)}</strong><button type="button" class="btn" data-del-att="${esc(x.id)}">Sil</button></div><div class="sp-pdf-attachment-grid"><input data-att-title="${esc(x.id)}" value="${esc(x.title||x.file_name)}" aria-label="Ek başlığı"><select data-att-kind="${esc(x.id)}"><option value="stage_plot" ${x.kind==='stage_plot'?'selected':''}>Stage Plot</option><option value="spl_3d" ${x.kind==='spl_3d'?'selected':''}>SPL 3D</option><option value="document" ${x.kind==='document'?'selected':''}>Teknik PDF</option><option value="image" ${x.kind==='image'?'selected':''}>Sistem Görseli</option></select></div><label class="sp-pdf-check"><input type="checkbox" data-att-include="${esc(x.id)}" ${x.include_in_pdf!==false?'checked':''}> PDF içine ekle</label><label class="sp-pdf-check"><input type="checkbox" data-att-visible="${esc(x.id)}" ${x.customer_visible!==false?'checked':''}> Müşteriye göster</label><button type="button" class="btn btn-primary" data-save-att="${esc(x.id)}">Eki kaydet</button></div>`).join('');
  }

  function previewSections(){
    const l=current.layout||{};const o=current.offer||{};const items=current.items||[];const att=(current.attachments||[]).filter(x=>x.include_in_pdf!==false);let html='';
    const has=s=>Array.isArray(l.sections)?l.sections.includes(s):true;
    if(has('brand'))html+=`<h1>STAGEPULSE</h1><p>${esc(l.subtitle||'Profesyonel Ses & Sahne Teknolojileri · Hatay')}</p><p><b>${esc(l.title||'Teklif')}: ${esc(o.quote_number||'')}</b>${l.show_validity&&o.valid_until?` · Geçerlilik: ${esc(fmtDate(o.valid_until))}`:''}</p>`;
    if(l.show_customer!==false&&has('customer'))html+=`<h2>Müşteri</h2><div class="sp-pdf-box"><p><b>Müşteri:</b> ${esc(o.name||'')}</p><p><b>Firma:</b> ${esc(o.company||'')}</p><p><b>Telefon:</b> ${esc(o.phone||'')}</p><p><b>E-posta:</b> ${esc(o.email||'')}</p></div>`;
    if(l.show_scope!==false&&has('scope')){const service=Array.isArray(o.services)?o.services.map(x=>typeof x==='string'?x:(x?.name||x?.label||'')).filter(Boolean).join(', '):(o.type||o.event_type||'Hizmet');html+=`<h2>Yapılacak iş / kapsam</h2><div class="sp-pdf-box"><p><b>Hizmet:</b> ${esc(service)}</p><p><b>Etkinlik türü:</b> ${esc(o.event_type||o.type||'')}</p><p><b>Lokasyon:</b> ${esc(o.location||'')}</p><p><b>Tarih:</b> ${esc(fmtDate(o.event_date))}</p>${Number(o.people)>0?`<p><b>Tahmini seyirci:</b> ${Number(o.people)} (bilgi)</p>`:''}</div>${o.message?`<p><b>Talep / yapılacak iş</b><br>${esc(o.message)}</p>`:''}${l.custom_note?`<p><b>Ek not</b><br>${esc(l.custom_note)}</p>`:''}`;}
    if(l.show_items!==false&&has('items'))html+=`<h2>Ekipman & malzeme listesi</h2>${items.length?`<table class="sp-pdf-table"><thead><tr><th>#</th><th>Malzeme / ekipman</th><th>Adet</th><th>Birim</th><th>Toplam</th></tr></thead><tbody>${items.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.description||'')}${x.notes?`<br><small>Not: ${esc(x.notes)}</small>`:''}</td><td>${Number(x.quantity)||0}</td><td>${money(x.unit_price)}</td><td>${money(x.total)}</td></tr>`).join('')}</tbody></table>`:'<div class="sp-pdf-box"><p>Bu hizmet için kayıtlı malzeme yok. Fiyatlandırma → Hizmet malzeme varsayılanları ile ekleyin.</p></div>'}`;
    if(l.show_totals!==false&&has('totals'))html+=`<h2>Ücret</h2><p>Personel: ${Number(o.crew_count)||0} × ${money(o.crew_unit_price)}</p>${Number(o.discount)>0?`<p>İndirim: -${money(o.discount)}</p>`:''}<div class="sp-pdf-total">TOPLAM ${money(o.total)}</div><p>KDV ve ek nakliye şartlara göre ayrıca belirtilebilir. Bu belge bilgilendirme amaçlı tekliftir.</p>`;
    if(l.show_attachments!==false&&has('attachments'))html+=`<h2>${esc(l.attachment_heading||'Sahne / Sistem Görseli')}</h2>${att.length?att.map(x=>`<div class="sp-pdf-attach-card"><b>${esc(x.title||x.file_name)}</b><p>${x.kind==='spl_3d'?'SPL 3D':x.kind==='stage_plot'?'Stage Plot':x.kind==='document'?'Teknik PDF':'Sistem Görseli'} · ${esc(x.file_name)}</p></div>`).join(''):'<div class="sp-pdf-box"><p>Bu teklif için eklenmiş SPL 3D / Stage Plot / sistem görseli bulunmuyor.</p></div>'}`;
    if(l.show_footer!==false&&has('footer'))html+=`<p style="margin-top:28px;color:#555">Stagepulse · stagepulse.com.tr · Teklif tarihi: ${esc(new Date().toLocaleDateString('tr-TR'))}</p>`;
    return html;
  }

  function renderPreview(){const p=q('#spPdfPreview');if(p)p.innerHTML=`<div class="sp-pdf-page">${previewSections()}</div>`;}

  function renderEditor(data){
    current=data;const l=data.layout||{};const c=q('#content');if(!c)return;
    c.innerHTML=`<div class="page-head"><div><h1>PDF Teklif Tasarım</h1><p class="muted">Teklif çıktısını uygulama içinde düzenleyin. SPL 3D ve Stage Plot dosyaları gerektiğinde doğrudan PDF'e eklenir.</p></div></div>
      <div class="sp-pdf-editor">
        <section class="sp-pdf-panel"><h2>Teklif</h2><div class="sp-pdf-field"><label>Teklif seç</label><select id="spPdfOfferSelect"><option value="${esc(data.offer.id)}">${esc(data.offer.quote_number||data.offer.id)} · ${esc(data.offer.name||data.offer.company||'Müşteri')}</option></select></div>
          <div class="sp-pdf-field"><label>Başlık</label><input id="spPdfTitle" value="${esc(l.title||'Teklif')}"></div><div class="sp-pdf-field"><label>Alt başlık</label><input id="spPdfSubtitle" value="${esc(l.subtitle||'Profesyonel Ses & Sahne Teknolojileri · Hatay')}"></div>
          <label class="sp-pdf-check"><input id="spPdfValidity" type="checkbox" ${l.show_validity!==false?'checked':''}> Geçerlilik tarihini göster</label><label class="sp-pdf-check"><input id="spPdfCustomer" type="checkbox" ${l.show_customer!==false?'checked':''}> Müşteri bölümünü göster</label><label class="sp-pdf-check"><input id="spPdfScope" type="checkbox" ${l.show_scope!==false?'checked':''}> Yapılacak iş / kapsamı göster</label><label class="sp-pdf-check"><input id="spPdfItems" type="checkbox" ${l.show_items!==false?'checked':''}> Ekipman & malzeme listesini göster</label><label class="sp-pdf-check"><input id="spPdfTotals" type="checkbox" ${l.show_totals!==false?'checked':''}> Ücret bölümünü göster</label><label class="sp-pdf-check"><input id="spPdfAttachments" type="checkbox" ${l.show_attachments!==false?'checked':''}> SPL 3D / Stage Plot bölümünü göster</label><label class="sp-pdf-check"><input id="spPdfFooter" type="checkbox" ${l.show_footer!==false?'checked':''}> Alt bilgiyi göster</label>
          <div class="sp-pdf-field"><label>Sahne / sistem ek başlığı</label><input id="spPdfAttachmentHeading" value="${esc(l.attachment_heading||'Sahne / Sistem Görseli')}"></div><div class="sp-pdf-field"><label>Ek not</label><textarea id="spPdfNote">${esc(l.custom_note||'')}</textarea></div>
          <h3>Bölüm sırası</h3><div class="sp-pdf-sections">${sectionRows()}</div><div class="sp-pdf-toolbar"><button type="button" class="btn btn-primary" id="spPdfSave">Düzeni kaydet</button><button type="button" class="btn" id="spPdfGenerate">PDF oluştur</button><button type="button" class="btn" id="spPdfOpen">Mevcut PDF</button></div><div id="spPdfStatus" class="sp-pdf-status"></div>
          <h3>SPL 3D / Stage Plot / PDF ekle</h3><div class="sp-pdf-upload"><div class="sp-pdf-field"><label>Dosya</label><input id="spPdfUpload" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif"></div><div class="sp-pdf-field"><label>Tür</label><select id="spPdfUploadKind"><option value="stage_plot">Stage Plot</option><option value="spl_3d">SPL 3D</option><option value="document">Teknik PDF</option><option value="image">Sistem Görseli</option></select></div></div><div class="sp-pdf-toolbar"><button type="button" class="btn btn-primary" id="spPdfUploadBtn">PDF'e ekle</button></div>
          <h3>Ekler</h3><div class="sp-pdf-sections" id="spPdfAttachmentsList">${attachmentRows()}</div>
        </section><section class="sp-pdf-panel"><h2>Canlı önizleme</h2><p class="sp-pdf-muted">Önizleme A4 düzenini temsil eder. Nihai çıktı sunucu tarafında aynı düzen verisiyle üretilir.</p><div class="sp-pdf-preview-wrap" id="spPdfPreview"></div></section>
      </div>`;
    const offerSelect=q('#spPdfOfferSelect');
    listOffers().then(list=>{offerSelect.innerHTML=list.map(x=>`<option value="${esc(x.id)}" ${x.id===data.offer.id?'selected':''}>${esc(x.quote_number||x.id)} · ${esc(x.name||x.company||'Müşteri')} · ${money(x.total)}</option>`).join('');}).catch(()=>{});
    offerSelect.onchange=async()=>{try{await loadEditor(offerSelect.value);renderEditor(current);}catch(e){setStatus(e.message||'Teklif yüklenemedi.',false)}};
    q('#spPdfSave').onclick=()=>saveLayout().catch(e=>setStatus(e.message||'Kaydetme başarısız.',false));
    q('#spPdfGenerate').onclick=()=>generatePdf().catch(e=>setStatus(e.message||'PDF oluşturulamadı.',false));
    q('#spPdfOpen').onclick=()=>openCurrentPdf().catch(e=>setStatus(e.message||'PDF açılamadı.',false));
    q('#spPdfUploadBtn').onclick=async()=>{const file=q('#spPdfUpload')?.files?.[0];if(!file)return setStatus('Önce dosya seçin.',false);try{await saveLayout();await uploadAttachment(file,q('#spPdfUploadKind').value,file.name);q('#spPdfUpload').value='';}catch(e){setStatus(e.message||'Dosya yüklenemedi.',false)}};
    qa('[data-up]').forEach(b=>b.onclick=()=>moveSection(Number(b.dataset.up),-1));qa('[data-down]').forEach(b=>b.onclick=()=>moveSection(Number(b.dataset.down),1));
    qa('[data-save-att]').forEach(b=>b.onclick=()=>saveAttachment(b.dataset.saveAtt,current.attachments.find(x=>x.id===b.dataset.saveAtt)).catch(e=>setStatus(e.message||'Ek kaydedilemedi.',false)));
    qa('[data-del-att]').forEach(b=>b.onclick=()=>{const x=current.attachments.find(a=>a.id===b.dataset.delAtt);deleteAttachment(x.id,x.storage_path).catch(e=>setStatus(e.message||'Ek silinemedi.',false));});
    qa('#spPdfTitle,#spPdfSubtitle,#spPdfValidity,#spPdfCustomer,#spPdfScope,#spPdfItems,#spPdfTotals,#spPdfAttachments,#spPdfFooter,#spPdfAttachmentHeading,#spPdfNote').forEach(el=>el.addEventListener('input',()=>renderPreview()));
    renderPreview();
  }

  function moveSection(index,delta){const a=current.layout?.sections?.slice()||['brand','customer','scope','items','totals','attachments','footer'];const j=index+delta;if(j<0||j>=a.length)return;[a[index],a[j]]=[a[j],a[index]];current.layout={...(current.layout||{}),sections:a};renderEditor(current);}

  async function generatePdf(){
    await saveLayout();const c=db();const {data:{session}}=await c.auth.getSession();if(!session?.access_token)throw Error('Yönetici oturumu bulunamadı.');
    const base=(runtime().supabaseUrl||'').replace(/\/$/,'');const res=await fetch(`${base}/functions/v1/offer-pdf`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json','apikey':runtime().supabasePublishableKey||runtime().supabaseAnonKey||''},body:JSON.stringify({offer_id:current.offer.id})});const body=await res.json().catch(()=>({}));if(!res.ok||!body.ok)throw Error(body.error||'PDF oluşturulamadı.');await refreshCurrent();setStatus(`PDF oluşturuldu · sürüm ${body.version_no}`,true);openCurrentPdf().catch(()=>{});
  }

  async function openCurrentPdf(){const path=current.offer.pdf_storage_path;if(!path)throw Error('Bu teklif için oluşturulmuş PDF yok.');const c=db();const {data,error}=await c.storage.from('offer-pdfs').createSignedUrl(path,600);if(error||!data?.signedUrl)throw error||Error('PDF bağlantısı alınamadı.');window.open(data.signedUrl,'_blank','noopener');}

  async function renderView(){injectStyle();const c=q('#content');if(!c)return;c.innerHTML='<div class="panel"><p>PDF düzenleyici yükleniyor…</p></div>';try{const offers=await listOffers();if(!offers.length){c.innerHTML='<div class="panel"><h2>PDF Teklif Tasarım</h2><p class="muted">Henüz teklif bulunmuyor.</p></div>';return}const id=new URLSearchParams(location.search).get('offer')||offers[0].id;await loadEditor(id);renderEditor(current);}catch(e){c.innerHTML=`<div class="panel"><h2>PDF düzenleyici açılamadı</h2><p class="muted">${esc(e.message||'Bilinmeyen hata')}</p></div>`;}}

  function injectNav(){const nav=q('#sideNav');if(!nav||q('[data-view="pdf-editor"]',nav))return;const offers=q('[data-view="offers"]',nav);const b=document.createElement('button');b.type='button';b.dataset.view='pdf-editor';b.textContent='PDF Tasarım';if(offers)offers.insertAdjacentElement('afterend',b);else nav.appendChild(b);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();qa('#sideNav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderView();},{capture:true});}

  function boot(){injectNav();window.addEventListener('stagepulse:admin-ready',injectNav);window.addEventListener('stagepulse:admin-view-rendered',()=>{injectNav();if((location.hash||'').includes('pdf-editor'))renderView();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
