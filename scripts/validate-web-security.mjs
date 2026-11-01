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
const quoteAclMigration = read('supabase/migrations/20261101074347_public_quote_rpc_anon_only_acl.sql');
const searchPathMigration = read('supabase/migrations/20261101074641_pin_search_path_public_security_definers.sql');
const fcmRegistryMigration = read('supabase/migrations/20261101074856_stagepulse_fcm_device_registry.sql');
const registerAndroidFunction = read('supabase/functions/register-android-device/index.ts');
const productionOsMigration = read('supabase/migrations/20261101075342_stagepulse_production_os_schema.sql');
const productionOsTimestampMigration = read('supabase/migrations/20261101075503_production_os_created_at_columns.sql');
const productionOsAccessMigration = read('supabase/migrations/20261101114500_stagepulse_production_os_access_hardening.sql');
const productionOsFunction = read('supabase/functions/production-os/index.ts');
const fcmDispatchMigration = read('supabase/migrations/20261101114000_stagepulse_fcm_dispatch_retry.sql');
const notificationRecipientMigration = read('supabase/migrations/20261101121000_restore_notification_recipient_scoping_and_fcm_targeting.sql');
const notificationSchema = read('supabase/schema.sql');
const fcmSenderFunction = read('supabase/functions/send-fcm-notification/index.ts');
const licenseDenyMigration = read('supabase/migrations/20261101075844_explicit_deny_client_license_core_tables.sql');
const licenseCoreFunction = read('supabase/functions/license-core/index.ts');
const licenseAdminFunction = read('supabase/functions/license-admin/index.ts');
const sesMerkeziFunction = read('supabase/functions/ses-merkezi-desktop/index.ts');
const licenseAdminOriginMatch = licenseAdminFunction.match(/new Set\(\[([^\]]+)\]\)\.has\(req\.headers\.get\("origin"\)/);
const licenseAdminOrigins = licenseAdminOriginMatch
  ? [...licenseAdminOriginMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1])
  : [];
const readinessHandler = productionOsFunction.split("if(body.action==='readiness'){")[1]?.split("  return json({error:'Unsupported action'}")[0] || '';
const supabaseSri = 'sha384-yiVMs0R/Jyz7OhoXa/DsEMUSBLjEhr/QJta2ONO+zB6I8/GmNg/7AUFrZmAJV7KV';

