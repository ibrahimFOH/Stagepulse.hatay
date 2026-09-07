# Stagepulse JARVIS OS

Canonical Patron path: `/jarvis/admin/`.

Runtime chain:
`UI -> Auth -> Orchestrator -> Live Context/AI -> Approval -> Executor -> Audit -> UI`

State tables:
- `jarvis_approvals`
- `jarvis_audit`
- `jarvis_agents`
- `jarvis_memory`

Security contract:
- Browser/mobile uses only the publishable Supabase key.
- User JWT is sent in `Authorization: Bearer <jwt>`.
- Backend secret keys and provider/GitHub tokens remain in Supabase Edge Function secrets.
- Critical writes are approval-gated and payload-integrity checked.

Legacy `/admin/jarvis/` is not the canonical Patron cockpit.
