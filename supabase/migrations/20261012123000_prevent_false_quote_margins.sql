-- Missing internal costs must remain NULL, never look like a zero-cost / high-margin job.
create or replace function private.staff_create_offer(
 p_name text,p_company text default null,p_phone text default null,p_email text default null,
 p_type text default null,p_event_type text default null,p_location text default null,
 p_people integer default null,p_event_date date default null,p_message text default null,
 p_total numeric default 0,p_services jsonb default '[]'::jsonb,p_internal_costs jsonb default '[]'::jsonb
) returns public.teklifler language plpgsql security definer set search_path='' as $$
declare r public.teklifler; c_total numeric:=0; c_discount numeric:=0; c_cost numeric:=0; missing_costs integer:=0; line_count integer:=0; cost_count integer:=0;
begin
 if not public.staff_can_any(array['offers.create','offers.manage']) then raise exception 'Teklif oluşturma yetkiniz yok'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Müşteri adı zorunludur'; end if;
 if jsonb_typeof(coalesce(p_services,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_services,'[]'::jsonb))=0 then raise exception 'En az bir iş kalemi gerekli'; end if;
 select count(*),coalesce(sum(coalesce(nullif(j->>'total','')::numeric,coalesce(nullif(j->>'quantity','')::numeric,1)*coalesce(nullif(j->>'unit_price','')::numeric,nullif(j->>'price','')::numeric,0))),0)
 into line_count,c_total from jsonb_array_elements(p_services) as items(j);
 select count(*) filter(where nullif(j->>'cost_unit','') is not null),coalesce(sum(coalesce(nullif(j->>'cost_total','')::numeric,coalesce(nullif(j->>'quantity','')::numeric,1)*coalesce(nullif(j->>'cost_unit','')::numeric,0))),0)
 into cost_count,c_cost from jsonb_array_elements(coalesce(p_internal_costs,'[]'::jsonb)) as costs(j);
 missing_costs:=line_count-cost_count;
 if missing_costs>0 then c_cost:=null; end if;
 c_discount:=greatest(0,c_total-greatest(0,coalesce(p_total,0)));
 perform pg_catalog.set_config('stagepulse.trusted_offer_write','on',true);
 insert into public.teklifler(name,company,phone,email,type,event_type,location,people,event_date,message,total,estimated_price,estimated_cost,margin,discount,services,internal_costs,status)
 values(nullif(trim(p_name),''),nullif(trim(p_company),''),nullif(trim(p_phone),''),nullif(trim(p_email),''),nullif(trim(p_type),''),nullif(trim(p_event_type),''),nullif(trim(p_location),''),p_people,p_event_date,nullif(trim(p_message),''),greatest(0,coalesce(p_total,0)),greatest(0,coalesce(p_total,0)),c_cost,case when c_cost is null then null else greatest(0,coalesce(p_total,0))-c_cost end,c_discount,coalesce(p_services,'[]'::jsonb),coalesce(p_internal_costs,'[]'::jsonb),'preparing')
 returning * into r;
 perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true);
 return r;
exception when others then perform pg_catalog.set_config('stagepulse.trusted_offer_write','off',true); raise;
end; $$;
