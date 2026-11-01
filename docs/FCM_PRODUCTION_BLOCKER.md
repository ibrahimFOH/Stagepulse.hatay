# FCM Production Readiness

Status: DATABASE SCHEMA DEPLOYED; Edge Function deployment and real-device delivery acceptance remain pending.

## Verified in the live Supabase project

- `public.notification_devices` exists with `push_type`, `app_variant`, and `subscription_updated_at`.
- RLS is enabled and self-access policies restrict authenticated users to their own device rows.
- Device registrations are unique by `(user_id, token, app_variant)`, allowing one user to register multiple devices and both app variants.
- `public.register_notification_device(text,text,text)` is granted to authenticated only; anon execution is revoked.
- Notification push queue columns and the bounded retry index are installed.
- The Android registration Edge Function source now filters an existing row by user, token, push type, and app variant. CORS allows only the canonical Stagepulse origins and local development origins.

## Still required before push delivery is production-ready

1. Deploy `register-android-device` with JWT verification enabled.
2. Deploy `send-fcm-notification` with its manifest setting (`verify_jwt=false`); its internal admin authorization and one-time dispatch token checks remain mandatory.
3. Confirm the Supabase Edge Function secret `FIREBASE_SERVICE_ACCOUNT_JSON` is configured, or configure `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`. Do not put these values in GitHub source or client applications.
4. Enable the automatic retry/dispatch trigger only after the sender function and Firebase secret are verified. The old migration contains a retired project URL and must not be applied unchanged.
5. Install current Admin and Personel Android builds, register both variants, and test foreground, background, terminated-app delivery, stale-token deactivation, and tap-to-open behavior.

## Acceptance boundary

A successful schema migration or APK build does not prove that Firebase delivered a notification to a physical device. Record app version, device model, Android version, account role, and pass/fail results without recording tokens or credentials.
