# FCM Production Readiness

Status: DATABASE READY; sender and Production OS Edge Functions deployed; Android device registration and real-device delivery acceptance remain pending.

## Verified in the live Supabase project

- `public.notification_devices` exists with `push_type`, `app_variant`, and `subscription_updated_at`.
- RLS is enabled and self-access policies restrict authenticated users to their own device rows.
- Device registrations are unique by `(user_id, token, app_variant)`, allowing one user to register multiple devices and both app variants.
- `public.register_notification_device(text,text,text)` is granted to authenticated only; anon execution is revoked.
- Notification push queue columns and the bounded retry index are installed.
- `production-os` Edge Function is active with `verify_jwt=false` and its own authorization checks.
- `send-fcm-notification` Edge Function is active with `verify_jwt=false`; manual sends require admin authorization and internal dispatch requires the one-time notification dispatch token.
- The Android registration source now filters an existing row by user, token, push type, and app variant. CORS allows only canonical Stagepulse origins and local development origins; deployment awaits the validated PR.

## Still required before push delivery is production-ready

1. Merge and deploy the corrected `register-android-device` function with JWT verification enabled.
2. Confirm that the Edge Function secret `FIREBASE_SERVICE_ACCOUNT_JSON` exists, or configure `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`. The current connector cannot enumerate Edge Function secret values/names, so their presence is not claimed as verified.
3. Send one manual test notification to an Admin account and one to a Personel account.
4. Enable automatic retry/dispatch only after sender credentials and manual delivery are verified. The historical migration contains a retired project URL and must not be applied unchanged.
5. Install current Admin and Personel Android builds, register both variants, and test foreground, background, terminated-app delivery, stale-token deactivation, and tap-to-open behavior.

## Acceptance boundary

A successful schema migration or APK build does not prove that Firebase delivered a notification to a physical device. Record app version, device model, Android version, account role, and pass/fail results without recording tokens or credentials.
