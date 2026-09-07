# Stagepulse Repository Audit

Date: 2026-09-07
Scope: canonical `main` branch of `ibrahimFOH/Stagepulse.hatay` plus production Supabase project `mtjcqqrogjqaxkagwkti`.

## PASS

- Static / Security / Supabase Gate passed on the current audited baseline: canonical layout, static site/manifests, JavaScript syntax, Edge Functions, migrations, credential baseline, frontend service-role protection, and private-schema protection.
- Public SEO / Navigation Integrity passed.
- GitHub Pages Build Validation and GitHub Pages Deploy passed.
- Android Debug Validation passed.
- Signed Personel and Admin APK/AAB release pipeline passed build, signing, artifact verification, download verification, manifest publication, and production metadata synchronization for `4.0.6`.
- Current published manifest is `latest.json` release `v4.0.6-build.181`, status `verified`.
- Media pipeline is canonical: `admin-github-media` writes repository media and GitHub Actions owns WebP conversion plus `media.json` generation.
- Supported repository photo normalization includes JPG/JPEG, PNG, WebP, GIF, AVIF, BMP, TIFF, HEIC and HEIF; HEIC/HEIF conversion uses `pillow-heif`.
- Media index currently contains 13 gallery photos and 3 PDF documents.
- Admin media path validation now prevents cross-area media deletion and prevents changing media type during rename.
- `admin-github-media` no longer writes `media.json` itself, preventing a race with the canonical media workflow.
- Android WebView explicitly enables system Autofill support and the login HTML uses standard username/password autocomplete tokens.
- The public documents page was converted to a static document surface so a failing dynamic media index cannot hang the page.
- Canonical admin navigation and Patron Center duplication cleanup remain enforced.

## PRODUCTION NOTES

- The production Edge Function catalog contains historical compatibility functions alongside canonical functions. Repository runtime references were checked so obsolete functions are not used by the canonical frontend path.
- `admin-github-media` is active at version 14 with JWT verification enabled.
- The media manager intentionally remains read-only when the server-side `GITHUB_TOKEN` secret is absent; the token is never exposed to the browser.

## REQUIRES REAL-ACCOUNT / DEVICE TESTING

- Authenticated admin and portal login, permission changes, real offer CRUD, customer response, FCM delivery to a registered Android device, and Android Autofill behavior still require an actual authorized account/device to exercise end-to-end.
- The repository CI validates source/build integrity; it does not replace a real device or authenticated user acceptance test.

## CURRENT BLOCKERS

No repository static/security/Edge/Android CI blocker is currently known on the audited baseline.

The remaining operational dependency for Admin Media Center write actions is the production `GITHUB_TOKEN` secret. If it is absent, upload/delete/rename correctly fail closed instead of exposing a GitHub credential to the client.
