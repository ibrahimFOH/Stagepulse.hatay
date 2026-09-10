# Stagepulse

**FOH Engineer • Ses Sistemi Kiralama • Teknik Mühendislik**

## Production architecture

Stagepulse is a production system composed of the public web site, admin and staff portals, Android applications, Supabase Edge Functions/PostgreSQL, Firebase messaging, and GitHub Actions release automation.

- Public web: root HTML/CSS/JS
- Admin: `admin/`
- Staff portal: `portal/`
- Android: `android/`
- Backend: `supabase/functions/`
- Database: `supabase/schema.sql` + `supabase/migrations/`
- CI/CD: `.github/workflows/`
- Architecture rules: `docs/ARCHITECTURE.md`
- Acceptance testing: `docs/PRODUCTION-TEST-PLAN.md`

## Production safety

Admin API reads are bounded to a maximum of 250 rows per page. The canonical admin UI should use bounded queries and pagination for historical data. Service-role credentials are server-side only.

Android release artifacts are signed and verified by package name, certificate fingerprint, version code/name, and SHA-256. Published release assets can also receive GitHub artifact provenance attestations through `release-provenance.yml`.

## Verification

Every release should pass:

1. Static/security CI
2. Production public smoke tests (`production-smoke.yml`)
3. Android build/signature verification when Android changes
4. Authenticated acceptance tests for changed admin/staff flows
5. Real-device FCM/autofill checks when Android behavior changes

See `docs/PRODUCTION-TEST-PLAN.md` for the evidence required before calling a release production-ready.
