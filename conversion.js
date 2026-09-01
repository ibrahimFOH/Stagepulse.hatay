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

  document.addEventListener('DOMContentLoaded', homePage, { once: true });
})();
