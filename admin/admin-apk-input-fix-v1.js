/* Stagepulse Admin — Android WebView input stability v3.
 * This file intentionally does not move, focus, blur, or refocus form controls.
 * Android/WebView owns keyboard and focus behavior; DOM observers must not react
 * to keyboard/viewport changes.
 */
(() => {
  'use strict';
  const STYLE = 'sp-apk-input-fix-style-v3';
  if (document.getElementById(STYLE)) return;
  const style = document.createElement('style');
  style.id = STYLE;
  style.textContent = `
    .modal.sp-apk-modal { align-items:flex-start !important; padding-top:max(12px,env(safe-area-inset-top)) !important; padding-bottom:max(12px,env(safe-area-inset-bottom)) !important; }
    .modal.sp-apk-modal .modal-card { max-height:calc(100dvh - 24px) !important; min-height:0; overflow-y:auto !important; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
    .modal.sp-apk-modal input, .modal.sp-apk-modal select, .modal.sp-apk-modal textarea { touch-action:manipulation; }
  `;
  document.head.appendChild(style);
  const mark = () => document.getElementById('offerModal')?.classList.add('sp-apk-modal');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark, {once:true});
  else mark();
})();
