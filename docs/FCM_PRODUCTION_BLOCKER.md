# FCM Production Readiness

Status: BACKEND/REPOSITORY STABILIZED; final Android delivery verification remains a real-device test.

Implemented and verified in repository:
- Firebase Web Messaging configuration for the Stagepulse Firebase project.
- Public VAPID configuration only; no Firebase Admin private key is committed.
- Dedicated FCM service worker for background/terminated delivery.
- Single canonical portal FCM registration entrypoint (`fcm-register-v3.js`).
- Obsolete FCM registration implementations removed.
- Network diagnostics no longer misreport normal unauthenticated Firebase endpoint responses as browser CORS failures.
- Authenticated device-token registration into `notification_devices` for admin and staff variants.
- Production Supabase notification migrations reconciled and applied; notification device RPC/policy state is synchronized with the repository intent.
- Server-side FCM HTTP v1 send path uses runtime Supabase secrets for Firebase service-account credentials.
- Stale/unregistered FCM tokens are automatically deactivated after failed sends.
- Android/TWA manifests keep notification delegation enabled.
- APK CI now uses current Node/action runtimes and verifies `POST_NOTIFICATIONS` is present in generated APKs.
- Guardian now performs syntax, secret, FCM, TWA, domain, TLS and security-header gates without production mutation.

Final runtime verification:
- Install the newly built Admin and Staff APKs on real Android devices.
- Grant Android notification permission.
- Log into `/admin/` and `/portal/`.
- Confirm a `notification_devices` row is created for each device/app variant.
- Send a test notification from Admin → Bildirimler.
- Verify foreground, background and terminated-app delivery and tap-to-open behavior.

No Firebase Admin private key or service-account JSON is committed to the repository.
