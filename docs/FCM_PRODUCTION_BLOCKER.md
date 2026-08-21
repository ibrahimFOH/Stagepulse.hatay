# FCM Production Blocker

Status: BLOCKED until Firebase project configuration is supplied and verified.

Repository verification found no Firebase Messaging SDK, service worker messaging implementation, Firebase configuration, `google-services.json`, or FCM token registration path. The TWA manifests only enable the Android notification capability.

Required before claiming Android push production-ready:
- Firebase project linked to the Android package IDs `com.stagepulse.admin` and `com.stagepulse.staff`.
- Firebase Messaging SDK and service worker/native messaging implementation.
- Device FCM token registration tied to the authenticated user.
- Server-side send path using Firebase Admin credentials stored as secrets, never in the client.
- Android 13+ `POST_NOTIFICATIONS` runtime permission flow.
- Foreground, background and terminated-app delivery tests.
- Token rotation/removal handling and notification preference enforcement.

No fake credentials or placeholder Firebase project configuration is committed by this audit.
