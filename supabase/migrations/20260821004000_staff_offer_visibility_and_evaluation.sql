begin;
create or replace function public.staff_assigned_offers()
returns table (offer_id uuid,job_id uuid,quote_number text,status text,event_start_at timestamptz,event_end_at timestamptz,validity_until timestamptz,response_status text,response_note text,responded_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select t.id,j.id,t.quote_number,t.status,coalesce(t.event_start_at,j.event_start_at,j.event_at),coalesce(t.event_end_at,j.event_end_at,j.event_at),t.validity_until,js.response_status,js.response_note,js.responded_at
 from public.teklifler t join public.jobs j on j.offer_id=t.id join public.job_staff js on js.job_id=j.id join public.staff s on s.id=js.staff_id
 where s.user_id=auth.uid() and s.active=true order by coalesce(t.event_start_at,j.event_start_at,j.event_at) nulls last,t.created_at desc;
$$;
grant execute on function public.staff_assigned_offers() to authenticated;
notify pgrst,'reload schema';
commit;
