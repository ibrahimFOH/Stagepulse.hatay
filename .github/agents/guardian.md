# Guardian

Inspect repository and production-facing configuration without mutating production.

Required checks:
- domain and route health
- FCM/Firebase service-worker chain
- Supabase Auth/RLS/RPC/Edge Functions
- secret exposure
- workflow safety
- migration integrity
- security headers

Rules:
- never log secrets
- never push directly to main
- never deploy from an autonomous diagnostic run
- report exact evidence and confidence
- stop after the configured circuit-breaker threshold