const edgeManifest = JSON.parse(read('supabase/functions-manifest.json'));
const edgeConfig = read('supabase/config.toml');
const expectedEdgeFunctions = new Map([
  ['admin-data', true], ['admin-github-media', true], ['admin-login', false], ['license-core', true],
  ['admin-offer-runtime', false], ['admin-password-reset', false], ['license-admin', false],
  ['offer-pdf', false], ['org-admin-control', true], ['portal-login', false],
  ['production-os', false], ['public-quote', false], ['register-android-device', true],
  ['self-password-change', true], ['send-fcm-notification', false],
  ['ses-merkezi-desktop', false], ['staff-manage', false],
]);
const manifestEntries = Array.isArray(edgeManifest.functions) ? edgeManifest.functions : [];
const manifestNames = manifestEntries.map(item => item.name);
requireMatch(manifestEntries.length === expectedEdgeFunctions.size, 'Edge function manifest must contain every canonical function exactly once.');
requireMatch(new Set(manifestNames).size === manifestNames.length, 'Edge function manifest must not contain duplicate names.');
for (const [name, verifyJwt] of expectedEdgeFunctions) {
  const entry = manifestEntries.find(item => item.name === name);
  requireMatch(!!entry && entry.verifyJwt === verifyJwt, `Function manifest must declare ${name} with verifyJwt=${verifyJwt}.`);
  requireMatch(edgeConfig.includes(`[functions.${name}]\nverify_jwt = ${verifyJwt}`), `Supabase config must declare ${name} with verify_jwt=${verifyJwt}.`);
  requireMatch(read(`supabase/functions/${name}/index.ts`).length > 0, `Canonical Edge Function source is missing: ${name}.`);
}
requireMatch(!manifestNames.includes('staff-login') && !manifestNames.includes('staff-session'), 'Deprecated 410 compatibility endpoints must not be included in the deployment manifest.');
requireMatch(licenseCoreFunction.includes('const ALLOWED_ORIGINS = new Set([') && licenseCoreFunction.includes('if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;') && !licenseCoreFunction.includes('Access-Control-Allow-Origin": "*"'), 'Unified license Edge Function must use the Stagepulse CORS origin allowlist.');
requireMatch(!licenseAdminFunction.includes('Access-Control-Allow-Origin": "*"') && JSON.stringify(licenseAdminOrigins) === JSON.stringify(['https://stagepulse.com.tr','https://www.stagepulse.com.tr','https://appassets.androidplatform.net','http://localhost:5173','http://127.0.0.1:5173']), 'License admin Edge Function must validate CORS with an exact origin allowlist.');
requireMatch(!sesMerkeziFunction.includes('Access-Control-Allow-Origin": "*"') && sesMerkeziFunction.includes('const ALLOWED_ORIGINS = new Set([') && sesMerkeziFunction.includes('content-type, x-client-info') && sesMerkeziFunction.includes('https://appassets.androidplatform.net'), 'Ses Merkezi Edge Function must use the Stagepulse CORS origin allowlist.');
requireMatch(fcmRegistryMigration.includes('notification_devices_user_token_variant_uidx') && fcmRegistryMigration.includes('alter table public.notification_devices enable row level security') && fcmRegistryMigration.includes('grant execute on function public.register_notification_device(text,text,text) to authenticated;'), 'FCM device registry must have scoped RLS and authenticated registration RPC.');
requireMatch(registerAndroidFunction.includes('.eq("token", token)') && registerAndroidFunction.includes('"https://www.stagepulse.com.tr"') && registerAndroidFunction.includes('if (ALLOWED_ORIGINS.has(origin))') && registerAndroidFunction.includes('content-type, x-client-info'), 'Android device registration must be token-scoped and use an origin allowlist.');
requireMatch(productionOsMigration.includes('create table if not exists public.sp_event_readiness') && productionOsMigration.includes("'sp_event_readiness'") && productionOsMigration.includes('enable row level security') && productionOsMigration.includes('alter view public.sp_production_readiness set (security_invoker = true)'), 'Production OS schema must include the RLS-protected readiness table and security-invoker view.');
requireMatch(productionOsMigration.includes('create policy sp_timesheet_admin_insert') && productionOsMigration.includes('create policy sp_timesheet_admin_update') && productionOsMigration.includes('create policy sp_timesheet_admin_delete') && productionOsMigration.includes('create policy sp_timesheet_select') && !productionOsMigration.includes('create policy sp_timesheet_access on public.sp_staff_timesheets for all'), 'Production OS must prevent staff from inserting or approving their own timesheets.');
requireMatch(productionOsAccessMigration.includes('create policy sp_timesheet_admin_update') && productionOsAccessMigration.includes('with check (public.is_admin())') && productionOsAccessMigration.includes('using (public.is_admin() or user_id = auth.uid())'), 'Live Production OS access hardening must remove the existing staff-wide timesheet write policy.');
requireMatch(productionOsFunction.includes('staffActions.has(body.action)') && productionOsFunction.includes("userClient.rpc('is_staff')") && productionOsFunction.includes("userClient.rpc('is_admin')"), 'Production OS service-role writes must require an active staff or admin account.');
requireMatch(readinessHandler.includes("userClient.rpc('is_admin')") && readinessHandler.includes("isAdmin!==true") && readinessHandler.toLowerCase().includes('admin capability required'), 'Production readiness reads must require an administrator before using service-role access.');
requireMatch(fcmDispatchMigration.includes("cron.schedule(") && fcmDispatchMigration.includes("'stagepulse-notification-push-retry'") && fcmDispatchMigration.includes('https://itasctyjzyewcykozuex.supabase.co/functions/v1/send-fcm-notification') && !fcmDispatchMigration.includes('mtjcqqrogjqaxkagwkti'), 'FCM retry migration must schedule delivery to the current Supabase project, not the retired endpoint.');
requireMatch(notificationSchema.includes('recipient_user_id uuid references auth.users(id) on delete cascade') && notificationSchema.includes('create policy notifications_recipient_select') && notificationSchema.includes('create policy notifications_recipient_update') && notificationSchema.includes('recipient_user_id, kind, title, body, offer_id') && notificationSchema.includes('membership.user_id') && notificationSchema.includes('membership.active = true') && notificationSchema.includes("grant_row.capability_key = 'offers.view'"), 'Canonical notification schema must create recipient-addressed quote notifications for active administrators.');
requireMatch(notificationSchema.includes("returns trigger\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $notify$\nbegin") && notificationSchema.includes('membership.user_id') && notificationSchema.includes("grant_row.capability_key = 'offers.view'") && notificationSchema.includes("end;\n$notify$;"), 'Canonical notify_new_quote function must use a valid dollar-quoted SQL body and route to active admins and offers.view recipients.');
requireMatch(notificationRecipientMigration.includes('add column if not exists recipient_user_id uuid') && notificationRecipientMigration.includes('notifications_recipient_user_id_fkey') && notificationRecipientMigration.includes('create index if not exists notifications_recipient_created_idx'), 'Notification migration must restore recipient ownership, user foreign key, and recipient timeline index.');
requireMatch(notificationRecipientMigration.includes('revoke all privileges on table public.notifications from authenticated') && notificationRecipientMigration.includes('grant update (read_at) on table public.notifications to authenticated'), 'Authenticated clients must be able to update only the read marker, not notification content or FCM state.');
requireMatch(notificationRecipientMigration.includes('create policy notifications_recipient_select') && notificationRecipientMigration.includes('create policy notifications_recipient_update') && notificationRecipientMigration.includes('create policy notifications_recipient_delete') && (notificationRecipientMigration.split('recipient_user_id = (select auth.uid())').length - 1) === 4 && !notificationRecipientMigration.includes("staff_has_perm('notifications.view')"), 'Notification recipient policies must enforce recipient ownership without blocking explicitly authorized offers.view recipients.');
requireMatch(notificationRecipientMigration.includes('role.is_admin_role = true') && notificationRecipientMigration.includes("grant_row.capability_key = 'offers.view'") && notificationRecipientMigration.includes('recipient_user_id, kind, title, body, offer_id') && notificationRecipientMigration.includes('revoke all on function public.notify_new_quote() from public, anon, authenticated'), 'New quote notifications must be created per active administrator or offers.view recipient, and the trigger function must not be directly callable.');
requireMatch(notificationRecipientMigration.includes('n.recipient_user_id is not null') && notificationRecipientMigration.includes('where n.recipient_user_id is not null'), 'FCM dispatch and retry must ignore notifications without an explicit recipient.');
requireMatch(fcmSenderFunction.includes("if(!n.recipient_user_id)") && fcmSenderFunction.includes('role:org_roles!org_memberships_role_id_fkey(') && !fcmSenderFunction.includes('role:role_id(') && fcmSenderFunction.includes('const deliveryPending = result.sent === 0 && result.failed === 0') && fcmSenderFunction.includes('pending:deliveryPending'), 'FCM sender must not mark a notification delivered when it has no recipient or no active device.');
requireMatch(['sp_equipment_scans','sp_event_readiness','sp_field_proofs'].every(name => productionOsTimestampMigration.includes(`alter table public.${name} add column if not exists created_at`)), 'Production OS list tables must expose the created_at sort column used by the admin UI.');
const normalizedLicenseDenyMigration = licenseDenyMigration.replaceAll('\n', ' ').replaceAll('  ', ' ').replaceAll('  ', ' ').toLowerCase();
requireMatch(['license_core','license_core_audit','license_core_devices','license_entitlements','license_product_entitlements','license_products'].every(name => normalizedLicenseDenyMigration.includes(`on public.${name} for all to anon, authenticated using (false) with check (false)`)), 'License core tables must have explicit deny policies for direct anon/authenticated access.');
for (const signature of ['can_manage_org_member(uuid)', 'check_login_rate_limit(text, integer)', 'enforce_public_quote_rate_limit()', 'is_org_owner()', 'set_offer_public_code()', 'set_quote_defaults()', 'stagepulse_activate_license_device(uuid, text)']) {
  requireMatch(searchPathMigration.includes(`alter function public.${signature} set search_path = '';`), `SECURITY DEFINER search_path hardening is missing for ${signature}.`);
}


