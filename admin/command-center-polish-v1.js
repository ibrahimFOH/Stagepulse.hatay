/* Stagepulse Command Center — visual/UX polish layer v1 */
(function(){'use strict';
  function inject(){
    if(document.getElementById('ccPolishStyle'))return;
    var s=document.createElement('style');s.id='ccPolishStyle';s.textContent=`
      .cc-shell{max-width:1240px!important;padding:8px 0 48px!important}
      .cc-hero{padding:10px 0 16px!important;align-items:center!important}
      .cc-hero h2{font-size:28px!important;letter-spacing:-.03em!important}
      .cc-kicker{letter-spacing:.16em!important}
      .cc-tabs{position:sticky;top:0;z-index:8;background:rgba(9,9,9,.88);backdrop-filter:blur(14px);padding:7px 2px!important;border-bottom:1px solid rgba(255,255,255,.1)!important}
      .cc-tabs button{white-space:nowrap;border-radius:10px!important;padding:9px 13px!important;border:1px solid transparent!important;transition:.16s ease}
      .cc-tabs button.active{background:rgba(255,255,255,.1)!important;border-color:rgba(255,255,255,.14)!important}
      .cc-stats{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px!important;margin-bottom:14px!important}
      .cc-stat{min-height:86px!important;text-align:left!important;padding:14px!important;border-radius:14px!important;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))!important;border:1px solid rgba(255,255,255,.1)!important;transition:transform .15s ease,border-color .15s ease}
      .cc-stat:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.2)!important}
      .cc-stat strong{font-size:24px!important;line-height:1!important;display:block;margin-bottom:7px}
      .cc-stat span{font-size:12px!important;opacity:.72}
      .cc-flow{display:flex!important;align-items:center!important;gap:5px!important;overflow:auto!important;padding:10px!important;margin-bottom:14px!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:14px!important;background:rgba(255,255,255,.025)!important}
      .cc-flow div{flex:1 0 92px!important;min-width:92px!important;padding:9px!important;border-radius:10px!important;background:rgba(255,255,255,.045)!important;text-align:center}
      .cc-flow b{display:block;font-size:10px;opacity:.45;margin-bottom:4px}.cc-flow span{font-size:11px;font-weight:600}.cc-flow i{opacity:.3;font-style:normal}
      #ccPanels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
      .cc-panel{margin:0!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:15px!important;background:rgba(255,255,255,.018)!important;overflow:hidden}
      .cc-panel-head{padding:13px 14px!important;border-bottom:1px solid rgba(255,255,255,.07)!important}
      .cc-panel-head h3{font-size:13px!important;margin:0!important;letter-spacing:-.01em}
      .cc-row{width:100%;display:flex;justify-content:space-between;gap:12px;align-items:center;text-align:left;padding:12px 14px!important;background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.055);color:inherit;cursor:pointer}
      .cc-row:last-child{border-bottom:0}.cc-row:hover{background:rgba(255,255,255,.035)}
      .cc-row-main{min-width:0}.cc-row-main strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cc-row-main small{display:block;margin-top:4px;font-size:10px;opacity:.52;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cc-badges{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.cc-badges span,.cc-agent-tags span{font-size:9px!important;padding:4px 6px!important;border-radius:7px!important;background:rgba(255,255,255,.07)!important;white-space:nowrap}
      .cc-agent{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.055)}.cc-agent:last-child{border-bottom:0}.cc-agent strong{display:block;font-size:12px}.cc-agent small{display:block;margin-top:4px;opacity:.5;font-size:10px;max-width:430px}.cc-agent-tags{display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .cc-context{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.055)}.cc-context:last-child{border-bottom:0}.cc-context span{font-size:11px;opacity:.68}.cc-context strong{font-size:15px}
      .cc-finance-kpis{display:grid!important;grid-template-columns:repeat(3,1fr);gap:8px!important;padding:12px!important}.cc-finance-kpis>div{padding:11px;border-radius:10px;background:rgba(255,255,255,.045)}.cc-finance-kpis small{display:block;font-size:9px;opacity:.5}.cc-finance-kpis strong{display:block;font-size:17px;margin-top:4px}
      .cc-empty{padding:20px 14px!important;font-size:11px!important;line-height:1.5!important;opacity:.5}
      @media(max-width:900px){.cc-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}#ccPanels{grid-template-columns:1fr!important}}
      @media(max-width:600px){.cc-shell{padding:2px 0 30px!important}.cc-hero{padding:4px 0 12px!important}.cc-hero h2{font-size:23px!important}.cc-hero p{font-size:11px!important}.cc-actions .btn{padding:8px 10px!important}.cc-tabs{margin-left:-4px!important;margin-right:-4px!important}.cc-tabs button{font-size:10px!important;padding:8px 10px!important}.cc-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.cc-stat{min-height:74px!important;padding:12px!important}.cc-stat strong{font-size:21px!important}.cc-flow{margin-left:-2px;margin-right:-2px}.cc-flow div{flex-basis:82px!important;min-width:82px!important}.cc-row{padding:11px 12px!important}.cc-row-main strong{font-size:11px}.cc-row-main small{font-size:9px}.cc-agent{display:block}.cc-agent-tags{justify-content:flex-start;margin-top:8px}.cc-finance-kpis strong{font-size:14px}}
    `;document.head.appendChild(s);
  }
  function enhance(){
    inject();
    var shell=document.querySelector('.cc-shell');if(!shell)return;
    var hero=document.querySelector('.cc-hero');
    if(hero&&!document.getElementById('ccQuickActions')){
      var q=document.createElement('div');q.id='ccQuickActions';q.className='cc-quick-actions';q.innerHTML='<span>Hızlı erişim</span><button data-view="customers">Müşteri</button><button data-view="offers">Teklif</button><button data-view="calendar">İş / Etkinlik</button><button data-view="personnel">Personel</button><button data-view="equipment">Ekipman</button><button data-view="finance">Finans</button>';
      hero.parentNode.insertBefore(q,hero.nextSibling);
      q.querySelectorAll('button').forEach(function(b){b.onclick=function(){var x=document.querySelector('#sideNav [data-view="'+b.dataset.view+'"]');if(x)x.click()}});
      var qs=document.createElement('style');qs.textContent='.cc-quick-actions{display:flex;align-items:center;gap:6px;overflow:auto;padding:0 0 12px}.cc-quick-actions span{font-size:9px;opacity:.42;margin-right:2px;white-space:nowrap}.cc-quick-actions button{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:inherit;border-radius:8px;padding:7px 9px;font-size:10px;white-space:nowrap}.cc-quick-actions button:hover{background:rgba(255,255,255,.08)}';document.head.appendChild(qs);
    }
    var panels=document.getElementById('ccPanels');if(panels&&!panels.dataset.enhanced){panels.dataset.enhanced='1';
      panels.addEventListener('click',function(e){var r=e.target.closest('.cc-row');if(!r)return;});
    }
  }
  function boot(){enhance();setTimeout(enhance,500);setTimeout(enhance,1500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
