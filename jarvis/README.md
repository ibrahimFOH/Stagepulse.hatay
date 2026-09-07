# Stagepulse Jarvis OS

Canonical live path: `/jarvis/`.

## Live
- Public Jarvis: `/jarvis/public/site-jarvis.js`
- Patron: `/jarvis/admin/`
- Portal bridge: `/jarvis/portal/patron-bridge.js`
- Supabase state: `jarvis_approvals`, `jarvis_audit`, `jarvis_agents`, `jarvis_memory`
- Critical writes are approval-gated.
- Approval state is server-backed, so multiple devices read the same queue.
- Repo changes use path + content and are executed only after approval.

## Manual production secret
Set `GITHUB_TOKEN` in Supabase Edge Function secrets before GitHub read/write or approve/apply can work. `OPENAI_API_KEY` is optional; without it, deterministic/local behavior remains available.

Do not put secrets in this repository or browser configuration.
