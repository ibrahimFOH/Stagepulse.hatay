#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireMatch = (condition, message) => {
  if (!condition) failures.push(message);
};

const teklif = read('teklif.html');
const publicScript = read('script.js');
const controller = read('script-controller.js');
const core = read('core.js');
const quoteFunction = read('supabase/functions/public-quote/index.ts');
const serviceWorker = read('sw.js');
const consentScript = read('consent.js');
const conversionScript = read('conversion.js');
const rootHeaders = read('_headers');
const adminHeaders = read('admin/_headers');
const portalHeaders = read('portal/_headers');
const adminHtml = read('admin/index.html');
const portalHtml = read('portal/index.html');
const adminRuntime = read('admin/admin-runtime.js');
const portalRuntime = read('portal/portal-runtime.js');
const adminBundle = read('admin/admin-bundle.js');
const adminShell = adminBundle;
const adminBridge = adminBundle;
const portalBundle = read('portal/portal-bundle.js');
const portalIsolation = portalBundle;
const portalPermissions = portalBundle;
const portalCrud = portalBundle;
const portalInventory = portalBundle;
const adminOfferFields = adminBundle;
const adminCss = read('admin/admin-bundle.css');
const quoteView = read('teklif-view.html');
const supabaseSri = 'sha384-yiVMs0R/Jyz7OhoXa/DsEMUSBLjEhr/QJta2ONO+zB6I8/GmNg/7AUFrZmAJV7KV';

