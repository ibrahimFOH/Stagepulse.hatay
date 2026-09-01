(() => {
  'use strict';

  // Public homepage conversion content only.
  // IMPORTANT: the public teklif.html form is intentionally left untouched.
  function homePage() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.sp-conversion-strip')) return;

    const strip = document.createElement('div');
    strip.className = 'sp-conversion-strip';
    strip.innerHTML = [
      '<div class="sp-conv-card"><b>Projeye göre sistem</b><span>Etkinliğin ölçeğine göre ses, monitor, FOH ve teknik planlama.</span></div>',
      '<div class="sp-conv-card"><b>Net teklif süreci</b><span>İhtiyacınızı kısa şekilde iletin; gereksiz form kalabalığı yok.</span></div>',
      '<div class="sp-conv-card"><b>Doğrudan iletişim</b><span>İsterseniz teklif sonrasında WhatsApp üzerinden devam edin.</span></div>'
    ].join('');
    hero.appendChild(strip);
  }

  // Keep the legacy public teklif form a real native form submission.
  function preserveOfferSubmission() {
    const form = document.getElementById('offerForm');
    if (!form) return;
    const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    if (submit) submit.type = 'submit';
  }

  document.addEventListener('DOMContentLoaded', () => {
    homePage();
    preserveOfferSubmission();
  }, { once: true });
})();
