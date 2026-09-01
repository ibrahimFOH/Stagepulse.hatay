/* Stagepulse organization dashboard launcher */
(function(){
 'use strict';
 function boot(){
  if(document.getElementById('orgDashboardNav')) return;
  var nav=document.getElementById('sideNav'); if(!nav)return;
  var b=document.createElement('button'); b.id='orgDashboardNav'; b.type='button'; b.textContent='Şirket Yönetimi';
  b.addEventListener('click',function(){ location.hash='organization'; window.dispatchEvent(new CustomEvent('stagepulse-organization-open')); });
  nav.insertBefore(b,document.getElementById('companyOrgNav')||document.getElementById('logoutBtn'));
 }
 window.addEventListener('stagepulse-admin-ready',boot); document.addEventListener('DOMContentLoaded',boot); setTimeout(boot,1200);
})();