requireMatch(/name=["']phone["']/.test(teklif), 'teklif.html must expose the phone field by name.');
requireMatch(publicScript.includes('/script-controller.js'), 'script.js must load the local public controller.');
requireMatch(!publicScript.includes('cdn.jsdelivr.net/gh/ibrahimFOH'), 'Public controller must not fall back to a remote repository.');
requireMatch(controller.includes('/core.js'), 'script-controller.js must load the local core controller.');
requireMatch(/\bphone\b[\s\S]*turnstile_token:turnstileToken/.test(core), 'Public quote payload must include phone and the Turnstile token.');
requireMatch(core.includes("payload.ok!==true||!payload.quote?.id"), 'Public quote UI must require a server-confirmed receipt.');
requireMatch(core.includes("sessionStorage.setItem(receiptKey") && core.includes("form.dataset.submitting==='1'"), 'Public quote UI must prevent in-flight and repeated duplicate submissions.');
requireMatch(!core.includes('window.location.assign(waUrl)'), 'WhatsApp must remain an optional action, not the quote success mechanism.');
requireMatch(conversionScript.includes("submit.type='submit'"), 'Offer enhancement must preserve native form submission.');

requireMatch(consentScript.includes("analytics_storage: 'denied'"), 'Consent defaults must deny analytics storage.');
requireMatch(consentScript.includes("state === 'accepted') loadAnalytics()"), 'Analytics must load only after explicit opt-in.');
requireMatch(consentScript.includes('cookie-preferences-reset'), 'Public consent UI must expose a preference reset control.');
requireMatch(consentScript.indexOf("global.gtag('consent', 'update'") < consentScript.indexOf("document.getElementById('sp-google-analytics')"), 'Re-consent must restore analytics permission even when the analytics script is already loaded.');
for (const name of readdirSync(root).filter(name => name.endsWith('.html'))) {
  const html = read(name);
  requireMatch(!html.includes('googletagmanager.com/gtag/js'), `${name} must not load Google Analytics before consent.`);
}

requireMatch(quoteFunction.includes('Deno.env.get("TURNSTILE_SECRET_KEY")'), 'public-quote must require TURNSTILE_SECRET_KEY.');
requireMatch(quoteFunction.includes('turnstile/v0/siteverify'), 'public-quote must call Turnstile siteverify.');
requireMatch(quoteFunction.includes('if(!TURNSTILE_SECRET_KEY)'), 'public-quote must fail closed when the Turnstile secret is absent.');
requireMatch(quoteFunction.includes(".select('id,quote_number,status')"), 'public-quote success selection must be limited to non-PII fields.');
requireMatch(!quoteFunction.includes("select('id,quote_number,status,event_date"), 'public-quote must not return the legacy PII-rich quote selection.');

requireMatch(serviceWorker.includes("url.pathname==='/admin'"), 'Service worker must recognize the admin root as authenticated.');
requireMatch(serviceWorker.includes("url.pathname==='/portal'"), 'Service worker must recognize the portal root as authenticated.');
requireMatch(/if\(isAuthenticatedPath\)\{event\.respondWith\(fetch\(request,\{cache:'no-store'\}\)\);return\}/.test(serviceWorker), 'Authenticated paths must bypass all service-worker caches.');
requireMatch(serviceWorker.includes("'/index.html'") && serviceWorker.includes('Promise.allSettled'), 'Service worker install must build a resilient offline shell.');
requireMatch(serviceWorker.includes("status:503"), 'Service worker must return an explicit offline failure response when no shell exists.');

for (const city of ['adana', 'antalya', 'gaziantep', 'hatay', 'mersin', 'sanliurfa']) {
  const html = read(`${city}/index.html`);
  requireMatch(html.includes('property="og:title"') && html.includes('"@type":"Service"'), `${city} regional page must include supported OG and Service metadata.`);
}

for (const [path, headers] of [['_headers', rootHeaders], ['admin/_headers', adminHeaders], ['portal/_headers', portalHeaders]]) {
  for (const header of ['Content-Security-Policy:', 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Referrer-Policy:', 'Permissions-Policy:']) {
    requireMatch(headers.includes(header), `${path} must set ${header}`);
  }
  requireMatch(headers.includes("frame-ancestors 'none'"), `${path} CSP must deny framing.`);
}

for (const [path, html] of [['admin/index.html', adminHtml], ['portal/index.html', portalHtml]]) {
  requireMatch(html.includes(`integrity="${supabaseSri}"`), `${path} must pin the verified Supabase JS SRI digest.`);
  requireMatch(html.includes('crossorigin="anonymous"'), `${path} must enable cross-origin SRI validation.`);
  requireMatch(!/<input[^>]+(?:id=["']login(?:Username|Password|User|Pass)["'])[^>]+name=/i.test(html), `${path} login credentials must not be successful controls during an unhandled native submit.`);
}
requireMatch(core.includes("supabase-js@2.112.4") && core.includes(`script.integrity='${supabaseSri}'`) && core.includes("script.crossOrigin='anonymous'"), 'Public Supabase loader must pin the verified asset and enforce SRI.');
requireMatch(quoteView.includes('supabase-js@2.112.4') && quoteView.includes(`integrity="${supabaseSri}"`), 'Public quote view must pin the verified Supabase asset and enforce SRI.');
requireMatch(!core.includes('supabase-js@2\''), 'Public Supabase loader must not use a floating major-version CDN URL.');
requireMatch(!quoteView.includes('supabase-js@2"'), 'Public quote view must not use a floating major-version CDN URL.');
requireMatch(!/loginForm\.(?:method|action)\s*=/.test(adminRuntime), 'Admin runtime must not add a credential POST fallback.');
requireMatch(!/loginForm\.(?:method|action)\s*=/.test(portalRuntime), 'Portal runtime must not add a credential POST fallback.');

requireMatch(adminShell.includes('detectSessionInUrl:false'), 'Admin auth must process callback credentials explicitly.');
requireMatch(adminBridge.includes('detectSessionInUrl: false'), 'Admin bridge must disable implicit URL session detection.');
requireMatch(adminShell.includes('cleanAuthUrl') && adminShell.includes('exchangeCodeForSession'), 'Admin must exchange callbacks and remove auth credentials from its URL.');
requireMatch(portalPermissions.includes('exchangeCodeForSession') && portalPermissions.includes('history.replaceState'), 'Portal must exchange callbacks and remove auth credentials from its URL.');
requireMatch(portalIsolation.includes("const role = location.pathname.startsWith('/admin/') ? 'admin' : 'staff'"), 'Supabase client creation must isolate admin and staff storage.');
requireMatch(adminShell.includes('storage:window.sessionStorage'), 'Admin auth must persist only in sessionStorage.');
requireMatch(adminBridge.includes('storage: window.sessionStorage'), 'Admin bridge must persist only in sessionStorage.');
requireMatch(portalIsolation.includes('storage: window.sessionStorage'), 'Portal auth clients must persist only in sessionStorage.');
requireMatch(adminRuntime.includes('navigator.onLine') && adminRuntime.includes('adminBootRetry') && adminRuntime.includes('aria-live="assertive"'), 'Admin boot failure must distinguish offline state and expose an accessible retry.');
requireMatch(portalRuntime.includes('navigator.onLine') && portalRuntime.includes('portalBootRetry') && portalRuntime.includes('aria-live="assertive"'), 'Portal boot failure must distinguish offline state and expose an accessible retry.');
requireMatch(!portalRuntime.includes("'inventory-ui-v3.js','inventory-ui-v4.js'"), 'Portal runtime must not load the superseded inventory boot-hook generation.');
requireMatch(portalInventory.includes('role="dialog"') && portalInventory.includes('aria-labelledby="spPInvTitle"') && portalInventory.includes('modalReturnFocus'), 'Inventory dialog must be named and restore focus.');
requireMatch(portalPermissions.includes('aria-labelledby="spPortalResetTitle"') && portalPermissions.includes("$('#spPortalPass1')?.focus()"), 'Password recovery dialog must be named and receive initial focus.');
requireMatch(adminOfferFields.includes("label.insertAdjacentElement('afterend',b)") && !adminOfferFields.includes('label.appendChild(b)'), 'Crew save control must not be nested inside its field label.');
requireMatch(adminCss.includes('@media(max-width:700px){.sp-offer-price-grid'), 'Offer inventory controls must reflow on narrow screens.');
requireMatch(!portalPermissions.includes('sp_staff_meta') && !portalCrud.includes('sp_staff_meta'), 'Staff PII and permissions must not be duplicated in localStorage.');

requireMatch(adminShell.includes('stagepulse-admin-auth-v2'), 'Canonical admin bundle must use the canonical admin storage key.');
const adminJsFiles = readdirSync(resolve(root, 'admin')).filter(name => name.endsWith('.js')).map(name => `admin/${name}`);
for (const path of adminJsFiles) {
  if (path !== 'admin/admin-bundle.js' && path !== 'admin/admin-runtime.js') {
    requireMatch(!read(path).includes('createClient(') && !read(path).includes('createClient?.('), `${path} must use the canonical admin client instead of creating a fallback.`);
  }
}

if (failures.length) {
  console.error(failures.map(message => `FAIL: ${message}`).join('\n'));
  process.exit(1);
}
console.log('Web security validation passed.');