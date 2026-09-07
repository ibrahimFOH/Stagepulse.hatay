# JARVIS Health Contract

Required end-to-end checks:
1. Auth token accepted.
2. Patron authorization accepted.
3. `patron-ai` responds.
4. Live read tools return structured data.
5. Approval creation is atomic and hash-validated.
6. Approval decision is idempotent.
7. Executor returns a result or records a failure.
8. Audit entry is written.
9. UI displays the result and service errors.
10. Android admin surface keeps existing admin content and only adds JARVIS navigation/voice bridge.

Current source uses `/jarvis/admin/` as the canonical Patron UI and `/jarvis/core/config.js` for function endpoints.
