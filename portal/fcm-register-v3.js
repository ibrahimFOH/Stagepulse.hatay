/* Stagepulse FCM registration compatibility entrypoint. The canonical portal bundle owns runtime registration. */
(() => {
  'use strict';
  const api = {
    register_notification_device: async (payload = {}) => {
      window.dispatchEvent(new CustomEvent('stagepulse:push-register-request', { detail: payload }));
      return false;
    }
  };
  window.StagepulseFCM = Object.assign(window.StagepulseFCM || {}, api);
})();
