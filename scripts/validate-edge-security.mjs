import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [fcm, adminLogin, portalLogin, publicQuote, registration, githubMedia, offerPdf, orgAdmin, staffSession, publicCodeMigration] = await Promise.all([
  read("supabase/functions/send-fcm-notification/index.ts"),
  read("supabase/functions/admin-login/index.ts"),
  read("supabase/functions/portal-login/index.ts"),
  read("supabase/functions/public-quote/index.ts"),
  read("supabase/functions/register-android-device/index.ts"),
  read("supabase/functions/admin-github-media/index.ts"),
  read("supabase/functions/offer-pdf/index.ts"),
  read("supabase/functions/org-admin-control/index.ts"),
  read("supabase/functions/staff-session/index.ts"),
  read("supabase/migrations/20260901003500_strengthen_future_offer_public_codes.sql"),
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
assert.equal((offerPdf.match(/AbortSignal\.timeout\(10_000\)/g) || []).length, 3, "PDF upstream requests must be bounded");
assert.match(offerPdf, /json\(\{error:"Teklif bulunamadı\."\},404\)/, "PDF endpoint must expose only safe not-found errors");
assert.match(offerPdf, /json\(\{error:"İşlem başarısız\."\},500\)/, "PDF endpoint must expose only a generic server error");
assert.doesNotMatch(offerPdf, /return json\(\{error:up\.error\.message\}/, "PDF storage errors must not be returned");
assert.doesNotMatch(offerPdf, /return json\(\{error:ins\.error\.message\}/, "PDF database errors must not be returned");
assert.doesNotMatch(orgAdmin, /üyeliği okunamadı: "\+me\.message/, "Organization API must not expose database errors");
assert.match(staffSession, /e instanceof PublicError\?out\(req,\{error:e\.message\},e\.status\)/, "Staff session must expose only explicitly tagged public errors");
assert.doesNotMatch(staffSession, /me\.message|error:e instanceof Error\?e\.message/, "Staff session must not expose database or provider errors");
assert.match(publicCodeMigration, /gen_random_bytes\(16\)/, "Future public codes must carry 128 bits of entropy");
assert.match(publicCodeMigration, /if v_code is not null and v_code <> '' then[\s\S]*return v_code/, "Existing public links must remain unchanged");

console.log("Edge security validation passed (29 assertions).");
