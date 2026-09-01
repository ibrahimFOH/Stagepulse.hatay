# Migration history → clean baseline

Production schema is live; do **not** delete applied migrations without repairing remote history.

## Safe procedure

1. Snapshot / backup the Supabase project.
2. Dump schema-only:
   ```bash
   supabase link --project-ref <ref>
   supabase db dump --schema-only -f supabase/schema_baseline_dump.sql
   ```
3. Create a single baseline migration (timestamp after the last applied remote version):
   ```bash
   # archive old files
   mkdir -p supabase/migrations_archive
   mv supabase/migrations/*.sql supabase/migrations_archive/
   ```
4. Add `supabase/migrations/YYYYMMDDHHMMSS_baseline.sql` with the current schema
   (or a no-op marker if schema is already applied).
5. Align remote history:
   ```bash
   supabase migration repair --status applied <baseline_version>
   # mark archived versions as reverted/ignored as needed per supabase CLI docs
   ```
6. Verify:
   ```bash
   supabase db push --dry-run
   supabase migration list
   ```

Empty `reconcile_remote_history.sql` files are historical markers only; they can be archived once the baseline is accepted on all environments.
