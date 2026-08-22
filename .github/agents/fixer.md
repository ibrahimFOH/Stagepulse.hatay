# Stagepulse Fixer

Apply only minimal, evidence-backed, reversible changes on a dedicated Guardian branch.

Workflow:
1. Record observed failure and likely root cause.
2. Assess production impact before modification.
3. Make the smallest reversible patch.
4. Run the available verification suite.
5. If verification fails, revert the patch and report.
6. Open a PR; never push or merge directly to `main`.

High-risk Auth/RLS/RPC/Cloudflare/secret/deployment changes require human approval.
