/* Stagepulse Patron Center — legacy compatibility shim.
 * Navigation ownership belongs to patron-center.js.
 * This file intentionally does not remove nodes by text/hash because two
 * legitimate UI instances can share the same label while bootstrapping.
 */
(() => {
  'use strict';
  if (window.__STAGEPULSE_PATRON_CENTER_DEDUPE_SHIM__) return;
  window.__STAGEPULSE_PATRON_CENTER_DEDUPE_SHIM__ = true;
})();
