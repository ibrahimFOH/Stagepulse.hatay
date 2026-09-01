(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function initOfferExperience() {
    const form = $('#offerForm');
    if (!form || form.dataset.spUxReady === '1') return;
    form.dataset.spUxReady = '1';
    const hero = $('.page-hero .container') || $('.offer-section');
    if (!hero) return;
    const required = $('#offerForm .required-note');
    const groups = $$('.form-group', form).filter(g => !g.closest('#turnstileWrap'));
    const byId = id => document.getElementById(id);
    const groupFor = id => { const el = byId(id); return el ? el.closest('.form-group') : null; };
    const sections = [
      {key:'event',number:'01',eyebrow:'PROJE',title:'Etkinliğinizi tanımlayın',text:'Etkinliğin temel bilgilerini girin. Buna göre doğru sistemi değerlendirelim.',ids:['eventType','type','location','people','eventDate']},
      {key:'contact',number:'02',eyebrow:'İLETİŞİM',title:'Size nasıl ulaşalım?',text:'Teklifinizi hazırladığımızda doğrudan size ulaşabilmemiz için iletişim bilgilerinizi bırakın.',ids:['name','company','phone','email']},
      {key:'details',number:'03',eyebrow:'DETAY',title:'İhtiyacınızı anlatın',text:'Sahne, grup, ekipman veya özel teknik beklentinizi kısa şekilde yazmanız yeterli.',ids:['message']}
    ];
    const shell = document.createElement('div'); shell.className='sp-offer-shell';
    const intro = document.createElement('div'); intro.className='sp-offer-intro';
    intro.innerHTML=`<span class="sp-kicker">STAGEPULSE / TEKLİF</span><h2>Projeniz için doğru sistemi birlikte oluşturalım.</h2><p>Etkinliğinizin ölçeğini ve teknik ihtiyacınızı anlayalım; ardından size uygun çözümü hazırlayalım.</p><div class="sp-trust-list"><div><span>01</span><b>İhtiyacınızı anlayalım</b><small>Etkinlik, lokasyon ve ölçek.</small></div><div><span>02</span><b>Teknik çözümü planlayalım</b><small>Ses, FOH, monitor, ışık ve operasyon.</small></div><div><span>03</span><b>Teklifi netleştirelim</b><small>Ekibimiz üzerinden takip ve iletişim.</small></div></div><div class="sp-direct-contact"><span>Acil bir iş mi?</span><a href="https://wa.me/905320683012?text=Merhaba%2C%20Stagepulse%20i%C3%A7in%20acil%20bir%20teklif%20hakk%C4%B1nda%20g%C3%B6r%C3%BC%C5%9Fmek%20istiyorum." target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp'tan ulaş</a></div>`;
    const workspace=document.createElement('div');workspace.className='sp-offer-workspace';
    const progress=document.createElement('div');progress.className='sp-offer-progress';progress.innerHTML=sections.map((s,i)=>`<button type="button" class="sp-progress-item ${i===0?'is-current':''}" data-sp-jump="${s.key}"><span>${s.number}</span><b>${s.eyebrow}</b></button>`).join('');
    const cards=document.createElement('div');cards.className='sp-offer-cards';
    sections.forEach((section,index)=>{const card=document.createElement('section');card.className=`sp-offer-section ${index===0?'is-open':''}`;card.dataset.spSection=section.key;const head=document.createElement('button');head.type='button';head.className='sp-section-head';head.id=`sp-section-head-${section.key}`;head.setAttribute('aria-expanded',index===0?'true':'false');head.setAttribute('aria-controls',`sp-section-body-${section.key}`);head.innerHTML=`<span class="sp-section-number">${section.number}</span><span class="sp-section-copy"><small>${section.eyebrow}</small><strong>${section.title}</strong><em>${section.text}</em></span><span class="sp-section-toggle" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>`;const body=document.createElement('div');body.className='sp-section-body';body.id=`sp-section-body-${section.key}`;body.setAttribute('aria-labelledby',head.id);section.ids.forEach(id=>{const group=groupFor(id);if(group)body.appendChild(group)});card.appendChild(head);card.appendChild(body);cards.appendChild(card);head.addEventListener('click',()=>{const open=card.classList.contains('is-open');$$('.sp-offer-section',cards).forEach(x=>{x.classList.remove('is-open');$('.sp-section-head',x)?.setAttribute('aria-expanded','false')});if(!open){card.classList.add('is-open');head.setAttribute('aria-expanded','true')}updateProgress(section.key);});});
    const footer=document.createElement('div');footer.className='sp-offer-submit-area';
    const kvkk=$('.kvkk-label',form),turnstile=$('#turnstileWrap'),submit=$('button[type="submit"]',form),success=$('#formSuccess'),error=$('#formError'),honeypot=form.querySelector('input[name="website"]');
    if(honeypot){const hpWrap=honeypot.closest('.form-group')||honeypot;footer.appendChild(hpWrap)}
    if(turnstile)footer.appendChild(turnstile);if(kvkk)footer.appendChild(kvkk);
    const submitRow=document.createElement('div');submitRow.className='sp-submit-row';
    if(submit){submit.classList.add('sp-final-submit');submit.type='submit';submit.removeAttribute('form');submitRow.appendChild(submit)}
    const submitNote=document.createElement('div');submitNote.className='sp-submit-note';submitNote.innerHTML='<i class="fa-solid fa-shield-halved"></i> Bilgileriniz yalnızca teklif ve iletişim süreci için kullanılır.';submitRow.appendChild(submitNote);footer.appendChild(submitRow);
    if(error)footer.appendChild(error);if(success)footer.appendChild(success);
    form.innerHTML='';form.classList.add('sp-offer-form');form.appendChild(progress);form.appendChild(cards);form.appendChild(footer);workspace.appendChild(form);shell.appendChild(intro);shell.appendChild(workspace);hero.appendChild(shell);
    if(required){required.remove();hero.insertBefore(required,shell)}
    $$('[data-sp-jump]',progress).forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.spJump;const card=$(`[data-sp-section="${key}"]`,cards);if(!card)return;$$('.sp-offer-section',cards).forEach(x=>{x.classList.remove('is-open');$('.sp-section-head',x)?.setAttribute('aria-expanded','false')});card.classList.add('is-open');$('.sp-section-head',card)?.setAttribute('aria-expanded','true');card.scrollIntoView({behavior:'smooth',block:'start'});updateProgress(key)}));
    function updateProgress(activeKey){$$('[data-sp-jump]',progress).forEach(btn=>btn.classList.toggle('is-current',btn.dataset.spJump===activeKey));}
    $$('.sp-offer-section input, .sp-offer-section select, .sp-offer-section textarea',cards).forEach(field=>field.addEventListener('focus',()=>{const card=field.closest('.sp-offer-section');if(!card)return;$$('.sp-offer-section',cards).forEach(x=>x.classList.remove('is-open'));card.classList.add('is-open');updateProgress(card.dataset.spSection)}));
    const summary=document.createElement('div');summary.className='sp-live-summary';summary.innerHTML='<small>TALEP ÖZETİ</small><strong id="spSummaryTitle">Etkinliğinizi tanımlayın</strong><span id="spSummaryText">Bilgileri doldurdukça burada kısa bir özet oluşacak.</span>';workspace.insertBefore(summary,cards);
    const refreshSummary=()=>{const event=byId('eventType')?.value||'',service=byId('type')?.value||'',location=byId('location')?.value||'',people=byId('people')?.value||'',parts=[event,service,location,people?`${people} kişi`:'' ].filter(Boolean);$('#spSummaryTitle').textContent=parts[0]||'Etkinliğinizi tanımlayın';$('#spSummaryText').textContent=parts.length>1?parts.slice(1).join(' · '):'Bilgileri doldurdukça burada kısa bir özet oluşacak.'};
    ['eventType','type','location','people'].forEach(id=>{byId(id)?.addEventListener('input',refreshSummary);byId(id)?.addEventListener('change',refreshSummary)});refreshSummary();
  }

  function homePage(){const hero=$('.hero');if(!hero||$('.sp-conversion-strip'))return;const strip=document.createElement('div');strip.className='sp-conversion-strip';strip.innerHTML='<div class="sp-conv-card"><b>Projeye göre sistem</b><span>Etkinliğin ölçeğine göre ses, monitor, FOH ve teknik planlama.</span></div><div class="sp-conv-card"><b>Net teklif süreci</b><span>İhtiyacınızı kısa şekilde iletin; gereksiz form kalabalığı yok.</span></div><div class="sp-conv-card"><b>Doğrudan iletişim</b><span>İsterseniz teklif sonrasında WhatsApp üzerinden devam edin.</span></div>';hero.appendChild(strip)}

  document.addEventListener('DOMContentLoaded',()=>{initOfferExperience();homePage();});
})();
