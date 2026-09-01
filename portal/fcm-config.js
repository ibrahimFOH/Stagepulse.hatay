/* Stagepulse FCM config — delegates to shared/runtime-config.js when present. */
(function (global) {
  'use strict';
  if (global.STAGEPULSE_FCM_CONFIG && global.STAGEPULSE_FCM_CONFIG.apiKey) return;
  // Fallback if runtime-config was not loaded (e.g. SW importScripts order).
  global.STAGEPULSE_FCM_CONFIG = Object.freeze({
    apiKey: 'AIzaSyBZbLD2HpnrCDy4KJh9FUbwgBbI0m-jdeo',
    authDomain: 'stagepulse-905be.firebaseapp.com',
    projectId: 'stagepulse-905be',
    storageBucket: 'stagepulse-905be.firebasestorage.app',
    messagingSenderId: '163274034334',
    appId: '1:163274034334:web:844791f51bef484d33bf8f',
    measurementId: 'G-4BFSFS0SGM',
    vapidKey: 'BOPkjOlp10RVFRaJQtDx2l8v2uzLVrBTcv2EgTthRiSNGA3IbOAc6f24mGJJrQuice0FQtG3dxbB6Ae54gQS7tE'
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
