/* Stagepulse Admin compatibility bridge.
 * Keeps the restored complete admin core compatible with the newer shell/patch modules.
 */
(() => {
  'use strict';
  const sb = window.sb || window.supabaseClient || null;
  if (sb) {
    window.__stagepulseAdminClient = sb;
    window.supabaseClient = sb;
    window.getAdminClient = () => sb;
    window.StagepulseAdminSupabase = window.StagepulseAdminSupabase || { getClient: () => sb };
  }
  try { window.dispatchEvent(new Event('stagepulse-admin-ready')); } catch (_) {}
})();
