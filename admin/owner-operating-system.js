/*
 * Stagepulse Owner Operating System compatibility marker.
 * Patron Merkezi is the single canonical executive UI.
 * Management actions are provided by stagepulse_command_action and the RBAC surface.
 * This file intentionally contains no second router, renderer, or MutationObserver.
 */
(() => {
  'use strict';
  window.STAGEPULSE_OWNER_OS_CANONICAL = 'patron-center';
})();
