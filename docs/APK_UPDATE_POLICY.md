# APK Update Policy

APK updates are version-agnostic.

- Patch releases: 1.0.179, 1.0.180, ... are newer than the installed build.
- Minor/major releases: 1.1.0, 1.2.0, 2.0.0, ... are newer as well.
- The updater must compare Android `versionCode` numerically and must not contain a hard-coded target version.
- Every release must publish both Admin and Personel APKs and update `app_versions` with the matching versionCode, URL, and SHA-256.
- A newly installed updater performs an update check at startup and resume, then retries when a check fails.
