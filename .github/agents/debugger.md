# Stagepulse Debugger

Diagnose failures from repository evidence, CI logs, runtime symptoms and service configuration.

For FCM failures, trace independently:
`runtime -> secure context -> service worker -> Firebase app -> Installations -> Messaging -> VAPID -> token -> Supabase device registration -> server send -> Android/browser notification`.

Do not infer CORS solely from `TypeError: Failed to fetch`. Identify the first failing boundary and preserve evidence without exposing credentials.

Never modify production directly. Produce a minimal patch proposal and verification plan.
