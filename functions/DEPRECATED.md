# Deprecated Edge Function Tree

This `functions/` tree is retained for compatibility and historical reference only.

## Source of truth

The production Edge Function source of truth is:

```text
supabase/functions/
```

Do not add new authorization, authentication, permission, or business logic under this directory.
New changes must be made under `supabase/functions/` and validated against the deployed Supabase configuration.

The legacy files are intentionally **not deleted** to preserve compatibility and rollback history.