requireMatch(/name=["']phone["']/.test(teklif), 'teklif.html must expose the phone field by name.');
requireMatch(publicScript.includes('/script-controller.js'), 'script.js must load the local public controller.');
requireMatch(!publicScript.includes('cdn.jsdelivr.net/gh/ibrahimFOH'), 'Public controller must not fall back to a remote repository.');
requireMatch(controller.includes('/core.js'), 'script-controller.js must load the local core controller.');
requireMatch(/\bphone\b[\s\S]*turnstile_token:turnstileToken/.test(core), 'Public quote payload must include phone and the Turnstile token.');
requireMatch(core.includes("payload.ok!==true||!payload.quote?.id"), 'Public quote UI must require a server-confirmed receipt.');
requireMatch(core.includes("sessionStorage.setItem(receiptKey") && core.includes("form.dataset.submitting==='1'"), 'Public quote UI must prevent in-flight and repeated duplicate submissions.');
requireMatch(!core.includes('window.location.assign(waUrl)'), 'WhatsApp must remain an optional action, not the quote success mechanism.');
requireMatch(/submit\.type\s*=\s*['"]submit['"]/.test(conversionScript), 'Offer enhancement must preserve native form submission.');

requireMatch(/analytics_storage:\s*['"]denied['"]/.test(consentScript), 'Consent defaults must deny analytics storage.');
requireMatch(/state==='accepted'\)analytics\(\)/.test(consentScript), 'Analytics must load only after explicit opt-in.');
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

const authenticatedPathsMatch = serviceWorker.match(/const\s+AUTHENTICATED_PATHS\s*=\s*\[([^\]]+)\]/);
const authenticatedPaths = authenticatedPathsMatch
  ? [...authenticatedPathsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])
  : [];
requireMatch(authenticatedPaths.includes('/admin') && authenticatedPaths.includes('/portal'), 'Service worker must recognize both admin and portal roots as authenticated, while allowing additional protected app roots.');
requireMatch(/function isOfflineShellAsset\(request,url\)\s*\{[\s\S]*?request\.method!=='GET'[\s\S]*?return \['script','style','image','font'\]/.test(serviceWorker), 'Only GET navigation and static app-shell assets may be cached for authenticated screens.');
requireMatch(/if\s*\(isAuthenticatedPath\(url\.pathname\)\)\s*\{[\s\S]*?if\s*\(isOfflineShellAsset\(request,url\)\)[\s\S]*?else\s*\{\s*event\.respondWith\(fetch\(request,\s*\{\s*cache:\s*'no-store'\s*\}\)\)\s*;\s*\}\s*return;/.test(serviceWorker), 'Authenticated API and data requests must remain network-only; only static shell resources may use offline cache.');
requireMatch(serviceWorker.includes("'/index.html'") && serviceWorker.includes('Promise.allSettled'), 'Service worker install must build a resilient offline shell.');
requireMatch(/status\s*:\s*503/.test(serviceWorker), 'Service worker must return an explicit offline failure response when no shell exists.');

for (const city of ['adana', 'gaziantep', 'hatay', 'mersin', 'sanliurfa']) {
  const html = read(`${city}/index.html`);
  requireMatch(html.includes('property="og:title"') && html.includes('"@type":"Service"'), `${city} regional page must include supported OG and Service metadata.`);
}

const regionsPage = read('bolgeler.html');
requireMatch(regionsPage.includes('Hatay · Adana · Gaziantep · Şanlıurfa · Mersin'), 'Public regions page must list only active service regions.');
requireMatch(!regionsPage.includes('href="antalya/"'), 'Public regions page must not link to Antalya as a service region.');
requireMatch(regionsPage.includes('Antalya aktif hizmet bölgesi değildir'), 'Public regions page must explicitly distinguish Antalya from active service regions.');
const sitemap = read('sitemap.xml');
requireMatch(!sitemap.includes('stagepulse.com.tr/antalya/'), 'Sitemap must not advertise Antalya as a service region.');

for (const [path, headers] of [['_headers', rootHeaders], ['admin/_headers', adminHeaders], ['portal/_headers', portalHeaders]]) {
  for (const header of ['Content-Security-Policy:', 'X-Frame-Options: DENY', 'X-Content-Type-Options: nosniff', 'Referrer-Policy:', 'Permissions-Policy:']) {
    requireMatch(headers.includes(header), `${path} must set ${header}`);
  }
  requireMatch(headers.includes("frame-ancestors 'none'"), `${path} CSP must deny framing.`);
}

for (const [path, html] of [['admin/index.html', adminHtml], ['portal/index.html', portalHtml]]) {
  const hasStaticSri = html.includes(`integrity="${supabaseSri}"`) && html.includes('crossorigin="anonymous"');
  const hasDynamicPinnedFallback = path === 'admin/index.html' && html.includes('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4') && html.includes('https://fastly.jsdelivr.net/npm/@supabase/supabase-js@2.112.4');
  requireMatch(hasStaticSri || hasDynamicPinnedFallback, `${path} must pin the Supabase JS version and use an approved loading strategy.`);
  requireMatch(!/<input[^>]+(?:id=["']login(?:Username|Password|User|Pass)["'])[^>]+name=/i.test(html), `${path} login credentials must not be successful controls during an unhandled native submit.`);
}
requireMatch(core.includes("supabase-js@2.112.4") && core.includes(`script.integrity='${supabaseSri}'`) && core.includes("script.crossOrigin='anonymous'"), 'Public Supabase loader must pin the verified asset and enforce SRI.');
requireMatch(quoteView.includes('supabase-js@2.112.4') && quoteView.includes(`integrity="${supabaseSri}"`), 'Public quote view must pin the verified Supabase asset and enforce SRI.');
requireMatch(!core.includes("supabase-js@2\'"), "Public Supabase loader must not use a floating major-version CDN URL.");
requireMatch(!quoteView.includes('supabase-js@2"'), 'Public quote view must not use a floating major-version CDN URL.');
requireMatch(quoteAclMigration.includes('revoke execute on function public.get_public_quote(text) from public, authenticated;') && quoteAclMigration.includes('revoke execute on function public.respond_to_quote(text, text) from public, authenticated;') && quoteAclMigration.includes('grant execute on function public.get_public_quote(text) to anon;') && quoteAclMigration.includes('grant execute on function public.respond_to_quote(text, text) to anon;'), 'Customer quote RPCs must remain token-accessible to anon but not executable by authenticated users.');
requireMatch(quoteView.includes('persistSession: false') && quoteView.includes('autoRefreshToken: false') && quoteView.includes('detectSessionInUrl: false'), 'Public quote view must use an isolated anonymous Supabase client even when a portal session exists.');
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
requireMatch(adminRuntime.includes('navigator.onLine') && adminRuntime.includes('adminBootRetry') && /aria-live=["']assertive["']|role=["']alert["']/.test(adminRuntime), 'Admin boot failure must distinguish offline state and expose an accessible retry.');
requireMatch(portalRuntime.includes('navigator.onLine') && portalRuntime.includes('portalBootRetry') && /aria-live=["']assertive["']|role=["']alert["']/.test(portalRuntime), 'Portal boot failure must distinguish offline state and expose an accessible retry.');
requireMatch(!portalRuntime.includes("'inventory-ui-v3.js','inventory-ui-v4.js'"), 'Portal runtime must not load the superseded inventory boot-hook generation.');
requireMatch(portalInventory.includes('role="dialog"') && portalInventory.includes('aria-labelledby="spPInvTitle"') && portalInventory.includes('modalReturnFocus'), 'Inventory dialog must be named and restore focus.');
requireMatch(portalPermissions.includes('aria-labelledby="spPortalResetTitle"') && portalPermissions.includes("$('#spPortalPass1')?.focus()"), 'Password recovery dialog must be named and receive initial focus.');
requireMatch(adminOfferFields.includes("label.insertAdjacentElement('afterend',b)") && !adminOfferFields.includes('label.appendChild(b)'), 'Crew save control must not be nested inside its field label.');
requireMatch(adminCss.includes('@media(max-width:700px){.sp-offer-price-grid'), 'Offer inventory controls must reflow on narrow screens.');
requireMatch(!portalPermissions.includes('sp_staff_meta') && !portalCrud.includes('sp_staff_meta'), 'Staff PII and permissions must not be duplicated in localStorage.');

requireMatch(adminShell.includes('stagepulse-admin-auth-v2'), 'Canonical admin bundle must use the canonical admin storage key.');
const adminJsFiles = readdirSync(resolve(root, 'admin')).filter(name => name.endsWith('.js')).map(name => `admin/${name}`);
for (const path of adminJsFiles) {
  if (path === 'admin/admin.js') {
    const adminEntry = read(path);
    requireMatch(adminEntry.includes("storageKey: 'stagepulse-admin-auth-v2'") && adminEntry.includes('storage: window.sessionStorage') && adminEntry.includes('detectSessionInUrl: false'), 'admin.js must create the canonical session-only admin client.');
  } else if (path !== 'admin/admin-bundle.js' && path !== 'admin/admin-runtime.js') {
    requireMatch(!read(path).includes('createClient(') && !read(path).includes('createClient?.('), `${path} must use the canonical admin client instead of creating a fallback.`);
  }
}

if (failures.length) {
  console.error(failures.map(message => `FAIL: ${message}`).join('\n'));
  process.exit(1);
}
console.log('Web security validation passed.');