# Stagepulse Repository Audit

Date: 2026-09-27
Scope: canonical `main` branch of `ibrahimFOH/Stagepulse.hatay`.

## Current CI state

- GitHub Pages deployment for commit `e57f5fd856eb6179b0baa7768e122a3cfe990b21`: passed.
- Media index rebuild for the same commit: completed and produced the current `media.json`.
- Regional SEO run for commit `6c7bc433162bbace0aabe57577e92d27bc98ba0d`: failed because `sitemap.xml` contained zero of the five active regional URLs.
- Production smoke on the previous production baseline: passed.

## Fixed in this audit

- Added the five active regional canonical URLs to `sitemap.xml`:
  - `/hatay/`
  - `/adana/`
  - `/gaziantep/`
  - `/sanliurfa/`
  - `/mersin/`
- Updated sitemap `lastmod` values to 2026-09-27 for the current site state.
- Updated this audit report to match the current repository state instead of the obsolete 2026-09-07 baseline.

## Remaining

Repository CI does not replace authenticated admin, customer quote, FCM device delivery, or other real-account/device acceptance tests. Those remain production checks requiring actual credentials/devices.
