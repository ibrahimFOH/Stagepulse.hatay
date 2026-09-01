ALTER TABLE public.app_versions
  ADD COLUMN IF NOT EXISTS version_code bigint GENERATED ALWAYS AS (apk_version) STORED;

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS available_quantity integer GENERATED ALWAYS AS (
    GREATEST(
      COALESCE(quantity, 0)
      - COALESCE(faulty_quantity, 0)
      - COALESCE(maintenance_quantity, 0)
      - COALESCE(reserved_quantity, 0)
      - COALESCE(in_use_quantity, 0),
      0
    )
  ) STORED;

REVOKE ALL ON FUNCTION public.next_quote_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.next_quote_number() FROM anon;

NOTIFY pgrst, 'reload schema';
