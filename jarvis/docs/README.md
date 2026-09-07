# JARVIS Runtime Contract

Canonical Patron UI: `/jarvis/admin/`

Runtime flow:
`UI -> Auth -> patron-ai -> live context -> AI/fallback -> approval -> executor -> audit`

Protected Edge Functions:
- `patron-ai`
- `jarvis-tools`
- `jarvis-approve`
- `jarvis-audit`

Client code must use the publishable Supabase key only. Backend secrets remain in Supabase Edge Function secrets. User identity is carried by the Supabase access token in `Authorization: Bearer <jwt>`; the publishable key is sent via `apikey`.

Critical writes require an approval record before execution. Approval payloads are integrity-checked with SHA-256.
