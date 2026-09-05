/* Stagepulse Admin — canonical sidebar dedupe.
 * One navigation entry per view/label and one section label per section name.
 * Safe to run repeatedly because it only removes later duplicates.
 */
(() => {
  'use strict';
  if (window.__STAGEPULSE_PATRON_CENTER_DEDUPE_V2__) return;
  window.__STAGEPULSE_PATRON_CENTER_DEDUPE_V2__ = true;

  const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');

  function dedupe() {
    const nav = document.getElementById('sideNav');
    if (!nav) return;

    const seen = new Set();
    [...nav.querySelectorAll('button')].forEach((button) => {
      if (button.id === 'logoutBtn' || button.classList.contains('nav-logout')) return;
      const key = button.dataset.view ? `view:${norm(button.dataset.view)}` : `label:${norm(button.textContent)}`;
      if (!key || key === 'label:') return;
      if (seen.has(key)) button.remove();
      else seen.add(key);
    });

    const sectionSeen = new Set();
    [...nav.querySelectorAll('.nav-label')].forEach((label) => {
      const key = norm(label.textContent);
      if (!key) return;
      if (sectionSeen.has(key)) label.remove();
      else sectionSeen.add(key);
    });

    // Legacy organization launcher is superseded by the canonical organization entry.
    nav.querySelectorAll('#orgDashboardNav').forEach((node) => node.remove());
  }

  const run = () => { dedupe(); setTimeout(dedupe, 50); setTimeout(dedupe, 500); };
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('stagepulse-admin-ready', run);
  window.addEventListener('hashchange', run);
  setInterval(dedupe, 1500);
})();
