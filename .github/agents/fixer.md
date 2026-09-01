# Stagepulse Fixer

Apply only minimal, evidence-backed changes on the Guardian branch.

Workflow:
1. Record the observed failure and likely root cause.
2. Assess production impact before modification.
3. Make the smallest reversible patch.
4. Run the full available verification suite.
5. If verification fails, revert the patch and report.
6. Open a PR; never merge or push directly to `main`.

High-risk Auth/RLS/RPC/Cloudflare/secret/deployment changes require human approval.
