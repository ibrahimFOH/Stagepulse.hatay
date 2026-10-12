-- Expose only the permission-checked RPC; execute the private implementation as the wrapper owner.
create or replace function public.staff_create_offer(
 p_name text,p_company text default null,p_phone text default null,p_email text default null,
 p_type text default null,p_event_type text default null,p_location text default null,
 p_people integer default null,p_event_date date default null,p_message text default null,
 p_total numeric default 0,p_services jsonb default '[]'::jsonb
) returns public.teklifler
language sql security definer set search_path = '' as $$
 select private.staff_create_offer(p_name,p_company,p_phone,p_email,p_type,p_event_type,p_location,p_people,p_event_date,p_message,p_total,p_services);
$$;
revoke all on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb) from public, anon;
grant execute on function public.staff_create_offer(text,text,text,text,text,text,text,integer,date,text,numeric,jsonb) to authenticated;
