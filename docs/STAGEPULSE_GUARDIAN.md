# Stagepulse Autonomous Guardian

```mermaid
flowchart TD
  T[Push / PR / Cron / Manual] --> G[Guardian]
  G --> D[Debugger]
  D --> Q[Tester]
  Q --> F[Fixer]
  F --> B[Dedicated Branch]
  B --> P[Pull Request]
  P --> C[CI Gate]
  C --> H{High Risk?}
  H -- Yes --> A[Human Approval]
  H -- No --> M[Merge by Repository Policy]
  A --> M
  M --> R[Deploy]
  R --> V[Post-deploy Verification]
  V -->|fail| RB[Rollback / Pause]
  V -->|pass| L[Learning / Audit]

  D --> S1[Supabase]
  D --> S2[Firebase / FCM]
  D --> S3[Cloudflare / Domain]
  D --> S4[Formspree / External]
```

## Production impact rule

Every proposed change records whether it can affect production. Diagnostic runs are read-only. Production mutations are never performed by the Guardian workflow itself.

## FCM chain

`HTTPS -> permission -> service worker -> Firebase SDK -> Installations -> FCM registration -> VAPID -> token -> Supabase RPC -> notification_devices`

The browser diagnostic in `portal/fcm-register-v3.js` exposes the first failing stage and a CORS/network probe without logging secrets.
