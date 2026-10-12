-- Fix quote creation on Supabase projects where pgcrypto.gen_random_bytes(integer)
-- is unavailable. PostgreSQL's built-in gen_random_uuid() is used instead.
-- Remove the column default because defaults are evaluated before BEFORE triggers.
alter table public.teklifler alter column public_token drop default;

create or replace function public.set_quote_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer;
begin
  if new.quote_number is null or new.quote_number = '' then
    new.quote_number := public.next_quote_number();
  end if;

  if new.public_token is null or new.public_token = '' then
    new.public_token :=
      replace(pg_catalog.gen_random_uuid()::text, '-', '') ||
      replace(pg_catalog.gen_random_uuid()::text, '-', '');
  end if;

  if new.valid_until is null then
    select quote_valid_days into d
    from public.business_settings
    where id = true;
    new.valid_until := coalesce(new.event_date, current_date) + coalesce(d, 7);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Existing public-code generation could also call gen_random_bytes().
create or replace function public.ensure_quote_public_code(p_offer_id uuid)
returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '42501';
  end if;
  if not public.staff_can_any(array['offers.view','offers.manage']) then
    raise exception 'Teklif görüntüleme yetkisi gerekli.' using errcode = '42501';
  end if;

  select public_code into v_code
  from public.teklifler
  where id = p_offer_id;
  if not found then
    raise exception 'Teklif bulunamadı.';
  end if;
  if v_code is not null and v_code <> '' then
    return v_code;
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (
      select 1 from public.teklifler where public_code = v_code
    );
  end loop;

  update public.teklifler
  set public_code = v_code, updated_at = now()
  where id = p_offer_id;
  return v_code;
end;
$$;

revoke all on function public.ensure_quote_public_code(uuid) from public, anon;
grant execute on function public.ensure_quote_public_code(uuid) to authenticated;
