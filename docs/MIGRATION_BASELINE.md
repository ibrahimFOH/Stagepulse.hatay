# Production migration baseline

Production migration history is sealed in
`supabase/migration-baseline.json`. The seal contains the ordered production
ledger count, first/last versions, and a SHA-256 fingerprint over
`version|name|statement_hash`.

## Rules

1. Files at or below `cutoff_version` are preserved historical source. They are
   checksum-protected but are not candidates for automatic production apply.
2. Every new migration must use a version strictly greater than
   `cutoff_version`.
3. Before any apply, the workflow re-reads production and requires the sealed
   historical count and SHA-256 statement fingerprint to match exactly.
4. The complete baseline manifest must match the SHA-256 seal stored in the
   production migration ledger table's PostgreSQL comment metadata. A
   repository change cannot rotate the production seal by itself.
5. Production migrations after the cutoff must be an exact prefix of active
   repository migrations.
6. The existing limit of at most 10 automatically applied migrations remains
   enforced.
7. Each active migration and its ledger insert run in one transaction after an
   advisory lock, an exclusive ledger lock, and an in-transaction history
   recheck of the active prefix, baseline count/range/SHA-256 fingerprint, and
   independent production metadata seal.
8. Never edit the baseline fingerprint to silence drift. Re-run the
   effect/state reconciliation, document a new baseline, and separately rotate
   the production metadata seal through an authorized production change.

The earlier no-op `reconcile_remote_history` files remain immutable historical
source. They no longer pretend to be the complete production ledger.