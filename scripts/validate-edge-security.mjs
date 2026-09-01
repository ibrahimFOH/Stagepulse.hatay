import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [fcm, adminLogin, portalLogin, publicQuote, registration, githubMedia, offerPdf, offerPdfV3, orgAdmin] = await Promise.all([
  read("supabase/functions/send-fcm-notification/index.ts"),
  read("supabase/functions/admin-login/index.ts"),
  read("supabase/functions/portal-login/index.ts"),
  read("supabase/functions/public-quote/index.ts"),
  read("supabase/functions/register-android-device/index.ts"),
  read("supabase/functions/admin-github-media/index.ts"),
  read("supabase/functions/offer-pdf/index.ts"),
  read("supabase/functions/offer-pdf-v3/index.ts"),
  read("supabase/functions/org-admin-control/index.ts"),
]);

assert.match(fcm, /else\{\s*await requireAdmin\(req\)/, "Direct push dispatch must require an admin session");
assert.match(fcm, /push_dispatch_token',token/, "Database dispatch-token claim flow must remain in place");
assert.match(fcm, /\.from\('org_memberships'\)\.select\('user_id'\)\.eq\('active',true\)\.in\('user_id',ids\)/, "Direct admin push must target only canonical active members");
assert.doesNotMatch(fcm, /organization_id/, "Single-organization dispatch must not depend on nonexistent tenant columns");
assert.match(fcm, /fetchWithTimeout\('https:\/\/oauth2\.googleapis\.com\/token'/, "OAuth request must be bounded");
assert.match(fcm, /fetchWithTimeout\(`https:\/\/fcm\.googleapis\.com/, "FCM sends must be bounded");
assert.doesNotMatch(fcm, /providerBody/, "Provider response bodies must not be returned");
assert.match(fcm, /const publicResult=\{ok:result\.ok/, "Dispatch details must be reduced to safe counters");
assert.doesNotMatch(adminLogin, /\.listUsers\(/, "Admin login must not scan the Auth user list");
assert.match(adminLogin, /admin_profiles"\)\.select\("user_id"\)/, "Legacy usernames must use indexed profile lookup");
assert.match(adminLogin, /if\(!isEmail&&!legacy&&!\/\^\[a-z0-9\._-\]\{3,64\}\$\//, "Unmapped username aliases must fail closed");
assert.match(adminLogin, /admin-login:account:/, "Admin login must also limit by account");
assert.match(portalLogin, /portal-login:account:/, "Portal login must also limit by account");
assert.match(publicQuote, /signal:AbortSignal\.timeout\(8_000\)/, "Turnstile request must be bounded");
assert.match(registration, /return json\(\{ error: "REGISTER_FAILED" \}/, "Registration must not expose database errors");
assert.match(githubMedia, /signal: AbortSignal\.timeout\(15_000\)/, "GitHub requests must be bounded");
assert.doesNotMatch(githubMedia, /new Error\(body\?\.message/, "GitHub provider messages must not be returned");
assert.equal((offerPdf.match(/signal:AbortSignal\.timeout\(10_000\)/g) || []).length, 3, "PDF upstream requests must be bounded");
assert.match(offerPdfV3, /PUBLIC_ERRORS\.has\(message\)/, "Offer API must allowlist customer-safe errors");
assert.match(offerPdfV3, /\.eq\("is_current", true\)[\s\S]*\.eq\("mime_type", "application\/pdf"\)/, "Only a current PDF asset may be signed");
assert.doesNotMatch(offerPdfV3, /offer\.pdf_storage_path/, "Legacy offer storage paths must not be signed");
assert.match(offerPdfV3, /\.in\("status", \["new", "reviewing", "preparing", "sent"\]\)/, "Offer responses must update conditionally");
assert.doesNotMatch(orgAdmin, /üyeliği okunamadı: "\+me\.message/, "Organization API must not expose database errors");

console.log("Edge security validation passed (23 assertions).");