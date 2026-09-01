/* Stagepulse Admin — hardened Personnel service fallback */
(() => {
  'use strict';
  const original = window.personnelView;
  async function healthy() {
    try {
      if (typeof original === 'function') {
        await original();
        const content = document.querySelector('#content');
        const failed = content && /Personel servisi kullanılamıyor|İşlem başarısız/i.test(content.textContent || '');
        if (!failed) return;
      }
      if (typeof window.loadView === 'function' && window.loadView !== healthy) {
        await window.loadView('personnel');
      }
    } catch (e) {
      console.error('Personnel service heal:', e);
    }
  }
  window.personnelView = healthy;
  window.staffModal = window.staffModal || (() => {});
})();
