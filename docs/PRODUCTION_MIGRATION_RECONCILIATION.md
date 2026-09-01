# Production migration reconciliation — 2026-09-01

## Result

The production ledger is now the sealed canonical baseline:

- Production ledger rows: **349**
- Repository SQL files inspected: **211**
- Shared version numbers: **100**
- Production-only versions: **249**
- Repository-only versions: **111**
- Canonical production ledger fingerprint:
  `db04f83e8c3d6d414d8b5e11a2f634f957b9777297a77411545406ac37d17744`
- Last production version: `20260831195655`
- Baseline cutoff: `20260901003000`

No production DDL, DML, migration repair, row deletion, or ledger mutation was
performed during reconciliation.

## Effect matching

All 349 production rows were read with version, migration name, and a hash of
their recorded SQL statements. Repository-only files were compared by name,
time proximity, touched object names, and current production catalog state.

The 111 repository-only files were classified as follows:

| Classification | Count | Treatment |
| --- | ---: | --- |
| Equivalent, exact migration name under a different version | 53 | Covered by the production baseline |
| Equivalent/renamed, high-confidence semantic name match | 17 | Covered by the production baseline |
| Superseded or conflicting historical branch | 34 | Preserved as checksum-protected source; never auto-applied |
| Equivalent current state (2026-09-01 tail) | 2 | Covered by production state / targeted ACL repair |
| Missing current state | 4 | Must be re-authored as new, idempotent post-cutoff migrations if still desired |
| Partial conflict | 1 | Login-rate-limit table/function intent must be re-audited and re-authored post-cutoff |

The four missing current-state files are:

- `20260901000000_sync_offer_pdf_state.sql`
- `20260901001500_restore_staff_customer_settlement_rpcs.sql`
- `20260901002000_consolidate_notification_push_retry.sql`
- `20260901002500_harden_notification_scope_pdf_and_dead_letter.sql`

The partial conflict is:

- `20260901000500_login_rate_limit_rpc.sql`

The equivalent tail entries are:

- `20260901001000_finalize_public_quote_access.sql`
- `20260901003000_restore_staff_has_perm_execute_acl.sql`

These files are intentionally not replayed. Several historical files contain
backfills, trigger replacement, privilege changes, and one `TRUNCATE`; applying
the divergent branch wholesale would not be data-safe.

## Applied reconciliation plan

1. Read production with `read_only: true`.
2. Verify each remote version and migration name; hash recorded statements
   without publishing SQL bodies.
3. Audit only repository-touched production objects by catalog name and
   definition hash.
4. Seal the production ledger count and fingerprint in
   `supabase/migration-baseline.json`.
5. Treat all existing SQL files at or below the cutoff as immutable historical
   source, not as an apply queue.
6. Apply only future migrations strictly above the cutoff, and only when
   production's post-cutoff ledger is an exact repository prefix.

## Guard behavior

The prefix/drift guards remain enabled:

- Any change to the 349-row production baseline blocks the workflow.
- Any post-cutoff non-prefix history blocks the workflow.
- More than 10 missing active migrations blocks automatic apply.
- Every migration write is preceded by a fresh baseline and prefix read.
- Every write is followed by ledger readback.

This makes production and the repository show the same canonical history:
the sealed 349-row baseline plus an initially empty post-cutoff active ledger.