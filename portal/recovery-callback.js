/* Stagepulse Portal — explicit Supabase recovery callback. */
(() => {
  'use strict';
  if (window.STAGEPULSE_RECOVERY_CALLBACK_BOUND) return;
  window.STAGEPULSE_RECOVERY_CALLBACK_BOUND = true;

  const run = async () => {
    const sb = window.sb || window.StagepulsePortalSupabase?.getClient?.();
    if (!sb?.auth) return;

    const url = new URL(window.location.href);
    const hash = new URLSearchParams((url.hash || '').replace(/^#/, ''));
    const code = url.searchParams.get('code');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const type = url.searchParams.get('type') || hash.get('type');
    const error = url.searchParams.get('error') || hash.get('error');
    const errorDescription = url.searchParams.get('error_description') || hash.get('error_description');

    if (error) {
      console.error('[stagepulse-recovery]', error, errorDescription || '');
      history.replaceState(null, document.title, url.pathname);
      return;
    }

    if (code) {
      const result = await sb.auth.exchangeCodeForSession(code);
      if (result.error) throw result.error;
    } else if (accessToken && refreshToken) {
      const result = await sb.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (result.error) throw result.error;
    } else if (type !== 'recovery') {
      return;
    }

    const clean = `${url.origin}${url.pathname}${url.searchParams.has('type') ? '?type=recovery' : ''}`;
    history.replaceState(null, document.title, clean);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void run().catch(err => console.error('[stagepulse-recovery]', err)), { once: true });
  } else {
    void run().catch(err => console.error('[stagepulse-recovery]', err));
  }
})();
