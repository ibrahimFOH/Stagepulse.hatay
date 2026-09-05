/* Stagepulse Personnel Portal — detailed analytics v2. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money = v => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(v)||0);
  const has = p => typeof window.can === 'function' && window.can(p) === true;
  const statusLabel = s => ({pending:'Bekliyor',new:'Yeni',sent:'Gönderildi',accepted:'Kabul edildi',rejected:'Reddedildi',cancelled:'İptal',expired:'Süresi doldu',draft:'Taslak',evaluating:'Değerlendiriliyor'}[String(s||'').toLowerCase()] || String(s||'Bilinmiyor'));
  const jobLabel = s => ({planned:'Planlandı',pending:'Bekliyor',accepted:'Kabul edildi',active:'Aktif',in_progress:'Devam ediyor',done:'Tamamlandı',completed:'Tamamlandı',cancelled:'İptal'}[String(s||'').toLowerCase()] || String(s||'Bilinmiyor'));
  const safeRows = async (promise, fallback=[]) => { try { const r=await promise; if(r?.error) throw r.error; return r?.data || fallback; } catch(e) { console.warn('[analytics-v2]',e); return fallback; } };
  const countBy = (rows,key='status') => rows.reduce((a,r)=>{const k=String(r?.[key]||'unknown').toLowerCase();a[k]=(a[k]||0)+1;return a;},{});
  const sumBy = (rows,key,status) => rows.filter(r=>String(r?.status||'').toLowerCase()===status).reduce((n,r)=>n+Number(r?.[key]||0),0);
  const card = (label,value,sub='',tone='') => `<div class="sp-a-card ${tone}"><span class="sp-a-label">${esc(label)}</span><strong class="sp-a-value">${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  const barRow = (label,count,total,tone='') => { const pct=total?Math.round(count/total*100):0; return `<div class="sp-a-bar-row"><div class="sp-a-bar-head"><span>${esc(label)}</span><b>${count}</b></div><div class="sp-a-bar"><i class="${tone}" style="width:${pct}%"></i></div><small>%${pct}</small></div>`; };
  const table = (headers,rows,empty='Kayıt yok.') => `<div class="table-wrap"><table class="data-table sp-a-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}" class="muted sp-a-empty">${esc(empty)}</td></tr>`}</tbody></table></div>`;

  async function analyticsViewV2() {
    if (!has('analytics.view')) { const c=document.querySelector('#content'); if(c)c.innerHTML='<div class="panel"><b>Analitik yetkiniz yok.</b><p class="muted">Bu bölüm için yöneticinizden analytics.view yetkisi gerekli.</p></div>'; return; }
    const offerAllowed=has('offers.view'), jobAllowed=has('jobs.view')||has('schedule.view'), payAllowed=has('payments.view')||has('financials.view'), equipmentAllowed=has('equipment.view'), staffAllowed=has('staff.view');
    const [offers,jobs,payments,equipment,staff] = await Promise.all([
      offerAllowed ? safeRows(sb.from('teklifler').select('id,status,total,estimated_price,created_at,accepted_at,rejected_at').order('created_at',{ascending:false}).limit(1000)) : [],
      jobAllowed ? safeRows(sb.from('jobs').select('id,status,event_at,created_at').order('event_at',{ascending:true}).limit(1000)) : [],
      payAllowed ? safeRows(sb.from('payments').select('id,amount,status,due_date,paid_at').order('due_date',{ascending:true}).limit(1000)) : [],
      equipmentAllowed ? safeRows(sb.from('equipment_staff').select('id,quantity,faulty_quantity,maintenance_quantity,reserved_quantity,in_use_quantity,active').limit(1000)) : [],
      staffAllowed ? safeRows(sb.from('staff').select('id,active').limit(1000)) : []
    ]);
    const oc=countBy(offers), jc=countBy(jobs), pc=countBy(payments);
    const offerTotal=offers.length, accepted=oc.accepted||0, sent=oc.sent||0, pending=(oc.pending||0)+(oc.new||0), rejected=oc.rejected||0, cancelled=oc.cancelled||0, expired=oc.expired||0;
    const conversion=offerTotal?Math.round(accepted/offerTotal*100):0;
    const acceptedValue=sumBy(offers,'total','accepted'), pipelineValue=offers.filter(r=>['pending','new','sent','evaluating'].includes(String(r.status||'').toLowerCase())).reduce((n,r)=>n+Number(r.total||r.estimated_price||0),0);
    const activeJobs=jobs.filter(r=>!['done','completed','cancelled'].includes(String(r.status||'').toLowerCase())).length;
    const paid=payments.filter(r=>String(r.status||'').toLowerCase()==='paid').reduce((n,r)=>n+Number(r.amount||0),0);
    const due=payments.filter(r=>['pending','deposit','partial','overdue'].includes(String(r.status||'').toLowerCase())).reduce((n,r)=>n+Number(r.amount||0),0);
    const overdue=payments.filter(r=>String(r.status||'').toLowerCase()==='overdue').reduce((n,r)=>n+Number(r.amount||0),0);
    const stock=equipment.reduce((n,r)=>n+Number(r.quantity||0),0), faulty=equipment.reduce((n,r)=>n+Number(r.faulty_quantity||0),0), maintenance=equipment.reduce((n,r)=>n+Number(r.maintenance_quantity||0),0),reserved=equipment.reduce((n,r)=>n+Number(r.reserved_quantity||0),0),inUse=equipment.reduce((n,r)=>n+Number(r.in_use_quantity||0),0),available=Math.max(0,stock-faulty-maintenance-reserved-inUse);
    const activeStaff=staff.filter(r=>r.active!==false).length;
    const offerRows=[['Bekliyor / Yeni',pending,'pending'],['Gönderildi',sent,'sent'],['Kabul edildi',accepted,'accepted'],['Reddedildi',rejected,'rejected'],['İptal',cancelled,'cancelled'],['Süresi doldu',expired,'expired']].filter(x=>x[1]>0).map(x=>`<tr><td><span class="sp-a-dot ${x[2]}"></span>${esc(x[0])}</td><td><b>${x[1]}</b></td><td>%${offerTotal?Math.round(x[1]/offerTotal*100):0}</td><td>${['accepted'].includes(x[2])?money(sumBy(offers,'total',x[2])):'—'}</td></tr>`);
    const jobRows=Object.entries(jc).sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<tr><td>${esc(jobLabel(s))}</td><td><b>${n}</b></td></tr>`);
    const paymentRows=Object.entries(pc).sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<tr><td>${esc(statusLabel(s))}</td><td><b>${n}</b></td><td>${money(payments.filter(r=>String(r.status||'').toLowerCase()===s).reduce((x,r)=>x+Number(r.amount||0),0))}</td></tr>`);
    const content=document.querySelector('#content'); if(!content)return;
    content.innerHTML=`<div class="page-head"><div><h1>Analitik</h1><p class="muted">Dönüşüm, satış, operasyon ve kaynak durumu</p></div><button type="button" class="btn" id="spAnalyticsRefresh">Yenile</button></div>
      <section class="sp-a-grid sp-a-grid-primary">${card('Toplam teklif',offerTotal,'Tüm görünen teklifler','blue')}${card('Bekleyen / Yeni',pending,'Henüz sonuçlanmayan','yellow')}${card('Gönderildi',sent,'Müşteriye iletilen','purple')}${card('Kabul edildi',accepted,'Sonuçlanan olumlu','green')}${card('Reddedildi',rejected,'Sonuçlanan olumsuz','red')}${card('Dönüşüm',`%${conversion}`,'Kabul / toplam teklif','green')}${jobAllowed?card('Aktif iş',activeJobs,'Planlanan + devam eden','blue'):''}${staffAllowed?card('Aktif personel',activeStaff,'Aktif personel kayıtları','purple'):''}</section>
      <div class="sp-a-columns">
        ${offerAllowed?`<section class="panel sp-a-panel"><div class="sp-a-panel-head"><div><h2>Teklif hunisi</h2><p class="muted">Red, bekleyen ve gönderilmiş durumlar ayrı gösterilir.</p></div><strong>${money(pipelineValue)}<small>Açık teklif değeri</small></strong></div>${barRow('Bekleyen / Yeni',pending,offerTotal,'yellow')}${barRow('Gönderildi',sent,offerTotal,'purple')}${barRow('Kabul edildi',accepted,offerTotal,'green')}${barRow('Reddedildi',rejected,offerTotal,'red')}${table(['Durum','Adet','Pay','Kabul değeri'],offerRows,'Teklif durumu bulunamadı.')}</section>`:''}
        ${jobAllowed?`<section class="panel sp-a-panel"><div class="sp-a-panel-head"><div><h2>İş / operasyon</h2><p class="muted">İşlerin gerçek durum dağılımı</p></div><strong>${activeJobs}<small>Aktif / açık iş</small></strong></div>${table(['Durum','Adet'],jobRows,'İş kaydı bulunamadı.')}</section>`:''}
      </div>
      <div class="sp-a-columns">
        ${payAllowed?`<section class="panel sp-a-panel"><div class="sp-a-panel-head"><div><h2>Finans özeti</h2><p class="muted">Yetkiniz dahilindeki ödeme kayıtları</p></div></div><div class="sp-a-finance-grid">${card('Bekleyen',money(due),'Tahsil edilmemiş','yellow')}${card('Tahsil edilen',money(paid),'Ödenmiş','green')}${card('Gecikmiş',money(overdue),'Vadesi geçen','red')}</div>${table(['Ödeme durumu','Kayıt','Tutar'],paymentRows,'Ödeme kaydı bulunamadı.')}</section>`:''}
        ${equipmentAllowed?`<section class="panel sp-a-panel"><div class="sp-a-panel-head"><div><h2>Envanter durumu</h2><p class="muted">Toplam stok ve fiziksel kullanım durumu</p></div></div><div class="sp-a-finance-grid">${card('Toplam stok',stock,'Adet','blue')}${card('Boşta',available,'Kullanılabilir','green')}${card('Kullanımda',inUse,'Sahada / kullanımda','purple')}${card('Arızalı + bakım',faulty+maintenance,'Servis dışı','red')}</div><div class="sp-a-mini-list"><span>Rezerve <b>${reserved}</b></span><span>Arızalı <b>${faulty}</b></span><span>Bakımda <b>${maintenance}</b></span><span>Toplam kayıt <b>${equipment.length}</b></span></div></section>`:''}
      </div>
      ${offerAllowed?`<section class="panel sp-a-panel"><div class="sp-a-panel-head"><div><h2>Son teklifler</h2><p class="muted">En yeni 12 kayıt</p></div></div>${table(['Tarih','Durum','Tutar'],offers.slice(0,12).map(o=>`<tr><td>${esc(o.created_at?new Date(o.created_at).toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}):'—')}</td><td><span class="status ${esc(String(o.status||''))}">${esc(statusLabel(o.status))}</span></td><td><b>${money(o.total||o.estimated_price)}</b></td></tr>`),'Teklif bulunamadı.')}</section>`:''}`;
    document.querySelector('#spAnalyticsRefresh')?.addEventListener('click',()=>window.analyticsView());
  }
  window.analyticsView = analyticsViewV2;
})();
