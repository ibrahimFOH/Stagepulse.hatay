/**
 * Stagepulse runtime config (client-safe values only).
 *
 * - Supabase publishable/anon key and Firebase Web config are designed to live in the browser.
 * - Never put service_role, Firebase Admin private keys, or signing secrets here.
 *
 * Override without editing this file:
 *   1) Set window.__STAGEPULSE_RUNTIME_OVERRIDE__ before this script loads, or
 *   2) CI/GitHub Actions can regenerate this file from repository secrets
 *      (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, Firebase web keys).
 */
(function (global) {
  'use strict';

  var OVERRIDE = global.__STAGEPULSE_RUNTIME_OVERRIDE__ || {};

  var DEFAULTS = {
    supabaseUrl: 'https://mtjcqqrogjqaxkagwkti.supabase.co',
    supabasePublishableKey: 'sb_publishable_yR_HlWlFbYYq22tQmiB9LA_acq6bQi6',
    siteAiUrl: null,
    fcm: {
      apiKey: 'AIzaSyBZbLD2HpnrCDy4KJh9FUbwgBbI0m-jdeo',
      authDomain: 'stagepulse-905be.firebaseapp.com',
      projectId: 'stagepulse-905be',
      storageBucket: 'stagepulse-905be.firebasestorage.app',
      messagingSenderId: '163274034334',
      appId: '1:163274034334:web:844791f51bef484d33bf8f',
      measurementId: 'G-4BFSFS0SGM',
      vapidKey: 'BOPkjOlp10RVFRaJQtDx2l8v2uzLVrBTcv2EgTthRiSNGA3IbOAc6f24mGJJrQuice0FQtG3dxbB6Ae54gQS7tE'
    }
  };

  function pick(key) {
    if (OVERRIDE[key] != null && OVERRIDE[key] !== '') return OVERRIDE[key];
    return null;
  }

  var url = pick('supabaseUrl') || DEFAULTS.supabaseUrl;
  var key = pick('supabasePublishableKey') || DEFAULTS.supabasePublishableKey;
  var siteAi = pick('siteAiUrl') || (url ? url.replace(/\/$/, '') + '/functions/v1/site-ai' : DEFAULTS.supabaseUrl + '/functions/v1/site-ai');

  var fcm = {
    apiKey: (OVERRIDE.fcm && OVERRIDE.fcm.apiKey) || DEFAULTS.fcm.apiKey,
    authDomain: (OVERRIDE.fcm && OVERRIDE.fcm.authDomain) || DEFAULTS.fcm.authDomain,
    projectId: (OVERRIDE.fcm && OVERRIDE.fcm.projectId) || DEFAULTS.fcm.projectId,
    storageBucket: (OVERRIDE.fcm && OVERRIDE.fcm.storageBucket) || DEFAULTS.fcm.storageBucket,
    messagingSenderId: (OVERRIDE.fcm && OVERRIDE.fcm.messagingSenderId) || DEFAULTS.fcm.messagingSenderId,
    appId: (OVERRIDE.fcm && OVERRIDE.fcm.appId) || DEFAULTS.fcm.appId,
    measurementId: (OVERRIDE.fcm && OVERRIDE.fcm.measurementId) || DEFAULTS.fcm.measurementId,
    vapidKey: (OVERRIDE.fcm && OVERRIDE.fcm.vapidKey) || DEFAULTS.fcm.vapidKey
  };

  var runtime = Object.freeze({
    supabaseUrl: url,
    supabasePublishableKey: key,
    siteAiUrl: siteAi,
    fcm: Object.freeze(fcm)
  });

  global.STAGEPULSE_RUNTIME = runtime;

  // Keep legacy global used by service worker / FCM register scripts.
  global.STAGEPULSE_FCM_CONFIG = Object.freeze(Object.assign({}, fcm));
})(typeof globalThis !== 'undefined' ? globalThis : window);
