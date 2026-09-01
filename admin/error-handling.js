/* Stagepulse Admin — production error presentation layer
 * Keeps legacy admin.js intact while replacing misleading generic diagnostics.
 * 2026-08-21
 */
(function () {
  'use strict';

  const LEGACY_SETTLEMENT_TEXT = 'Supabase migration / RLS / settlements tablosunu kontrol et.';

  function classify(message) {
    const m = String(message || '').toLowerCase();
    if (/permission denied|row-level security|rls|42501/.test(m)) {
      return 'Bu işlem için yetkiniz yok. Admin oturumunu ve ilgili yetkiyi kontrol edin.';
    }
    if (/schema cache|could not find the table|relation .* does not exist|pgrst/.test(m)) {
      return 'Veritabanı şeması güncel değil veya ilgili kaynak bulunamadı. Sayfayı yenileyin; sorun sürerse Supabase migration durumunu kontrol edin.';
    }
    if (/duplicate|unique|23505/.test(m)) {
      return 'Bu kayıt zaten mevcut. Farklı bir değer kullanın.';
    }
    if (/violates.*constraint|23514|not-null|23502|foreign key|23503/.test(m)) {
      return 'Girilen bilgiler veritabanı kurallarına uymuyor. Form alanlarını kontrol edin.';
    }
    if (/jwt|auth|session|token|401|403/.test(m)) {
      return 'Oturum veya yetki süresi dolmuş olabilir. Yeniden giriş yapmayı deneyin.';
    }
    if (/failed to fetch|network|fetch|bağlantı/.test(m)) {
      return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
    }
    return 'İşlem sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  }

  function repairNotice(root) {
    if (!root) return;
    root.querySelectorAll('.notice').forEach((notice) => {
      const text = notice.textContent || '';
      if (!text.includes(LEGACY_SETTLEMENT_TEXT)) return;
      const paragraphs = notice.querySelectorAll('p');
      const detail = paragraphs.length ? paragraphs[0].textContent : text;
      const replacement = classify(detail);
      if (paragraphs.length > 1) {
        paragraphs[1].textContent = replacement;
      } else {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = replacement;
        notice.appendChild(p);
      }
    });
  }

  const start = () => {
    const content = document.getElementById('content');
    if (!content) return;
    repairNotice(content);
    new MutationObserver(() => repairNotice(content)).observe(content, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
