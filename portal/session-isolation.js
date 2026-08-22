/* Stagepulse: Admin and Staff must keep independent Supabase sessions even
 * when both APKs are TWA/Chrome shells sharing the same origin storage. */
(() => {
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
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
  };
})();
