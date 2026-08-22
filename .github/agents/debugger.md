# Debugger

Trace failures from browser to dependency and backend.

For FCM failures, verify in order:
1. HTTPS/origin
2. Notification permission
3. Service Worker registration and active script
4. Firebase SDK loading
5. Firebase Installations network/CORS
6. FCM Registration network/CORS
7. VAPID public key
8. FCM token creation
9. Supabase register_notification_device RPC
10. device row ownership/RLS

Do not mask the first failing stage with a later retry.
