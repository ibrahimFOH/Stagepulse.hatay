# Stagepulse Production Acceptance Test Plan

Bu plan CI'nin yerine geçmez; CI'nin doğrulayamadığı gerçek kullanıcı ve cihaz davranışını kapsar.

## Test hesabı

Use a dedicated authorized test account. Never use the owner's daily account. Prefer a staging Supabase project for destructive CRUD tests.

Required credentials, when automated testing is enabled, are supplied only through GitHub environment secrets. Never place them in HTML, JavaScript, workflow files, logs, or repository files.

## Admin acceptance

- Login with username and password
- Invalid credentials return a generic error
- Refresh preserves the session
- Logout invalidates the session
- Non-admin receives 403 from admin-only API
- Customer create/edit/read
- Offer create/edit/status transition
- Job/event linkage
- Staff assignment
- Equipment assignment
- Finance read/write authorization
- Approval request and decision authorization
- Notification visibility by user
- Activity log insertion

## Staff acceptance

- Staff login
- Session refresh
- Own permitted jobs visible
- Restricted records remain inaccessible
- Assigned equipment/tasks visible
- Notification received and opened
- Password change works

## Android acceptance

For both Personel and Admin builds:

- Install clean APK
- Upgrade from previous release
- Login
- WebView navigation
- Back navigation
- Keyboard/autofill
- Session persistence
- Logout
- FCM token registration
- Foreground notification
- Background notification
- Deep link/open action if configured
- No blocking WebView console/runtime error

## Public web acceptance

Automated by `production-smoke.yml`:

- home
- services
- engineering
- gallery
- documents
- quote page
- robots.txt
- sitemap.xml
- web manifest
- admin shell
- security response headers

## Pass criteria

A release is accepted only when:

1. Static/security CI is successful.
2. Production smoke is successful.
3. Android release artifacts pass signing and SHA-256 verification.
4. Authenticated acceptance tests pass for changed areas.
5. Real-device FCM/autofill tests pass when Android code changed.
6. No known P0/P1 regression remains.

## Evidence

Record the release version, commit SHA, test date, device model/Android version, account role, and pass/fail result. Do not record passwords, access tokens, refresh tokens, or private customer data.
