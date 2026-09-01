/* Stagepulse OTA web update layer. Public version and internal build are separate. */
(() => {
  'use strict';
  const VERSION_URL = '/app-update.json';
  const STORAGE_KEY = 'stagepulse-web-build';
  const LAST_DAILY_CHECK_KEY = 'stagepulse-last-daily-update-check';
  let reloadScheduled = false;
  let midnightTimer = null;

  function currentBuild() { return localStorage.getItem(STORAGE_KEY) || ''; }
  function setBuild(build) { if (build) localStorage.setItem(STORAGE_KEY, String(build)); }
  function todayKey() { const now=new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }

  function showUpdateNotice() {
    if (document.getElementById('stagepulse-update-notice')) return;
    const notice=document.createElement('div'); notice.id='stagepulse-update-notice'; notice.setAttribute('role','status');
    notice.innerHTML='<strong>Yeni Stagepulse sürümü hazır</strong><span>Uygulama güncelleniyor…</span>';
    Object.assign(notice.style,{position:'fixed',left:'16px',right:'16px',bottom:'16px',zIndex:'2147483647',padding:'14px 16px',borderRadius:'12px',background:'#111',color:'#fff',border:'1px solid #333',boxShadow:'0 12px 40px rgba(0,0,0,.35)',fontFamily:'Inter,system-ui,sans-serif',fontSize:'14px'});
    notice.querySelector('span').style.display='block'; notice.querySelector('span').style.marginTop='4px'; notice.querySelector('span').style.color='#aaa'; document.body.appendChild(notice);
  }

  async function checkForUpdate() {
    if (reloadScheduled || !navigator.onLine) return false;
    try {
      const response=await fetch(`${VERSION_URL}?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin',headers:{'Cache-Control':'no-cache'}});
      if(!response.ok)return false;
      const info=await response.json();
      if(!info||!['verified','no_verified_release'].includes(info.status)||!info.staff)return false;
      const version=String(info.staff.web_version||'').trim();
      if(!version)return false;
      const build=String(info.release||`${version}:${info.updated_at||''}`);
      const local=currentBuild();
      if(!local){setBuild(build);return true;}
      if(local===build)return true;
      showUpdateNotice(); reloadScheduled=true; setBuild(build); setTimeout(()=>window.location.reload(),500); return true;
    } catch (_) { return false; }
  }

  async function dailyCheck(){const today=todayKey();if(localStorage.getItem(LAST_DAILY_CHECK_KEY)===today)return true;const successful=await checkForUpdate();if(successful)localStorage.setItem(LAST_DAILY_CHECK_KEY,today);scheduleNextMidnight();return successful;}
  function scheduleNextMidnight(){if(midnightTimer)clearTimeout(midnightTimer);const now=new Date();const next=new Date(now);next.setHours(24,0,0,0);midnightTimer=setTimeout(()=>dailyCheck(),Math.max(1000,next.getTime()-now.getTime()));}
  window.StagepulseWebUpdate={check:checkForUpdate,dailyCheck,version:()=> '2.3.0'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{checkForUpdate();dailyCheck();},{once:true});else{checkForUpdate();dailyCheck();}
  scheduleNextMidnight(); window.addEventListener('online',dailyCheck);
})();
