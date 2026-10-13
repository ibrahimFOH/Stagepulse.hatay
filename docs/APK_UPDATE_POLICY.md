# APK Update Policy

Stagepulse uses a decimal carry version sequence: each MINOR and PATCH component is a single digit (0–9).

- Patch increments: `7.4.8 -> 7.4.9`.
- Patch rollover: `7.4.9 -> 7.5.0`.
- Minor rollover: `7.9.9 -> 8.0.0`.
- Major numbers grow without a single-digit limit: `9.9.9 -> 10.0.0`.
- Historical releases created by the previous 0–999 patch scheme are normalized forward on the next release (for example, `7.4.16 -> 7.5.0`).
- Android `versionCode` is calculated as `MAJOR * 1,000,000 + MINOR * 1,000 + PATCH`; this preserves numerical ordering for the supported sequence.
- The updater compares Android `versionCode` numerically and must not contain a hard-coded target version.
- Every release publishes both Admin and Personel APKs and updates `app_versions` with matching versionCode, URL, and SHA-256.
- A newly installed updater checks at startup and resume, then retries when a check fails.
