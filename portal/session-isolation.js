/* Stagepulse: Admin and Staff must keep independent Supabase sessions even
 * when both APKs are TWA/Chrome shells sharing the same origin storage. */
(() => {
  // Never leave a password-like query parameter in browser history/address bars.
  // This also protects the form if the auth JS fails to intercept a submit.
  try {
    const url = new URL(window.location.href);
    const sensitive = ['password', 'passwd', 'pass', 'pwd'];
    let changed = false;
    for (const key of sensitive) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const query = url.searchParams.toString();
      const clean = url.pathname + (query ? `?${query}` : '') + url.hash;
      history.replaceState(null, document.title, clean);
    }
  } catch (_) {}

  if (!window.supabase?.createClient) return;
  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  const role = location.pathname.startsWith('/admin/') ? 'admin' : 'staff';
  const storageKey = `stagepulse-${role}-auth-v2`;

  window.supabase.createClient = (url, key, options = {}) => {
    const auth = options.auth || {};
    return originalCreateClient(url, key, {
      ...options,
      auth: {
        ...auth,
        storageKey,
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  };
})();
