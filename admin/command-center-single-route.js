/* Stagepulse — single canonical Command Center route. */
(() => {
  'use strict';

  const runtime = () => window.STAGEPULSE_RUNTIME || {};
  let client;
  let installed = false;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v) => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', maximumFractionDigits:0 }).format(Number(v) || 0);
  const n = (v) => Number(v) || 0;

  function sb() {
    if (client) return client;
    const cfg = runtime();
    client = window.__stagepulseAdminClient || window.supabaseClient ||
      (cfg.supabaseUrl && cfg.supabasePublishableKey && window.supabase?.createClient
        ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)
        : null);
    return client;
  }

  async function read(table, select='*', options={}) {
    const c = sb();
    if (!c) throw new Error('Supabase bağlantısı hazır değil.');
    let q = c.from(table).select(select);
    if (options.order) q = q.order(options.order[0], { ascending: options.order[1] !== false });
    if (options.limit) q = q.limit(options.limit);
    if (options.eq) q = q.eq(options.eq[0], options.eq[1]);
    const r = await q;
    if (r.error) throw r.error;
    return r.data || [];
  }

  function navClass(view) {
    document.querySelectorAll('#sideNav button[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }

  function setHeader() {
    const t = document.getElementById('viewTitle');
    const s = document.getElementById('viewSubtitle');
    if (t) t.textContent = 'Komuta Merkezi';
    if (s) s.textContent = 'Şirket · satış · operasyon · finans · AI';
  }

  function styles() {
    if (document.getElementById('spSingleCCStyle')) return;
    const s = document.createElement('style');
    s.id = 'spSingleCCStyle';
    s.textContent = `
      .sp-cc{max-width:1180px;margin:0 auto;padding:0 0 40px;color:inherit}
      .sp-cc-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:8px 0 16px}
      .sp-cc-kicker{font-size:10px;letter-spacing:.12em;opacity:.48;font-weight:800}.sp-cc h2{margin:5px 0;font-size:28px}.sp-cc-head p{margin:0;opacity:.58;font-size:13px}
      .sp-cc-tabs{display:flex;gap:6px;overflow:auto;border-bottom:1px solid rgba(255,255,255,.08);padding:0 0 10px;margin-bottom:14px}.sp-cc-tabs button{border:1px solid transparent;background:transparent;color:inherit;border-radius:9px;padding:9px 12px;white-space:nowrap;cursor:pointer;opacity:.6}.sp-cc-tabs button.active{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.06);opacity:1}
      .sp-cc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.sp-cc-card{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.025);border-radius:13px;padding:14px;text-align:left}.sp-cc-card strong{display:block;font-size:24px}.sp-cc-card span{display:block;font-size:11px;opacity:.55;margin-top:3px}.sp-cc-card button{margin-top:9px;border:0;background:rgba(255,255,255,.06);color:inherit;border-radius:7px;padding:6px 8px;font-size:10px;cursor:pointer}.sp-cc-section{border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.018);margin-top:12px;padding:14px}.sp-cc-section h3{margin:0 0 9px;font-size:15px}.sp-cc-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.06)}.sp-cc-row:first-child{border-top:0}.sp-cc-row-main{min-width:0}.sp-cc-row-main b,.sp-cc-row-main small{display:block}.sp-cc-row-main b{font-size:12px}.sp-cc-row-main small{font-size:10px;opacity:.52;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.sp-cc-tags{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.sp-cc-tag{font-size:10px;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.06);white-space:nowrap}.sp-cc-empty{padding:10px 0;opacity:.5;font-size:12px}.sp-cc-health{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.sp-cc-health>div{padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);font-size:10px;display:flex;justify-content:space-between}.sp-cc-health b{font-size:10px}.sp-cc-dot{width:7px;height:7px;display:inline-block;border-radius:50%;background:#25d999;margin-right:5px}.sp-cc-flow{display:flex;gap:6px;overflow:auto;margin:0 0 12px}.sp-cc-flow span{min-width:104px;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);font-size:11px}.sp-cc-list{display:grid;gap:4px}.sp-cc-agent{padding:10px 0;border-top:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between;gap:12px}.sp-cc-agent:first-child{border-top:0}.sp-cc-agent b,.sp-cc-agent small{display:block}.sp-cc-agent small{opacity:.5;font-size:10px;margin-top:3px}.sp-cc-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sp-cc-mini{padding:11px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.sp-cc-mini small,.sp-cc-mini strong{display:block}.sp-cc-mini small{opacity:.5}.sp-cc-mini strong{margin-top:4px;font-size:16px}
      @media(max-width:900px){.sp-cc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-cc-health{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:600px){.sp-cc{padding-bottom:26px}.sp-cc-head h2{font-size:24px}.sp-cc-head p{font-size:11px}.sp-cc-grid{gap:7px}.sp-cc-card{padding:12px}.sp-cc-card strong{font-size:21px}.sp-cc-section{padding:11px}.sp-cc-row{display:block}.sp-cc-tags{justify-content:flex-start;margin-top:7px}.sp-cc-mini-grid{grid-template-columns:1fr}.sp-cc-flow span{min-width:94px}}
    `;
    document.head.appendChild(s);
  }

  function tabs(active) {
    return `<nav class="sp-cc-tabs" aria-label="Komuta Merkezi"><button data-sp-tab="overview" class="${active==='overview'?'active':''}">Genel</button><button data-sp-tab="operations" class="${active==='operations'?'active':''}">Operasyon</button><button data-sp-tab="finance" class="${active==='finance'?'active':''}">Finans</button><button data-sp-tab="ai" class="${active==='ai'?'active':''}">AI</button><button data-sp-tab="management" class="${active==='management'?'active':''}">Yönetim</button></nav>`;
  }

  async function overview() {
    const [customers, offers, jobs, events, staff, equipment, tasks, finance, aiRuns] = await Promise.all([
      read('customers','id'),read('teklifler','id'),read('jobs','id'),read('event_projects','id'),read('staff_profiles','user_id'),read('equipment','id'),read('event_tasks','id,status'),read('event_financials','event_id,estimated_revenue,estimated_cost,actual_revenue,actual_cost'),read('ai_runs','id')
    ]);
    const openTasks = tasks.filter(x=>!['done','cancelled'].includes(x.status)).length;
    return `<div class="sp-cc-health"><div><span>Veri</span><b><i class="sp-cc-dot"></i>Canlı</b></div><div><span>Operasyon</span><b>Bağlı</b></div><div><span>Finans</span><b>Bağlı</b></div><div><span>AI</span><b>Hazır</b></div></div>
      <div class="sp-cc-flow"><span>1 · Müşteri</span><span>2 · Teklif</span><span>3 · İş</span><span>4 · Etkinlik</span><span>5 · Kaynaklar</span><span>6 · Finans</span><span>7 · AI + Onay</span></div>
      <div class="sp-cc-grid">${[
        ['Müşteriler',customers.length,'customers'],['Teklifler',offers.length,'offers'],['İşler',jobs.length,'calendar'],['Etkinlikler',events.length,'calendar'],['Personel',staff.length,'personnel'],['Ekipman',equipment.length,'equipment'],['Açık görev',openTasks,'calendar'],['Finans kayıtları',finance.length,'finance'],['AI çalışmaları',aiRuns.length,'ai']
      ].map(x=>`<div class="sp-cc-card"><strong>${x[1]}</strong><span>${esc(x[0])}</span><button data-sp-nav="${x[2]}">Aç</button></div>`).join('')}</div>
      <div id="spCCOverviewLists"></div>`;
  }

  async function overviewLists() {
    const [customers, events] = await Promise.all([
      read('stagepulse_customer_command_view','customer_id,name,company,phone,offer_count,job_count,event_count,task_count',{limit:30}),
      read('stagepulse_event_command_view','event_id,title,status,venue,city,customer_name,customer_company,staff_count,equipment_count,task_count,completed_task_count,event_start_at',{limit:30,order:['event_start_at',true]})
    ]);
    return `<div class="sp-cc-section"><h3>Müşteriler</h3><div class="sp-cc-list">${customers.map(c=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(c.company||c.name||'İsimsiz')}</b><small>${esc(c.name||'')} ${c.phone?'· '+esc(c.phone):''}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">Teklif ${n(c.offer_count)}</span><span class="sp-cc-tag">İş ${n(c.job_count)}</span><span class="sp-cc-tag">Etkinlik ${n(c.event_count)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Müşteri bulunamadı.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Yaklaşan / aktif etkinlikler</h3><div class="sp-cc-list">${events.map(e=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(e.title||'Etkinlik')}</b><small>${esc(e.customer_company||e.customer_name||'Müşteri yok')} · ${esc(e.city||e.venue||'Lokasyon yok')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(e.status||'—')}</span><span class="sp-cc-tag">P ${n(e.staff_count)}</span><span class="sp-cc-tag">E ${n(e.equipment_count)}</span><span class="sp-cc-tag">G ${n(e.completed_task_count)}/${n(e.task_count)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Etkinlik bulunamadı.</div>'}</div></div>`;
  }

  async function operations() {
    const [tasks, resources, maintenance, vehicles, checklists, risks, automations] = await Promise.all([
      read('event_tasks','id,status'),read('stagepulse_resource_command_view','resource_id,event_id,resource_type,quantity,status,event_title,event_start_at,staff_name,equipment_brand,equipment_model,vehicle_name,vehicle_plate',{limit:80}),read('equipment_maintenance_plans','id,status'),read('vehicles','id,active'),read('stagepulse_checklist_command_view','checklist_id,event_id,name,phase,status,item_count,completed_items,required_open_items',{limit:50}),read('stagepulse_risk_command_view','id,title,event_title,severity,likelihood,status',{limit:50}),read('stagepulse_automation_command_view','rule_id,code,name,active,run_count,completed_runs,last_run_at',{limit:50})
    ]);
    const open=tasks.filter(x=>!['done','cancelled'].includes(x.status)).length;
    const overdue=maintenance.filter(x=>x.status==='overdue').length;
    const activeVehicles=vehicles.filter(x=>x.active!==false).length;
    return `<div class="sp-cc-mini-grid"><div class="sp-cc-mini"><small>Açık görev</small><strong>${open}</strong></div><div class="sp-cc-mini"><small>Bakım gecikmiş</small><strong>${overdue}</strong></div><div class="sp-cc-mini"><small>Aktif araç</small><strong>${activeVehicles}</strong></div></div>
      <div class="sp-cc-section"><h3>Kaynak atamaları</h3><div class="sp-cc-list">${resources.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.staff_name||((r.equipment_brand||'')+' '+(r.equipment_model||''))||r.vehicle_name||r.vehicle_plate||'Kaynak')}</b><small>${esc(r.event_title||'Etkinlik')} · ${esc(r.status||'—')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.resource_type||'')}</span><span class="sp-cc-tag">${n(r.quantity)} adet</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz kaynak ataması yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Kontrol listeleri</h3><div class="sp-cc-list">${checklists.map(c=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(c.name)}</b><small>${esc(c.phase)} · ${esc(c.status)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${n(c.completed_items)}/${n(c.item_count)}</span><span class="sp-cc-tag">Zorunlu açık ${n(c.required_open_items)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Kontrol listesi yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Riskler</h3><div class="sp-cc-list">${risks.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.title)}</b><small>${esc(r.event_title||'İşletme')} · ${esc(r.likelihood)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.severity)}</span><span class="sp-cc-tag">${esc(r.status)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Risk yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Otomasyon</h3><div class="sp-cc-list">${automations.map(a=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(a.name||a.code)}</b><small>${a.active?'Aktif':'Pasif'} · ${n(a.completed_runs)}/${n(a.run_count)} tamamlandı</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${a.last_run_at?new Date(a.last_run_at).toLocaleString('tr-TR'):'Çalışmadı'}</span></div></div>`).join('')||'<div class="sp-cc-empty">Otomasyon yok.</div>'}</div></div>`;
  }

  async function finance() {
    const data=await read('stagepulse_finance_command_view','event_id,event_title,customer_company,customer_name,estimated_revenue,estimated_cost,actual_revenue,actual_cost,currency',{limit:100});
    const revenue=data.reduce((a,x)=>a+n(x.actual_revenue??x.estimated_revenue),0);
    const cost=data.reduce((a,x)=>a+n(x.actual_cost??x.estimated_cost),0);
    return `<div class="sp-cc-mini-grid"><div class="sp-cc-mini"><small>Gelir</small><strong>${money(revenue)}</strong></div><div class="sp-cc-mini"><small>Maliyet</small><strong>${money(cost)}</strong></div><div class="sp-cc-mini"><small>Marj</small><strong>${money(revenue-cost)}</strong></div></div><div class="sp-cc-section"><h3>Etkinlik finansları</h3><div class="sp-cc-list">${data.map(x=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(x.event_title||'Etkinlik')}</b><small>${esc(x.customer_company||x.customer_name||'')} · ${esc(x.currency||'TRY')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${money(x.actual_revenue??x.estimated_revenue)}</span><span class="sp-cc-tag">Maliyet ${money(x.actual_cost??x.estimated_cost)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Finans kaydı yok.</div>'}</div></div>`;
  }

  async function ai() {
    const [agents,runs,approvals]=await Promise.all([
      read('ai_agents','id,code,name,purpose,scope,active,can_read,can_propose,can_execute',{limit:50}),read('stagepulse_ai_command_view','ai_run_id,agent_id,action_type,status,created_at,event_title',{limit:50,order:['created_at',false]}),read('ai_action_requests','id,action_type,status,reason,created_at',{limit:50,order:['created_at',false]})
    ]);
    return `<div class="sp-cc-section"><h3>AI ajanları</h3><div class="sp-cc-list">${agents.filter(a=>a.active!==false).map(a=>`<div class="sp-cc-agent"><div><b>${esc(a.name)}</b><small>${esc(a.purpose||a.scope||'')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${a.can_read?'Okuma':'Kapalı'}</span><span class="sp-cc-tag">${a.can_propose?'Öneri':'Kapalı'}</span><span class="sp-cc-tag">${a.can_execute?'Uygulama':'Onay gerekli'}</span></div></div>`).join('')||'<div class="sp-cc-empty">Aktif AI ajanı yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Son AI çalışmaları</h3><div class="sp-cc-list">${runs.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.action_type||'AI çalışması')}</b><small>${esc(r.event_title||'Genel')} · ${r.created_at?new Date(r.created_at).toLocaleString('tr-TR'):''}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.status||'—')}</span><span class="sp-cc-tag">${esc(r.agent_id||'ajan')}</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz AI çalışması yok. Ajanlar yapılandırılmış durumda.</div>'}</div></div>
      <div class="sp-cc-section"><h3>AI onay merkezi</h3><div class="sp-cc-list">${approvals.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.action_type||'Onay')}</b><small>${esc(r.reason||'Onay talebi')} · ${r.created_at?new Date(r.created_at).toLocaleString('tr-TR'):''}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.status||'pending')}</span></div></div>`).join('')||'<div class="sp-cc-empty">Bekleyen AI onayı yok.</div>'}</div></div>`;
  }

  async function management() {
    const [goals, initiatives, risks] = await Promise.all([
      read('executive_goals','id,title,status,priority,current_value,target_value,due_at',{limit:50,order:['created_at',false]}),read('strategic_initiatives','id,title,status,risk_level,description',{limit:50,order:['created_at',false]}),read('business_risks','id,title,category,severity,likelihood,status,mitigation',{limit:50,order:['created_at',false]})
    ]);
    return `<div class="sp-cc-section"><h3>Yönetim hedefleri</h3><div class="sp-cc-list">${goals.map(g=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(g.title)}</b><small>${esc(g.status)} · ${esc(g.priority)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(g.current_value??'—')} / ${esc(g.target_value??'—')}</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz hedef tanımlanmadı.</div>'}</div></div>
      <div class="sp-cc-section"><h3>Stratejik girişimler</h3><div class="sp-cc-list">${initiatives.map(i=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(i.title)}</b><small>${esc(i.description||'')}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(i.status)}</span><span class="sp-cc-tag">Risk ${esc(i.risk_level)}</span></div></div>`).join('')||'<div class="sp-cc-empty">Henüz stratejik girişim yok.</div>'}</div></div>
      <div class="sp-cc-section"><h3>İşletme riskleri</h3><div class="sp-cc-list">${risks.map(r=>`<div class="sp-cc-row"><div class="sp-cc-row-main"><b>${esc(r.title)}</b><small>${esc(r.category)} · ${esc(r.likelihood)}</small></div><div class="sp-cc-tags"><span class="sp-cc-tag">${esc(r.severity)}</span><span class="sp-cc-tag">${esc(r.status)}</span></div></div>`).join('')||'<div class="sp-cc-empty">İşletme riski yok.</div>'}</div></div>`;
  }

  async function render(tab='overview') {
    styles();
    navClass('command-center');
    setHeader();
    const content=document.getElementById('content'); if(!content)return;
    content.innerHTML=`<div class="sp-cc"><header class="sp-cc-head"><div><div class="sp-cc-kicker">STAGEPULSE · PATRON / YÖNETİM</div><h2>Komuta Merkezi</h2><p>Tek merkezden şirket, satış, operasyon, finans ve AI yönetimi.</p></div><button class="btn" id="spCCRefresh">Yenile</button></header>${tabs(tab)}<div id="spCCBody"><div class="sp-cc-empty">Veriler yükleniyor…</div></div></div>`;
    const body=document.getElementById('spCCBody');
    try {
      if(tab==='overview') body.innerHTML=await overview()+await overviewLists();
      else if(tab==='operations') body.innerHTML=await operations();
      else if(tab==='finance') body.innerHTML=await finance();
      else if(tab==='ai') body.innerHTML=await ai();
      else body.innerHTML=await management();
    } catch(e) {
      body.innerHTML=`<div class="sp-cc-section"><h3>Veri bağlantısı hatası</h3><div class="sp-cc-empty">${esc(e.message||e)}</div></div>`;
    }
    content.querySelectorAll('[data-sp-tab]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.spTab)));
    content.querySelectorAll('[data-sp-nav]').forEach(b=>b.addEventListener('click',()=>window.loadView?.(b.dataset.spNav)));
    document.getElementById('spCCRefresh')?.addEventListener('click',()=>render(tab));
  }

  function install() {
    if(installed)return;
    installed=true;
    styles();
    window.openStagepulseCommandCenter=(tab='overview')=>render(tab);
    window.commandCenterView=()=>render('overview');
    window.CommandCenter={render};
    const oldLoad=window.loadView;
    window.loadView=async function(view) {
      if(view==='command-center') { history.replaceState(null,'','#command-center'); return render('overview'); }
      return oldLoad(view);
    };
    if((location.hash||'#dashboard')==='#command-center')setTimeout(()=>render('overview'),250);
  }

  window.addEventListener('stagepulse-admin-ready',()=>setTimeout(install,100));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,600));
  if(document.readyState!=='loading')setTimeout(install,50);
})();
