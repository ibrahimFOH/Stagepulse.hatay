-- Stagepulse: separate internal cost accounting from customer-facing pricing.
create table if not exists public.internal_pricing (
  id uuid primary key default gen_random_uuid(),
  published_pricing_id uuid unique references public.published_pricing(id) on delete set null,
  category text not null,
  item_name text not null unique,
  cost_price numeric(12,2),
  target_margin_pct numeric(6,2),
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint internal_pricing_cost_nonnegative check (cost_price is null or cost_price >= 0),
  constraint internal_pricing_margin_range check (target_margin_pct is null or (target_margin_pct >= 0 and target_margin_pct <= 500))
);
insert into public.internal_pricing(published_pricing_id,category,item_name,cost_price,target_margin_pct)
select id,category,item_name,null,null from public.published_pricing
on conflict (item_name) do update set published_pricing_id=excluded.published_pricing_id,category=excluded.category,updated_at=now();
alter table public.internal_pricing enable row level security;
drop policy if exists internal_pricing_admin_all on public.internal_pricing;
create policy internal_pricing_admin_all on public.internal_pricing for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.internal_pricing from anon,public;
grant select,insert,update,delete on public.internal_pricing to authenticated;

alter table public.teklifler add column if not exists internal_costs jsonb not null default '[]'::jsonb;
comment on column public.teklifler.internal_costs is 'Private item-level costs. Never include in public quote views or customer PDFs.';

create or replace function private.staff_create_offer(
 p_name text,p_company text default null,p_phone text default null,p_email text default null,
 p_type text default null,p_event_type text default null,p_location text default null,
 p_people integer default null,p_event_date date default null,p_message text default null,
 p_total numeric default 0,p_services jsonb default '[]'::jsonb,p_internal_costs jsonb default '[]'::jsonb
) returns public.teklifler language plpgsql security definer set search_path='' as $$
declare r public.teklifler; c_total numeric:=0; c_discount numeric:=0; c_cost numeric:=0;
begin
 if not public.staff_can_any(array['offers.create','offers.manage']) then raise exception 'Teklif oluşturma yetkiniz yok'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Müşteri adı zorunludur'; end if;
 if jsonb_typeof(coalesce(p_services,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_services,'[]'::jsonb))=0 then raise exception 'En az bir iş kalemi gerekli'; end if;
 select coalesce(sum(coalesce(nullif(j->>'total','')::numeric,coalesce(nullif(j->>'quantity','')::numeric,1)*coalesce(nullif(j->>'unit_price','')::numeric,nullif(j->>'price','')::numeric,0))),0)
 into c_total from jsonb_array_elements(p_services) as items(j);
 select coalesce(sum(coalesce(nullif(j->>'cost_total','')::numeric,coalesce(nullif(j->>'quantity','')::numeric,1)*coalesce(nullif(j->>'cost_unit','')::numeric,0))),0)
 into c_cost from jsonb_array_elements(coalesce(p_internal_costs,'[]'::jsonb)) as costs(j);
 c_discount:=greatest(0,c_total-greatest(0,coalesce(p_total,0)));
 perform pg_catalog.set_config('stagepulse.trusted_offer_write','on',true);
 insert into public.teklifler(name,company,phone,email,type,event_type,location,people,event_date,message,total,estimated_price,estimated_cost,margin,discount,services,internal_costs,status)
 values(nullif(trim(p_name),''),nullif(trim(p_company),''),nullif(trim(p_phone),''),nullif(trim(p_email),''),nullif(trim(p_type),''),nullif(trim(p_event_type),''),nullif(trim(p_location),''),p_people,p_event_date,nullif(trim(p_message),''),greatest(0,coalesce(p_total,0)),greatest(0,coalesce(p_total,0)),c_cost,greatest(0,coalesce(p_total,0))-c_cost,c_discount,coalesce(p_services,'[]'::jsonb),coalesce(p_internal_costs,'[]'::jsonb),'preparing')
 returning * into r;
 perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true);
 return r;
exception when others then perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true); raise;
end; $$;

create or replace function public.staff_create_offer(
 p_name text,p_company text default null,p_phone text default null,p_email text default null,
 p_type text default null,p_event_type text default null,p_location text default null,
 p_people integer default null,p_event_date date default null,p_message text default null,
 p_total numeric default 0,p_services jsonb default '[]'::jsonb,p_internal_costs jsonb default '[]'::jsonb
) returns public.teklifler language sql security definer set search_path='' as $$
 select private.staff_create_offer(p_name,p_company,p_phone,p_email,p_type,p_event_type,p_location,p_people,p_event_date,p_message,p_total,p_services,p_internal_costs);
$$;
revoke all on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb,jsonb) from public,anon;
grant execute on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb,jsonb) to authenticated;
revoke all on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb) to service_role;
