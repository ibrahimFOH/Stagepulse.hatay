# Stagepulse — Canonical Operation Map

## Rule

The `main` branch is the canonical source of truth. Historical ZIPs and unreferenced bundles are not parallel runtime surfaces.

## Current canonical operations

| Operation | Canonical entrypoint |
|---|---|
| Public website | Root HTML/CSS/JS + `script.js` |
| Admin web application | `admin/index.html` + `admin/admin.js` + `admin/admin.css` |
| Staff portal | `portal/` |
| Admin authentication | `supabase/functions/admin-login/index.ts` |
| Admin data API | `supabase/functions/admin-data/index.ts` |
| Organization / RBAC control | `supabase/functions/org-admin-control/index.ts` |
| Staff portal login | `supabase/functions/portal-login/index.ts` |
| Public quote intake | `script.js` → `public.teklifler` |
| Customer quote view / decision | `get_public_quote(token)` and `respond_to_quote(token, action)` RPCs |
| Public media catalog | `media.json` + `scripts/process_media.py` + media-index workflow |
| License core | `Stagepulse-Ses-Merkezi/windows/supabase/functions/license-core/index.ts`, mirrored in this repository |
| Ses Merkezi desktop API | `Stagepulse-Ses-Merkezi/windows/supabase/functions/ses-merkezi-desktop/index.ts`, mirrored in this repository |
| Ses Merkezi update endpoint | `Stagepulse-Ses-Merkezi/windows/supabase/functions/ses-merkezi-updates/index.ts` deployed by `Stagepulse-Releases` |
| Android application | `android/app/src/main/java/tr/com/stagepulse/app/MainActivity.kt` |
| Android update engine | `android/app/src/main/java/tr/com/stagepulse/app/AppUpdater.kt` |
| Web / security CI | `.github/workflows/stagepulse-ci.yml` |
| Regional SEO gate | `.github/workflows/regional-seo.yml` |
| Signed APK release | `.github/workflows/apk-release.yml` |

## Supabase boundary

- `supabase/functions-manifest.json` lists the 14 Edge Functions managed by this repository.
- `ses-merkezi-updates` is managed separately by the Ses Merkezi release repository.
- Public quote intake uses the current project's `teklifler` table. Customer-facing quote retrieval and acceptance/rejection remain token-scoped SQL RPCs.
- Education document storage and education administration remain in the separate SESM flow. Do not remove its tables or storage bucket based only on low recent activity.

## Migration rule

Never edit an applied migration to change production state. Before applying or deleting database objects, the repository migration ledger and the live Supabase migration history must be reconciled and validated.

## Release rule

Android APK/EXE releases are build artifacts, not alternative application source trees. Do not overwrite a stable release while auditing unrelated repository code.
