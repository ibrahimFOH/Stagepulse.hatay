# Stagepulse Jarvis OS — Security Test Plan

- [x] Patron authorization enforced server-side
- [x] Critical writes require `jarvis_approvals`
- [x] Approval payload SHA-256 checked before execution
- [x] Approval state is server-backed for multi-device sync
- [x] Repo path traversal blocked
- [x] Browser never receives service-role credentials
- [x] Audit records are server-side
- [x] Existing production `staff-ai` remains JWT-protected
- [ ] GitHub write E2E — requires Supabase `GITHUB_TOKEN`
- [ ] Real-device approval E2E — requires authenticated tablet/browser session
- [ ] Production Capacitor signing/distribution — requires signing credentials/keystore already held by owner
