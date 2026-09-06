# Stagepulse — Canonical Operation Map

## Rule

The repository `main` branch is the canonical source of truth. Historical ZIPs are reference/archive artifacts and must not be treated as parallel source trees.

For each operation, keep one authoritative runtime entrypoint. Supporting styles, schemas and tests may remain separate when they serve a different responsibility.

## Current canonical operations

| Operation | Canonical entrypoint |
|---|---|
| Admin bootstrap / runtime | `admin/admin-runtime.js` |
| Patron executive center | `admin/patron-center.js` |
| Owner compatibility marker | `admin/owner-operating-system.js` |
| Admin authentication | `supabase/functions/admin-login/index.ts` |
| Admin data API | `supabase/functions/admin-data/index.ts` |
| Staff authentication | `supabase/functions/staff-login/index.ts` |
| Staff session | `supabase/functions/staff-session/index.ts` |
| Public quote intake | `supabase/functions/public-quote/index.ts` |
| Web application runtime | `script.js` / existing page controllers |
| Android application entry | `android/app/src/main/java/tr/com/stagepulse/app/MainActivity.kt` |
| Android update engine | `android/app/src/main/java/tr/com/stagepulse/app/AppUpdater.kt` |
| CI / web / security gate | `.github/workflows/stagepulse-ci.yml` |
| Regional SEO gate | `.github/workflows/regional-seo.yml` |
| Signed APK release | `.github/workflows/apk-release.yml` |

## ZIP policy

- Do not restore an older ZIP wholesale over `main`.
- When a historical ZIP contains a useful change, port only the required change into the canonical operation file and validate it.
- Exact duplicate ZIP binaries are archived once; their original filenames are retained in the consolidation manifest.
- APK/debug ZIPs are release/build artifacts, not alternative application source trees.

## RBAC authority

- Patron / Owner is the only unconditional admin authority.
- CEO, Super Admin and other delegated users are capability-based.
- `public.is_admin()` is an authenticated-only compatibility wrapper around `private.is_admin()`.
- `private.is_admin()` delegates to the canonical organization-owner check.

## Production requirements

Every change must pass the repository's static/security gate, JavaScript/Edge checks, migration integrity, public navigation/SEO checks and Android debug validation before being considered complete. Production smoke checks remain available through the CI workflow.
