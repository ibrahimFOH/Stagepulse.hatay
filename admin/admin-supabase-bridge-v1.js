/* Stagepulse Admin — canonical Supabase client bridge. */
(() => {
  'use strict';
  const runtime = window.STAGEPULSE_RUNTIME || {};
  const create = () => {
    if (!window.supabase || !runtime.supabaseUrl || !runtime.supabasePublishableKey) return null;
    return window.supabase.createClient(runtime.supabaseUrl, runtime.supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'stagepulse-admin-auth-v2' }
    });
  };
  try {
    if (!window.__stagepulseAdminClient) {
      if (typeof sb !== 'undefined' && sb && typeof sb.from === 'function') window.__stagepulseAdminClient = sb;
      else window.__stagepulseAdminClient = create();
    }
    window.StagepulseAdminSupabase = window.StagepulseAdminSupabase || {
      getClient() {
        if (!window.__stagepulseAdminClient) window.__stagepulseAdminClient = create();
        if (!window.__stagepulseAdminClient) throw new Error('Supabase istemcisi hazır değil.');
        return window.__stagepulseAdminClient;
      }
    };
    if (!window.sb && window.__stagepulseAdminClient) window.sb = window.__stagepulseAdminClient;
    if (!window.supabaseClient && window.__stagepulseAdminClient) window.supabaseClient = window.__stagepulseAdminClient;
  } catch (e) { console.error('[Stagepulse Supabase bridge]', e); }
})();
