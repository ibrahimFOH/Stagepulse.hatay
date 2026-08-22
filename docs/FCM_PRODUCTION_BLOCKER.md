# FCM Production Readiness

Status: IMPLEMENTED in repository; final device delivery verification remains a runtime test.

Implemented:
- Firebase Web Messaging configuration for the Stagepulse Firebase project.
- Public VAPID key configuration in the client; no Admin private key is committed.
- FCM service worker for background/terminated delivery.
- Authenticated device-token registration into `notification_devices` for both admin and staff variants.
- Server-side FCM HTTP v1 send path through `send-fcm-notification` using Supabase secrets for the Firebase service-account credentials.
- Stale/unregistered FCM tokens are automatically deactivated after a failed send.
- Admin notification composer sends an in-app notification and attempts push delivery to registered devices.
- Staff notification inbox, read state, and notification preferences.
- Android 13+ browser/TWA notification permission is requested by the registration flow.

Remaining runtime verification:
- Log into `/admin/` and `/portal/` on real Android devices and grant notification permission.
- Confirm a row appears in `notification_devices` for each device.
- Send a test notification from Admin → Bildirimler.
- Verify foreground, background and terminated-app delivery and tap-to-open behavior.

No Firebase Admin private key or service-account JSON is committed to the repository.
