begin;

create or replace function public.set_offer_public_code()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.public_code is null or btrim(new.public_code) = '' then
    loop
      new.public_code := upper(encode(gen_random_bytes(16), 'hex'));
      exit when not exists (
        select 1 from public.teklifler where public_code = new.public_code
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists set_offer_public_code_before_insert on public.teklifler;
create trigger set_offer_public_code_before_insert
before insert on public.teklifler
for each row execute function public.set_offer_public_code();

create or replace function public.ensure_quote_public_code(p_offer_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode = '42501';
  end if;
  if not public.staff_can_any(array['offers.view', 'offers.manage']) then
    raise exception 'Teklif görüntüleme yetkisi gerekli.' using errcode = '42501';
  end if;

  select public_code into v_code from public.teklifler where id = p_offer_id;
  if not found then
    raise exception 'Teklif bulunamadı.';
  end if;
  if v_code is not null and v_code <> '' then
    return v_code;
  end if;

  loop
    v_code := upper(encode(gen_random_bytes(16), 'hex'));
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

revoke all on function public.set_offer_public_code() from public, anon, authenticated;
revoke all on function public.ensure_quote_public_code(uuid) from public, anon, authenticated;
grant execute on function public.ensure_quote_public_code(uuid) to authenticated;

commit;