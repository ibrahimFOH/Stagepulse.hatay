/* Stagepulse Admin — focused UI polish for Personnel, Settings, Notifications and Payments. Visual layer only. */
(() => {
  'use strict';
  const STYLE_ID = 'sp-admin-core-ui-v1';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Admin content rhythm */
      #content > .page-head { margin-bottom: 18px; }
      #content > .page-head h1 { letter-spacing: -.02em; }
      #content > .page-head .muted { max-width: 760px; }
      #content .panel { border-radius: 16px; }
      #content .cards { gap: 12px; }
      #content .card { border-radius: 16px; min-height: 92px; }

      /* Personnel console */
      #spPersonnelAdmin .sp-pa-card { border-radius: 18px; }
      #spPersonnelAdmin .sp-pa-card-top { align-items: flex-start; }
      #spPersonnelAdmin .sp-pa-perms { grid-template-columns: repeat(auto-fit,minmax(290px,1fr)); }
      #spPersonnelAdmin .sp-pa-group { border: 1px solid rgba(127,127,127,.14); border-radius: 14px; padding: 12px 14px; }
      #spPersonnelAdmin .sp-pa-group h4 { margin-bottom: 4px; }
      #spPersonnelAdmin .sp-pa-row { min-height: 42px; }
      #spPersonnelAdmin .sp-pa-save { position: sticky; bottom: 8px; z-index: 3; padding: 10px 0; background: linear-gradient(transparent,var(--bg,#0d0e12) 24%); }

      /* Settings */
      #content .grid2 { align-items: stretch; gap: 14px; }
      #content .grid2 > .panel { min-width: 0; }
      #content .grid2 > .panel h3 { margin-top: 0; margin-bottom: 14px; }
      #content label { gap: 7px; }
      #content input:not([type=checkbox]), #content select, #content textarea { min-height: 42px; border-radius: 10px; }

      /* Notifications */
      #content #spPushConnectionPanel { border: 1px solid rgba(127,127,127,.18); }
      #content .row-item { gap: 14px; padding: 13px 0; }
      #content .row-main { min-width: 0; }
      #content .row-main strong { display: block; margin-bottom: 3px; }
      #content .row-side { flex-wrap: wrap; }

      /* Payments / finance */
      #content .data-table { min-width: 820px; }
      #content .data-table th { white-space: nowrap; }
      #content .data-table td { vertical-align: middle; }

      @media (max-width: 760px) {
        #content > .page-head { gap: 10px; }
        #content .grid2 { grid-template-columns: 1fr; }
        #content .cards { grid-template-columns: repeat(2,minmax(0,1fr)); }
        #spPersonnelAdmin .sp-pa-perms { grid-template-columns: 1fr; }
        #spPersonnelAdmin .sp-pa-save { position: static; background: none; }
      }
      @media (max-width: 430px) {
        #content .cards { grid-template-columns: 1fr; }
        #spPersonnelAdmin .sp-pa-head { align-items: stretch; }
        #spPersonnelAdmin .sp-pa-head .btn { width: 100%; }
        #spPersonnelAdmin .sp-pa-card-top { flex-direction: column; }
        #spPersonnelAdmin .sp-pa-status { width: 100%; justify-content: space-between; }
      }
    `;
    document.head.appendChild(style);
  }

  function decorate(view) {
    injectStyle();
    document.body.classList.add('stagepulse-admin-polished');
    const content = document.getElementById('content');
    if (!content) return;
    content.dataset.adminPolishedView = view || '';

    if (view === 'notifications') {
      const head = content.querySelector('.page-head');
      if (head) head.dataset.section = 'notifications';
    }
    if (view === 'finance') {
      const table = content.querySelector('.data-table');
      if (table) table.closest('.table-wrap')?.setAttribute('role', 'region');
    }
  }

  function bind() {
    if (window.__stagepulseAdminCoreUiBound) return;
    window.__stagepulseAdminCoreUiBound = true;
    injectStyle();
    const original = window.loadView;
    if (typeof original === 'function') {
      window.loadView = async function(view) {
        const result = await original.apply(this, arguments);
        requestAnimationFrame(() => decorate(view));
        return result;
      };
    }
    const observer = new MutationObserver(() => {
      if (document.getElementById('content')?.children.length) decorate((location.hash || '#home').slice(1));
    });
    const content = document.getElementById('content');
    if (content) observer.observe(content, {childList:true, subtree:false});
    setTimeout(() => observer.disconnect(), 15000);
    decorate((location.hash || '#home').slice(1));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();
