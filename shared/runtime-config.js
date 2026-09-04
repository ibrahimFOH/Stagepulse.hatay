/**
 * Stagepulse runtime config (client-safe values only).
 * Never put service_role, Firebase Admin private keys, or signing secrets here.
 */
(function (global) {
  'use strict';
  var OVERRIDE = global.__STAGEPULSE_RUNTIME_OVERRIDE__ || {};
  var DEFAULTS = {
    supabaseUrl: 'https://mtjcqqrogjqaxkagwkti.supabase.co',
    supabasePublishableKey: 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6',
    siteAiUrl: null,
    fcm: {
      apiKey: 'AIzaSyBZbLD2hpnrCDy4KJh9FUbwgBbI0m-jdeo',
      authDomain: 'stagepulse-905be.firebaseapp.com',
      projectId: 'stagepulse-905be',
      storageBucket: 'stagepulse-905be.firebasestorage.app',
      messagingSenderId: '163274034334',
      appId: '1:163274034334:web:844791f51bef484d33bf8f',
      measurementId: 'G-4BFSFS0SGM',
      vapidKey: 'BOPkjOlp10RVFRaJQtDx2l8v2uzLVrBTcv2EgTthRiSNGA3IbOAc6f24mGJJrQuice0FQtG3dxbB6Ae54gQS7tE'
    }
  };
  function pick(key) { return OVERRIDE[key] != null && OVERRIDE[key] !== '' ? OVERRIDE[key] : null; }
  var url = pick('supabaseUrl') || DEFAULTS.supabaseUrl;
  var key = pick('supabasePublishableKey') || DEFAULTS.supabasePublishableKey;
  var siteAi = pick('siteAiUrl') || (url ? url.replace(/\/$/, '') + '/functions/v1/site-ai' : DEFAULTS.supabaseUrl + '/functions/v1/site-ai');
  var fcm = {
    apiKey:(OVERRIDE.fcm&&OVERRIDE.fcm.apiKey)||DEFAULTS.fcm.apiKey, authDomain:(OVERRIDE.fcm&&OVERRIDE.fcm.authDomain)||DEFAULTS.fcm.authDomain,
    projectId:(OVERRIDE.fcm&&OVERRIDE.fcm.projectId)||DEFAULTS.fcm.projectId, storageBucket:(OVERRIDE.fcm&&OVERRIDE.fcm.storageBucket)||DEFAULTS.fcm.storageBucket,
    messagingSenderId:(OVERRIDE.fcm&&OVERRIDE.fcm.messagingSenderId)||DEFAULTS.fcm.messagingSenderId, appId:(OVERRIDE.fcm&&OVERRIDE.fcm.appId)||DEFAULTS.fcm.appId,
    measurementId:(OVERRIDE.fcm&&OVERRIDE.fcm.measurementId)||DEFAULTS.fcm.measurementId, vapidKey:(OVERRIDE.fcm&&OVERRIDE.fcm.vapidKey)||DEFAULTS.fcm.vapidKey
  };
  global.STAGEPULSE_RUNTIME = Object.freeze({supabaseUrl:url,supabasePublishableKey:key,siteAiUrl:siteAi,fcm:Object.freeze(fcm)});
  global.STAGEPULSE_FCM_CONFIG = Object.freeze(Object.assign({},fcm));
  if (global.location && /^\/admin\//.test(global.location.pathname)) {
    [['link','stylesheet','admin-visual-overhaul.css?v=20260903-1'],['link','stylesheet','patron-center.css?v=20260903-3'],['script','', 'patron-center.js?v=20260903-3'],['link','stylesheet','owner-operating-system.css?v=20260903-3'],['script','', 'owner-operating-system.js?v=20260903-3'],['script','', 'command-center.js?v=20260904-1'],['link','stylesheet','admin-theme-final.css?v=20260904-2']].forEach(function(x){var e=document.createElement(x[0]);if(x[1])e.rel=x[1];if(x[0]==='script')e.src=x[2];else e.href=x[2];e.defer=false;document.head.appendChild(e);});
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);