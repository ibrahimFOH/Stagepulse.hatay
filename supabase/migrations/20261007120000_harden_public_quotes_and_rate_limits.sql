-- Harden public quote intake and login rate limiting.
create schema if not exists private;

create table if not exists private.rate_limits (
  key text not null,
  request_at timestamptz not null default now()
);
create index if not exists rate_limits_key_request_at_idx
  on private.rate_limits(key, request_at desc);

revoke all on schema private from anon, authenticated;

create or replace function public.check_login_rate_limit(
  p_key text,
  p_max integer default 10
) returns boolean
language plpgsql
security definer
set search_path=public,private
as $$
declare c integer;
begin
  if p_key is null or length(trim(p_key)) = 0 then return false; end if;
  delete from private.rate_limits where request_at < now() - interval '10 minutes';
  select count(*) into c from private.rate_limits
   where key=p_key and request_at >= now() - interval '1 minute';
  if c >= greatest(1,p_max) then return false; end if;
  insert into private.rate_limits(key) values(p_key);
  return true;
end;
$$;

revoke all on function public.check_login_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.check_login_rate_limit(text,integer) to service_role;

create or replace function public.enforce_public_quote_input()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.role() in ('anon','authenticated') then
    new.quote_number := null;
    new.customer_id := null;
    new.status := 'new';
    new.currency := 'TRY';
    new.estimated_cost := 0;
    new.estimated_price := 0;
    new.discount := 0;
    new.total := 0;
    new.margin := 0;
    new.public_token := null;
    new.valid_until := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.archived_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_public_quote_input on public.teklifler;
create trigger trg_enforce_public_quote_input
before insert on public.teklifler
for each row execute function public.enforce_public_quote_input();

create or replace function public.enforce_public_quote_rate_limit()
returns trigger
language plpgsql
security definer
set search_path=public,private
as $$
declare client_key text;
begin
  if auth.role() in ('anon','authenticated') then
    client_key := 'quote:' || coalesce(
      split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1),
      'unknown'
    );
    if not public.check_login_rate_limit(client_key, 8) then
      raise exception 'Çok fazla teklif talebi. Lütfen daha sonra tekrar deneyin.';
    end if;
    if length(coalesce(new.name,'')) < 2 or length(new.name) > 160 then
      raise exception 'Geçersiz ad';
    end if;
    if new.people is not null and (new.people < 1 or new.people > 100000) then
      raise exception 'Geçersiz kişi sayısı';
    end if;
    if length(coalesce(new.message,'')) > 5000 then
      raise exception 'Mesaj çok uzun';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_public_quote_rate_limit on public.teklifler;
create trigger trg_enforce_public_quote_rate_limit
before insert on public.teklifler
for each row execute function public.enforce_public_quote_rate_limit();

revoke all on table public.teklifler from anon,authenticated;
grant insert on public.teklifler to anon,authenticated;

notify pgrst, 'reload schema';


alter function public.set_quote_defaults() set search_path=public,pg_temp;
revoke all on function public.enforce_public_quote_input() from public,anon,authenticated;
revoke all on function public.enforce_public_quote_rate_limit() from public,anon,authenticated;


create or replace function public.set_offer_public_code()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.public_code is null or btrim(new.public_code)='' then
    loop
      new.public_code:=upper(replace(gen_random_uuid()::text,'-',''));
      exit when not exists(select 1 from public.teklifler where public_code=new.public_code);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.set_offer_public_code() from public,anon,authenticated;


create or replace function public.set_quote_defaults()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare d integer;
begin
 if new.quote_number is null or new.quote_number='' then new.quote_number:=public.next_quote_number(); end if;
 if new.public_token is null or new.public_token='' then new.public_token:=encode(gen_random_bytes(24),'hex'); end if;
 if new.valid_until is null then select quote_valid_days into d from public.business_settings where id=true; new.valid_until:=coalesce(new.event_date,current_date)+coalesce(d,7); end if;
 new.updated_at:=now(); return new;
end;
$$;
revoke all on function public.set_quote_defaults() from public,anon,authenticated;


create or replace function public.on_quote_insert_enrich()
returns trigger language plpgsql security definer set search_path=public as $$
declare c_id uuid; svc public.services; margin_pct numeric:=35; min_quote numeric:=0; base numeric:=0; price numeric:=0; per_person numeric:=0;
begin
 select id into c_id from public.customers where phone=new.phone limit 1;
 if c_id is null then insert into public.customers(name,company,phone,email,last_contact_at) values(new.name,new.company,new.phone,new.email,now()) returning id into c_id;
 else update public.customers set name=coalesce(nullif(new.name,''),name),company=coalesce(nullif(new.company,''),company),email=coalesce(nullif(new.email,''),email),last_contact_at=now(),updated_at=now() where id=c_id; end if;
 new.customer_id:=c_id;
 select * into svc from public.services where name=new.type and active=true limit 1;
 if found then base:=coalesce(svc.base_price,0); end if;
 select value into margin_pct from public.price_rules where name='Varsayılan kâr marjı' and active=true limit 1;
 select value into min_quote from public.price_rules where name='Minimum teklif' and active=true limit 1;
 select value into per_person from public.price_rules where name='Kişi başı ek ücret' and active=true limit 1;
 if per_person is null then per_person:=0; end if;
 price:=base+coalesce(new.people,0)*per_person;
 if price<coalesce(min_quote,0) then price:=coalesce(min_quote,0); end if;
 if price=0 and base>0 then price:=base; end if;
 new.estimated_price:=round(price,2);
 if margin_pct is not null and margin_pct>0 then new.estimated_cost:=round(price/(1+(margin_pct/100)),2); else new.estimated_cost:=coalesce(svc.base_cost,0); end if;
 new.total:=new.estimated_price; new.margin:=new.total-new.estimated_cost; return new;
end;
$$;
