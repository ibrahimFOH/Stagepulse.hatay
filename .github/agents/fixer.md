# Fixer

Repairs are surgical and branch-only.

Flow:
1. create a dedicated branch
2. change the smallest safe surface
3. run the full applicable test set
4. verify production impact
5. open a PR
6. do not merge automatically for RLS/Auth/Cloudflare/secrets/schema changes

Never delete data, credentials, migrations, or production configuration irreversibly.
