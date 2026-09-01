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