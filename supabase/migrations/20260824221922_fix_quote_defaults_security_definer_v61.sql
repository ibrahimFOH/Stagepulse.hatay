-- Fix Admin quote creation: trigger must not require client EXECUTE on next_quote_number().
-- Keep next_quote_number() private; the trigger executes with its owner privileges.
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
    new.public_token := encode(public.gen_random_bytes(24), 'hex');
  end if;

  if new.valid_until is null then
    select quote_valid_days
      into d
      from public.business_settings
     where id = true;

    new.valid_until := coalesce(new.event_date, current_date) + coalesce(d, 7);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Trigger functions are not a client RPC surface. Keep direct execution revoked.
revoke all on function public.set_quote_defaults() from public;
revoke all on function public.set_quote_defaults() from anon;
revoke all on function public.set_quote_defaults() from authenticated;
