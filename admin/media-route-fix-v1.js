/* Stagepulse Admin — force Media route through the unified media manager */
(function(){'use strict';
  function mediaButton(){return document.querySelector('#sideNav [data-view="media"]');}
  async function openMedia(){
    try{
      if(typeof window.loadView==='function'){
        await window.loadView('media');
        if(location.hash!=='#media') history.replaceState(null,'','#media');
        var t=document.getElementById('viewTitle'),s=document.getElementById('viewSubtitle');
        if(t)t.textContent='Medya'; if(s)s.textContent='Fotoğraf · Video · PDF';
        return true;
      }
    }catch(e){
      var c=document.getElementById('content');
      if(c)c.innerHTML='<section class="admin-card"><h2>Medya</h2><p class="form-error">Medya yöneticisi yüklenemedi: '+String(e&&e.message||e).replace(/[&<>"']/g,'')+'</p></section>';
    }
    return false;
  }
  function bind(){
    var b=mediaButton();
    if(b&&!b.__spMediaRoute){
      b.__spMediaRoute=true;
      b.addEventListener('click',function(ev){ev.preventDefault();ev.stopImmediatePropagation();openMedia();},true);
    }
    if(location.hash==='#media') openMedia();
  }
  window.addEventListener('stagepulse-admin-ready',function(){setTimeout(bind,50)});
  window.addEventListener('hashchange',function(){if(location.hash==='#media')openMedia()});
  document.addEventListener('DOMContentLoaded',bind);
  var n=0;var timer=setInterval(function(){bind();if(++n>80)clearInterval(timer)},250);

  // Load the final offer-PDF route fix after all admin scripts are present.
  var pdfFix=document.createElement('script');
  pdfFix.src='offer-pdf-route-fix-v1.js?v=20260829-01';
  document.head.appendChild(pdfFix);
})();
