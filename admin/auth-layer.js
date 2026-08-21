/* Stagepulse Admin — Supabase Auth + password recovery */
(() => {
  const loginForm = document.getElementById('loginForm');
  const forgot = document.getElementById('forgotPasswordBtn');
  const errorBox = document.getElementById('loginError');
  const noticeBox = document.getElementById('resetNotice');
  const resetUrl = `${location.origin}/admin/`;
  const strong = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 128 && /[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p) && /\d/.test(p);

  function resetModal() {
    document.getElementById('spResetModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="spResetModal"><div class="modal-card sp-reset-card"><button class="close" type="button" onclick="document.getElementById('spResetModal').remove()">×</button><div class="auth-mark">SP</div><h2>Yeni şifre</h2><p class="muted">Yeni parolanızı belirleyin. En az 10 karakter, bir harf ve bir rakam kullanın.</p><label>Yeni şifre<input id="spNewPassword" type="password" minlength="10" autocomplete="new-password"></label><label>Yeni şifre tekrar<input id="spNewPassword2" type="password" minlength="10" autocomplete="new-password"></label><div class="modal-actions"><button class="btn btn-primary" id="spResetSave">Şifreyi güncelle</button></div><p id="spResetError" class="form-error"></p></div></div>`);
    document.getElementById('spResetSave')?.addEventListener('click', async () => {
      const p1 = document.getElementById('spNewPassword')?.value || '';
      const p2 = document.getElementById('spNewPassword2')?.value || '';
      const e = document.getElementById('spResetError');
      if (!strong(p1)) { e.textContent='Şifre en az 10 karakter, bir harf ve bir rakam içermeli.'; return; }
      if (p1 !== p2) { e.textContent='Şifreler eşleşmiyor.'; return; }
      const btn = document.getElementById('spResetSave'); btn.disabled=true; e.textContent='';
      const { error } = await sb.auth.updateUser({ password:p1 });
      btn.disabled=false;
      if (error) { e.textContent=error.message; return; }
      await sb.auth.signOut();
      document.getElementById('spResetModal')?.remove();
      if (noticeBox) noticeBox.textContent='Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.';
      showLogin();
    });
  }

  async function forgotFlow() {
    const email = window.prompt('Şifre sıfırlama e-postası hangi adrese gönderilsin?');
    if (!email || !email.includes('@')) return;
    forgot.disabled=true;
    if (noticeBox) noticeBox.textContent='Sıfırlama e-postası gönderiliyor…';
    if (errorBox) errorBox.textContent='';
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetUrl });
    forgot.disabled=false;
    if (error) { if (errorBox) errorBox.textContent=error.message; if (noticeBox) noticeBox.textContent=''; return; }
    if (noticeBox) noticeBox.textContent='Sıfırlama bağlantısı gönderildi. E-postanızı kontrol edin.';
  }

  window.addEventListener('stagepulse:auth-recovery', resetModal);
  sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') window.dispatchEvent(new Event('stagepulse:auth-recovery')); });
  forgot?.addEventListener('click', forgotFlow);

  async function loginV2(e) {
    e.preventDefault(); e.stopImmediatePropagation();
    const username = document.getElementById('loginUsername')?.value?.trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value || '';
    if (errorBox) errorBox.textContent='';
    const btn=document.getElementById('loginBtn'); btn.disabled=true; btn.textContent='Giriş…';
    try {
      const j = await apiFetch(`${SUPABASE_URL}/functions/v1/admin-login`, { method:'POST', headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY}, body:JSON.stringify({username,password}) });
      await sb.auth.setSession({access_token:j.session.access_token,refresh_token:j.session.refresh_token});
      await guard((await sb.auth.getSession()).data.session);
    } catch(ex) { if(errorBox) errorBox.textContent=ex.message||'Giriş başarısız'; }
    finally { btn.disabled=false; btn.textContent='Giriş Yap'; }
  }
  loginForm?.addEventListener('submit', loginV2, true);
})();
