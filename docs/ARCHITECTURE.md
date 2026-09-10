# Stagepulse Architecture

## Canonical runtime surfaces

Stagepulse is intentionally a multi-surface production system. The canonical boundaries are:

- Public web: root HTML/CSS/JS and `script.js`
- Admin web: `admin/index.html` + `admin/admin-bundle.js` + focused admin modules
- Staff portal: `portal/`
- Android: `android/`
- Backend: `supabase/functions/`
- Database: `supabase/schema.sql` + `supabase/migrations/`
- Release automation: `.github/workflows/`
- Shared security/runtime helpers: `supabase/functions/_shared/` and `shared/`

## Admin JavaScript boundary

`admin/admin-bundle.js` is the canonical browser bundle, not a second application. Its responsibility is the shared shell, navigation/view dispatch, and stable fallback renderers. Feature-specific code stays in the focused files loaded after it, such as organization management, Patron Center, media management, notifications, and recovery.

Do not add new business domains to `admin-bundle.js` unless the code is genuinely shared. New domain features belong in a focused module and must be wired through the canonical admin runtime.

## Data access rule

Authenticated admin reads and writes must enforce authorization server-side. The `admin-data` Edge Function now applies bounded pagination to list/bootstrap reads. Direct client reads must also use bounded queries and should not request unbounded historical tables.

Recommended defaults:

- interactive lists: 100 rows/page
- hard API maximum: 250 rows/page
- activity/notification history: paginated queries only
- analytics: aggregate/count queries rather than downloading the complete history

## Release rule

Android release artifacts must be signed with the production keystore and verified by certificate fingerprint, package name, version code, version name, and SHA-256 before publication. Release provenance should be attached to published artifacts where GitHub's attestation service is available.

## Testing layers

1. Static/security/architecture CI
2. Production public smoke checks
3. Android build/signature verification
4. Authenticated acceptance testing with a dedicated non-production or disposable account
5. Real-device notification/autofill verification

Production credentials must never be committed or embedded in browser assets. Authenticated tests must use repository/environment secrets and must not mutate production data unless the test account and cleanup contract explicitly permit it.
