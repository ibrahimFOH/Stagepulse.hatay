# FCM Production Readiness

Status: BACKEND VERIFIED; Android registration is active in production; final notification delivery remains a real-device observation.

Repository and production checks completed:
- Firebase Web Messaging configuration is tied to the Stagepulse Firebase project.
- Public VAPID configuration only; no Firebase Admin private key is committed.
- Dedicated FCM service worker is present for background/terminated web delivery.
- Single canonical portal FCM registration entrypoint (`fcm-register-v3.js`) is used.
- Obsolete FCM registration implementations are removed.
- Authenticated Android device registration is implemented for `admin` and `staff` variants.
- Android personel flavor now sends the canonical backend value `app_variant=staff`.
- Android registration no longer continues retrying after a successful registration.
- The registration Edge Function now rejects unknown variants and verifies the authenticated user's active admin/staff profile before writing a device record.
- Production `register-android-device` is deployed and active as version 5 with JWT verification enabled.
- Supabase production logs show version 4 of `register-android-device` returning HTTP 200 for current registration traffic before the version 5 authorization hardening deployment.
- Production database verification currently shows active Android FCM registrations for both variants: `platform=android`, `push_type=fcm`, `app_variant=staff`, `active=true` and `platform=android`, `push_type=fcm`, `app_variant=admin`, `active=true`.
- Server-side FCM HTTP v1 send path uses runtime Supabase secrets for Firebase service-account credentials.
- Stale/unregistered FCM tokens are automatically deactivated after failed sends.
- Android/TWA notification channel and `POST_NOTIFICATIONS` handling are present.
- APK CI validates both Firebase Android package registrations and builds separate Personel/Admin APK artifacts.

Final runtime verification:
1. Install the newest Personel APK and Admin APK generated from the current `main` branch.
2. Grant Android notification permission.
3. Log into `/portal/` with the staff account and `/admin/` with the admin account.
4. Confirm the corresponding `notification_devices` row remains active with `platform=android`, `push_type=fcm`, and `app_variant=staff` or `admin`.
5. From Admin → Bildirimler, send one test notification to the staff account and one to the admin account.
6. Verify foreground, background, and terminated-app delivery and tap-to-open behavior.

No Firebase Admin private key or service-account JSON is committed to the repository.
