/* Stagepulse Admin — canonical password-recovery bridge. */
(() => {
  'use strict';
  if (window.STAGEPULSE_ADMIN_RECOVERY_BOUND) return;
  window.STAGEPULSE_ADMIN_RECOVERY_BOUND = true;

  const ADMIN_REDIRECT = `${location.origin}/admin/`;
  const strong = (p) => typeof p === 'string' && p.length >= 10 && /[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p) && /[0-9]/.test(p);

  // The admin page disables implicit URL session detection. Force every
  // password-reset email to return to the admin recovery screen instead of /.
  const originalCreateClient = window.supabase?.createClient;
  if (originalCreateClient) {
    window.supabase.createClient = (...args) => {
      const client = originalCreateClient(...args);
      const originalReset = client?.auth?.resetPasswordForEmail?.bind(client.auth);
      if (originalReset) {
        client.auth.resetPasswordForEmail = (email, options = {}) =>
          originalReset(email, { ...options, redirectTo: ADMIN_REDIRECT });
      }
      return client;
    };
  }

  const params = () => {
    const url = new URL(location.href);
    const hash = new URLSearchParams((url.hash || '').replace(/^#/, ''));
    return {
      url,
      code: url.searchParams.get('code'),
      accessToken: hash.get('access_token'),
      refreshToken: hash.get('refresh_token'),
      type: url.searchParams.get('type') || hash.get('type'),
      error: url.searchParams.get('error') || hash.get('error'),
      errorDescription: url.searchParams.get('error_description') || hash.get('error_description')
    };
  };

  const cleanUrl = () => history.replaceState(null, document.title, ADMIN_REDIRECT);

  const render = (message = '') => {
    document.getElementById('adminRecoveryOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'adminRecoveryOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.92);font-family:system-ui,sans-serif;';
    overlay.innerHTML = `<div style="width:min(460px,100%);padding:28px;border:1px solid rgba(255,176,0,.28);border-radius:18px;background:#111;color:#fff;box-shadow:0 20px 80px rgba(0,0,0,.55)">
      <div style="font-size:12px;letter-spacing:.18em;color:#ffb000;font-weight:800;margin-bottom:10px">STAGEPULSE YÖNETİM</div>
      <h1 style="margin:0 0 8px;font-size:28px">Yeni şifre</h1>
      <p style="color:#aaa;margin:0 0 22px">Patron hesabınız için yeni şifre belirleyin.</p>
      <label style="display:block;margin:12px 0 6px">Yeni şifre</label>
      <input id="adminRecoveryPass1" type="password" autocomplete="new-password" minlength="10" style="box-sizing:border-box;width:100%;padding:13px;border-radius:10px;border:1px solid #333;background:#0b0b0b;color:#fff">
      <label style="display:block;margin:14px 0 6px">Yeni şifre tekrar</label>
      <input id="adminRecoveryPass2" type="password" autocomplete="new-password" minlength="10" style="box-sizing:border-box;width:100%;padding:13px;border-radius:10px;border:1px solid #333;background:#0b0b0b;color:#fff">
      <button id="adminRecoverySave" type="button" style="width:100%;margin-top:18px;padding:13px;border:0;border-radius:10px;background:#ffb000;color:#111;font-weight:800;cursor:pointer">Şifreyi güncelle</button>
      <p id="adminRecoveryError" role="alert" style="min-height:20px;color:#ff9292;font-size:13px;margin:12px 0 0"></p>
    </div>`;
    document.body.appendChild(overlay);
    const error = overlay.querySelector('#adminRecoveryError');
    if (message) error.textContent = message;
    return overlay;
  };

  const run = async () => {
    const state = params();
    const recovery = Boolean(state.code || (state.accessToken && state.refreshToken) || state.type === 'recovery');
    if (!recovery) return;

    const waitForClient = async () => {
      for (let i = 0; i < 100; i++) {
        const client = window.__stagepulseAdminClient || window.sb || window.supabaseClient;
        if (client?.auth) return client;
        await new Promise(r => setTimeout(r, 50));
      }
      throw new Error('Yönetim oturumu başlatılamadı.');
    };

    try {
      const client = await waitForClient();
      if (state.error) throw new Error(state.errorDescription || 'Şifre sıfırlama bağlantısı geçersiz.');
      if (state.code) {
        const result = await client.auth.exchangeCodeForSession(state.code);
        if (result.error) throw result.error;
      } else if (state.accessToken && state.refreshToken) {
        const result = await client.auth.setSession({ access_token: state.accessToken, refresh_token: state.refreshToken });
        if (result.error) throw result.error;
      } else {
        throw new Error('Şifre sıfırlama bağlantısı eksik veya süresi dolmuş.');
      }
      cleanUrl();
      const overlay = render();
      const p1 = overlay.querySelector('#adminRecoveryPass1');
      const p2 = overlay.querySelector('#adminRecoveryPass2');
      const save = overlay.querySelector('#adminRecoverySave');
      const error = overlay.querySelector('#adminRecoveryError');
      p1?.focus();
      save?.addEventListener('click', async () => {
        const a = p1.value;
        const b = p2.value;
        if (!strong(a)) { error.textContent = 'Şifre en az 10 karakter, en az bir harf ve bir rakam içermelidir.'; return; }
        if (a !== b) { error.textContent = 'Şifreler aynı değil.'; return; }
        save.disabled = true;
        save.textContent = 'Güncelleniyor…';
        const result = await client.auth.updateUser({ password: a });
        if (result.error) {
          error.textContent = result.error.message || 'Şifre güncellenemedi.';
          save.disabled = false;
          save.textContent = 'Şifreyi güncelle';
          return;
        }
        await client.auth.signOut();
        overlay.innerHTML = `<div style="width:min(460px,100%);padding:28px;border:1px solid rgba(255,176,0,.28);border-radius:18px;background:#111;color:#fff;text-align:center"><h1 style="margin:0 0 10px">Şifre güncellendi</h1><p style="color:#aaa">Yeni şifrenizle Patron Merkezi'ne giriş yapabilirsiniz.</p><button id="adminRecoveryLogin" style="margin-top:14px;padding:12px 18px;border:0;border-radius:10px;background:#ffb000;font-weight:800;cursor:pointer">Girişe dön</button></div>`;
        overlay.querySelector('#adminRecoveryLogin')?.addEventListener('click', () => { overlay.remove(); location.replace(ADMIN_REDIRECT); });
      });
    } catch (err) {
      cleanUrl();
      render(err?.message || 'Şifre sıfırlama bağlantısı işlenemedi.');
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void run(), { once: true });
  else void run();
})();
