/* Stagepulse Personel — secure self-service password recovery */
(() => {
  const resetUrl = `${location.origin}/portal/`;
  const $ = (s) => document.querySelector(s);
  const strong = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 128 && /[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(p) && /\d/.test(p);

  async function forgotPassword() {
    const btn = $('#forgotPasswordBtn');
    const err = $('#loginErr');
    const email = String($('#loginUser')?.value || '').trim().toLowerCase();
    if (!email || !email.includes('@')) { if (err) { err.hidden = false; err.textContent = 'Önce hesabınızda kayıtlı e-posta adresini girin.'; } return; }
    if (btn) btn.disabled = true;
    if (err) { err.hidden = false; err.textContent = 'Sıfırlama bağlantısı gönderiliyor…'; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
    if (btn) btn.disabled = false;
    if (error) { if (err) err.textContent = error.message || 'Sıfırlama e-postası gönderilemedi.'; return; }
    if (err) err.textContent = 'Eğer bu e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi. E-postanızı kontrol edin.';
  }

  function recoveryModal() {
    document.getElementById('spPortalResetModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="spPortalResetModal"><div class="modal-card"><button class="close" type="button" id="spPortalResetClose">×</button><div class="brand">STAGEPULSE</div><h2>Yeni şifre</h2><p class="muted">Yeni parolanızı belirleyin. En az 10 karakter, bir harf ve bir rakam kullanın.</p><label>Yeni şifre<input id="spPortalNewPassword" type="password" minlength="10" autocomplete="new-password"></label><label>Yeni şifre tekrar<input id="spPortalNewPassword2" type="password" minlength="10" autocomplete="new-password"></label><div class="modal-actions"><button class="btn btn-primary" id="spPortalResetSave">Şifreyi güncelle</button></div><p id="spPortalResetError" class="err" role="alert"></p></div></div>`);
    $('#spPortalResetClose')?.addEventListener('click', () => document.getElementById('spPortalResetModal')?.remove());
    $('#spPortalResetSave')?.addEventListener('click', async () => {
      const p1 = $('#spPortalNewPassword')?.value || '';
      const p2 = $('#spPortalNewPassword2')?.value || '';
      const e = $('#spPortalResetError');
      if (!strong(p1)) { e.textContent='Şifre en az 10 karakter, bir harf ve bir rakam içermeli.'; return; }
      if (p1 !== p2) { e.textContent='Şifreler eşleşmiyor.'; return; }
      const btn = $('#spPortalResetSave'); btn.disabled = true; e.textContent='';
      const { error } = await sb.auth.updateUser({ password:p1 });
      btn.disabled = false;
      if (error) { e.textContent=error.message; return; }
      await sb.auth.signOut();
      document.getElementById('spPortalResetModal')?.remove();
      if (errBox()) { errBox().hidden = false; errBox().textContent='Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.'; }
      document.getElementById('loginView')?.classList.remove('is-hidden');
      if (document.getElementById('loginView')) document.getElementById('loginView').hidden=false;
      document.getElementById('appView')?.classList.add('is-hidden');
      if (document.getElementById('appView')) document.getElementById('appView').hidden=true;
    });
  }

  function errBox() { return $('#loginErr'); }
  function initPasswordRecovery() {
    $('#forgotPasswordBtn')?.addEventListener('click', forgotPassword);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordRecovery, { once:true });
  } else {
    initPasswordRecovery();
  }
})();
