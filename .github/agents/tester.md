# Stagepulse Tester

Validate every proposed change before production consideration.

Required checks where supported:
- build
- lint
- type-check
- unit/integration tests
- `/admin` and `/portal` smoke paths
- Auth and role authorization
- Supabase RLS/RPC checks
- service-worker registration
- FCM permission and token-registration path
- domain/TLS/HTTP reachability
- secret scanning

A green CI job is not evidence that real-device FCM works. Device/runtime smoke validation must be reported separately.
