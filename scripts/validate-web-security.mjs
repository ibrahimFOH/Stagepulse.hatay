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
const rootHeaders = read('_headers');
const adminHeaders = read('admin/_headers');
const portalHeaders = read('portal/_headers');
const adminHtml = read('admin/index.html');
const portalHtml = read('portal/index.html');
const adminRuntime = read('admin/admin-runtime.js');
const portalRuntime = read('portal/portal-runtime.js');
const adminShell = read('admin/admin.js');
const adminBridge = read('admin/admin-supabase-bridge-v1.js');
const portalIsolation = read('portal/session-isolation.js');
const portalPermissions = read('portal/portal-permissions.js');
const portalCrud = read('portal/portal-crud.js');
const quoteView = read('teklif-view.html');
const supabaseSri = 'sha384-yiVMs0R/Jyz7OhoXa/DsEMUSBLjEhr/QJta2ONO+zB6I8/GmNg/7AUFrZmAJV7KV';

requireMatch(/name=["']phone["']/.test(teklif), 'teklif.html must expose the phone field by name.');
requireMatch(publicScript.includes('/script-controller.js'), 'script.js must load the local public controller.');
requireMatch(!publicScript.includes('cdn.jsdelivr.net/gh/ibrahimFOH'), 'Public controller must not fall back to a remote repository.');
requireMatch(controller.includes('/core.js'), 'script-controller.js must load the local core controller.');
requireMatch(/\bphone\b[\s\S]*turnstile_token:turnstileToken/.test(core), 'Public quote payload must include phone and the Turnstile token.');

requireMatch(quoteFunction.includes('Deno.env.get("TURNSTILE_SECRET_KEY")'), 'public-quote must require TURNSTILE_SECRET_KEY.');
requireMatch(quoteFunction.includes('turnstile/v0/siteverify'), 'public-quote must call Turnstile siteverify.');
requireMatch(quoteFunction.includes('if(!TURNSTILE_SECRET_KEY)'), 'public-quote must fail closed when the Turnstile secret is absent.');
requireMatch(quoteFunction.includes(".select('id,quote_number,status')"), 'public-quote success selection must be limited to non-PII fields.');
requireMatch(!quoteFunction.includes("select('id,quote_number,status,event_date"), 'public-quote must not return the legacy PII-rich quote selection.');

requireMatch(serviceWorker.includes("url.pathname==='/admin'"), 'Service worker must recognize the admin root as authenticated.');
requireMatch(serviceWorker.includes("url.pathname==='/portal'"), 'Service worker must recognize the portal root as authenticated.');
requireMatch(/if\(isAuthenticatedPath\)\{event\.respondWith\(fetch\(request,\{cache:'no-store'\}\)\);return\}/.test(serviceWorker), 'Authenticated paths must bypass all service-worker caches.');

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
requireMatch(!portalPermissions.includes('sp_staff_meta') && !portalCrud.includes('sp_staff_meta'), 'Staff PII and permissions must not be duplicated in localStorage.');

const adminCreateClientFiles = [
  'admin/admin.js',
  'admin/admin-supabase-bridge-v1.js'
];
for (const path of adminCreateClientFiles) {
  requireMatch(read(path).includes('stagepulse-admin-auth-v2'), `${path} must use the canonical admin storage key.`);
}
const adminJsFiles = readdirSync(resolve(root, 'admin'))
  .filter(name => name.endsWith('.js'))
  .map(name => `admin/${name}`);
for (const path of adminJsFiles) {
  if (!adminCreateClientFiles.includes(path)) {
    requireMatch(!read(path).includes('createClient(') && !read(path).includes('createClient?.('), `${path} must use the canonical admin client instead of creating a fallback.`);
  }
}

if (failures.length) {
  console.error(failures.map(message => `FAIL: ${message}`).join('\n'));
  process.exit(1);
}
console.log('Web security validation passed.');