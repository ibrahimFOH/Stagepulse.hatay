# Stagepulse — Canonical Operation Map

## Rule

The repository `main` branch is the canonical source of truth. Historical ZIPs are reference/archive artifacts and must not be treated as parallel source trees.

For each operation, keep one authoritative runtime entrypoint. Supporting styles, schemas and tests may remain separate when they serve a different responsibility.

## Current canonical operations

| Operation | Canonical entrypoint |
|---|---|
| Admin bootstrap / runtime | `admin/admin-runtime.js` |
| Admin management navigation | `admin/admin-management-nav.js` |
| Patron executive center | `admin/patron-center.js` |
| Admin authentication | `supabase/functions/admin-login/index.ts` |
| Admin data API | `supabase/functions/admin-data/index.ts` |
| Organization / RBAC control API | `supabase/functions/org-admin-control/index.ts` |
| Admin AI assistant | `supabase/functions/admin-ai/index.ts` + `admin/admin-ai.js` |
| AI provider management | `supabase/functions/ai-manage/index.ts` + `admin/admin-ai-providers.js` |
| Staff authentication | `supabase/functions/staff-login/index.ts` + `supabase/functions/portal-login/index.ts` |
| Staff AI assistant | `supabase/functions/staff-ai/index.ts` + `portal/staff-ai.js` |
| Public quote intake | `supabase/functions/public-quote/index.ts` |
| Media administration | `supabase/functions/admin-github-media/index.ts` |
| Media normalization / index | `scripts/process_media.py` + `.github/workflows/media-index.yml` |
| Web application runtime | `script.js` / existing page controllers |
| Android application entry | `android/app/src/main/java/tr/com/stagepulse/app/MainActivity.kt` |
| Android update engine | `android/app/src/main/java/tr/com/stagepulse/app/AppUpdater.kt` |
| CI / web / security gate | `.github/workflows/stagepulse-ci.yml` |
| Regional SEO gate | `.github/workflows/regional-seo.yml` |
| Signed APK release | `.github/workflows/apk-release.yml` |

`supabase/functions/staff-session/index.ts` is deprecated compatibility code and is not a canonical runtime dependency.

## AI safety model

- Admin AI requires a valid authenticated admin membership; it is analysis/proposal-only and cannot directly execute database changes.
- Staff AI requires a valid authenticated active organization membership and is restricted to the user's own operational context.
- AI provider configuration remains isolated from public client code and backend secrets remain server-side.

## Media model

- Admin media writes use `admin-github-media`; browser code never receives a GitHub token.
- Direct repo uploads are normalized by the Media Index workflow.
- Supported raster photos are converted to WebP, including HEIC/HEIF.
- `media.json` is the generated canonical index.
- An empty index when source media exists is a workflow error.

## ZIP policy

- Do not restore an older ZIP wholesale over `main`.
- When a historical ZIP contains a useful change, port only the required change into the canonical operation file and validate it.
- APK/debug ZIPs are release/build artifacts, not alternative application source trees.

## RBAC authority

- Patron / Owner is the unconditional top-level admin authority.
- Super Admin is automatically resolved to the full active capability catalog; other delegated users remain capability-based.
- CEO and other delegated users are capability-based.
- `public.is_admin()` is an authenticated-only compatibility wrapper around `private.is_admin()`.
- `private.is_admin()` delegates to the canonical organization-owner check.
- High-level command RPCs are authenticated-only and retain internal owner/capability checks.

## Production requirements

Every change must pass the repository's static/security gate, JavaScript/Edge checks, migration integrity, public navigation/SEO checks and Android debug validation before being considered complete. Production smoke checks remain available through the CI workflow.
