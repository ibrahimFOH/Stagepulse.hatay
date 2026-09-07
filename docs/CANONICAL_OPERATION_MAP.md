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
| Organization / RBAC control API | `supabase/functions/org-admin-control/index.ts` |
| Admin AI assistant | `supabase/functions/admin-ai/index.ts` + `admin/admin-ai.js` |
| Staff authentication | `supabase/functions/staff-login/index.ts` + `supabase/functions/portal-login/index.ts` |
| Staff AI assistant | `supabase/functions/staff-ai/index.ts` + `portal/staff-ai.js` |
| Public quote intake | `supabase/functions/public-quote/index.ts` |
| Public AI assistant | `supabase/functions/site-ai/index.ts` + `site-ai.js` |
| AI management / permissions | `supabase/functions/ai-manage/index.ts` + existing AI control center |
| Web application runtime | `script.js` / existing page controllers |
| Android application entry | `android/app/src/main/java/tr/com/stagepulse/app/MainActivity.kt` |
| Android update engine | `android/app/src/main/java/tr/com/stagepulse/app/AppUpdater.kt` |
| CI / web / security gate | `.github/workflows/stagepulse-ci.yml` |
| Regional SEO gate | `.github/workflows/regional-seo.yml` |
| Signed APK release | `.github/workflows/apk-release.yml` |

`supabase/functions/staff-session/index.ts` is deprecated compatibility code and is not a canonical runtime dependency.

## AI safety model

- Public AI is unauthenticated, rate-limited, knowledge-grounded and must not expose private company data.
- Admin AI requires a valid authenticated admin membership; it is analysis/proposal-only and cannot directly execute database changes.
- Staff AI requires a valid authenticated active organization membership and is restricted to the user's own operational context.
- AI execution remains governed by the existing AI-agent capability model and approval/audit layer. `can_execute` stays disabled for the newly exposed conversational assistants.

## ZIP policy

- Do not restore an older ZIP wholesale over `main`.
- When a historical ZIP contains a useful change, port only the required change into the canonical operation file and validate it.
- Exact duplicate ZIP binaries are archived once; their original filenames are retained in the consolidation manifest.
- APK/debug ZIPs are release/build artifacts, not alternative application source trees.

## RBAC authority

- Patron / Owner is the only unconditional admin authority.
- Super Admin is automatically resolved to the full active capability catalog; other delegated users remain capability-based.
- CEO and other delegated users are capability-based.
- `public.is_admin()` is an authenticated-only compatibility wrapper around `private.is_admin()`.
- `private.is_admin()` delegates to the canonical organization-owner check.

## Production requirements

Every change must pass the repository's static/security gate, JavaScript/Edge checks, migration integrity, public navigation/SEO checks and Android debug validation before being considered complete. Production smoke checks remain available through the CI workflow.
