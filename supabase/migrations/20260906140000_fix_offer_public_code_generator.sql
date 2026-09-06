-- Canonical public quote code generator.
-- pgcrypto's gen_random_bytes() is not available in production; use the
-- built-in UUID generator and keep the existing uniqueness loop.
create or replace function public.set_offer_public_code()
returns trigger
language plpgsql
set search_path='public','pg_temp'
as $$
begin
  if new.public_code is null or btrim(new.public_code) = '' then
    loop
      new.public_code := upper(replace(gen_random_uuid()::text, '-', ''));
      exit when not exists (
        select 1 from public.teklifler where public_code = new.public_code
      );
    end loop;
  end if;
  return new;
end;
$$;
