# Media storage strategy

## Current

- Site assets live under `images/` and `documents/` in git.
- `.gitattributes` enables Git LFS for large gallery media, video and archives.

## Recommended path

1. **New large assets** → Supabase Storage or Cloudflare R2 + CDN URL in `media.json`.
2. **Existing gallery** → migrate gradually; keep WebP optimization (`optimize_images.py`).
3. **Git LFS** → `git lfs install` on every clone machine; CI checkout needs `lfs: true`.

Do not rewrite git history to move old blobs into LFS unless a coordinated force-push window is planned.
