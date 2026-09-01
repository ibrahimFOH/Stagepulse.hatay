/* Stagepulse Admin — crew count compatibility shim v3.
 * The stable offer editor owns the crew field. This file must not observe DOM
 * mutations or rewrite values while the user is typing.
 */
(() => {
  'use strict';
  window.__stagepulseCrewCountFixBoundV3 = true;
})();
