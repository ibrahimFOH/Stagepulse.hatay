/* Stagepulse public visual/media resilience — canonical LFS-safe loader. */
(function(){'use strict';
  /* GitHub Pages cannot serve Git-LFS pointer files as browser images. Use GitHub's media CDN. */
  var MEDIA='https://media.githubusercontent.com/media/ibrahimFOH/Stagepulse.hatay/main/';
  var gallery=['images/gallery/0EAAE007-14C6-468D-80CB-6C5275CB6827.webp','images/gallery/1028BA7C-0A7F-49DF-B2DE-896109D700EC.webp','images/gallery/11AD6679-02D7-4ADC-87AA-92059E510189.webp','images/gallery/2025-12-10_22-07-22_1.webp','images/gallery/35E63E2A-949E-4AD5-AE11-E607E868C697.webp','images/gallery/BFAD4788-CF18-4F44-BAA3-43060965EEEA.webp','images/gallery/DE228FEA-36C1-4CCD-9185-0E03014CD491.webp'];
  var documentTitles={'1788024626325-ae485221-Nihat-Mugil-Teknik-Rider.pdf':'Nihat Mugil — Teknik Rider','1788036100874-616dc7a9-Stagepulse-Ornek-3D-Sahne.pdf':'Stagepulse — Örnek 3D Sahne','1788036103761-ed6d59aa-Stagepulse-Ornek-Stage-Plot-Gorsel.pdf':'Stagepulse — Örnek Stage Plot','1788036107082-52283224-Stagepulse-Ornek-Teknik-Kesit.pdf':'Stagepulse — Örnek Teknik Kesit'};
  function media(p){return MEDIA+p.replace(/^\//,'');}
  function inject(){if(document.getElementById('sp-public-visual-fix'))return;var s=document.createElement('style');s.id='sp-public-visual-fix';s.textContent='a.card,a.card:visited,a.card:hover,a.card:active,.card,.card:visited,.project-card,.project-card:visited,.project-card:hover,.region-card,.region-card:visited{color:#fff!important;text-decoration:none!important}a.card h2,a.card h3,.card h2,.card h3,.card p,.card:visited h2,.card:visited h3,.project-card h3,.region-card h3{color:inherit!important;text-decoration:none!important}.footer-links a,.footer-links a:visited,.footer-contact a,.footer-contact a:visited,.nav-links a,.nav-links a:visited{color:#ccc!important;text-decoration:none!important}.footer-links a:hover,.footer-contact a:hover,.nav-links a:hover,.nav-links a.active{color:#ffb000!important}.doc-item,.doc-item:visited,.doc-item:hover{color:#fff!important;text-decoration:none!important}.doc-item span,.doc-item:visited span{color:#fff!important;text-decoration:none!important}.doc-item small{color:#888!important}.hero-bg{background-repeat:no-repeat!important;background-position:center!important;background-size:cover!important}';document.head.appendChild(s)}
  function repairGallery(){
    document.querySelectorAll('img').forEach(function(img){
      var src=img.getAttribute('src')||'';
      var marker=src.indexOf('images/gallery/');
      if(marker<0)return;
      var path=src.slice(marker).split(/[?#]/)[0];
      if(gallery.indexOf(path)<0)return;
      var fallback=media(path);
      if(img.src!==fallback && img.dataset.spMediaSrc!==fallback){
        img.dataset.spMediaSrc=fallback;
        img.src=fallback;
      }
      if(!img.dataset.spErrorBound){
        img.dataset.spErrorBound='1';
        img.addEventListener('error',function(){img.dataset.spMediaFailed='1';});
      }
    });
  }
  function repairDocs(){document.querySelectorAll('.doc-item').forEach(function(a){var span=a.querySelector('span');if(!span)return;var path=(a.getAttribute('href')||'').split('/').pop();var title=documentTitles[path]||(a.dataset.title||'').trim();if(title)span.textContent=title;else{var n=(span.textContent||'').replace(/\.pdf$/i,'').replace(/^\d+[-_][a-z0-9]+[-_]/i,'').replace(/[-_]+/g,' ');if(n)span.textContent=n}})}
  function heroFlow(){
    var bg=document.getElementById('heroBg');
    if(!bg)return;
    var urls=gallery.map(media),i=0,timer=null;
    function next(){
      var u=urls[i%urls.length],pre=new Image();
      pre.onload=function(){bg.style.backgroundImage='linear-gradient(110deg,rgba(0,0,0,.88),rgba(0,0,0,.45)),url("'+u+'")';i++};
      pre.onerror=function(){i++;};
      pre.src=u;
    }
    next();
    timer=setInterval(next,7000);
    bg.dataset.spHeroReady='1';
    return timer;
  }
  function boot(){inject();repairGallery();repairDocs();heroFlow()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  new MutationObserver(function(){repairGallery();repairDocs()}).observe(document.documentElement,{childList:true,subtree:true});
})();
