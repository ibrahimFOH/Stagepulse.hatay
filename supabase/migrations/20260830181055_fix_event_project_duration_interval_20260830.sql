begin;
create or replace function public.sync_job_to_event_project() returns trigger language plpgsql security definer set search_path='public' as $$
declare v_offer public.teklifler%rowtype; v_event_id uuid; v_status text;
begin
  if new.offer_id is not null then select * into v_offer from public.teklifler where id=new.offer_id; end if;
  v_status:=case when lower(coalesce(new.status,'')) in ('completed','complete','done','closed') then 'completed' when lower(coalesce(new.status,'')) in ('cancelled','canceled') then 'cancelled' when lower(coalesce(new.status,'')) in ('active','in_progress','ongoing') then 'active' when lower(coalesce(new.status,'')) in ('confirmed','approved') then 'confirmed' else 'planning' end;
  insert into public.event_projects(offer_id,job_id,title,event_type,status,venue,city,event_start_at,event_end_at,setup_start_at,teardown_end_at,capacity,notes,created_by,updated_at)
  values(new.offer_id,new.id,new.title,coalesce(v_offer.event_type,v_offer.type),v_status,coalesce(new.location,v_offer.location),case when position(',' in coalesce(new.location,v_offer.location,''))>0 then split_part(coalesce(new.location,v_offer.location,''),',',1) else coalesce(new.location,v_offer.location) end,coalesce(new.event_start_at,new.event_at,v_offer.event_start_at,v_offer.event_date::timestamptz),coalesce(new.event_end_at,v_offer.event_end_at,case when v_offer.event_start_at is not null then v_offer.event_start_at+make_interval(hours=>coalesce(v_offer.duration_hours,0)::double precision) else null end),coalesce(new.setup_start_at,new.setup_at,v_offer.event_start_at),coalesce(new.teardown_end_at,new.teardown_at,v_offer.event_end_at),v_offer.people,coalesce(new.notes,v_offer.message),null,now())
  on conflict(job_id) where job_id is not null do update set offer_id=excluded.offer_id,title=excluded.title,event_type=excluded.event_type,status=excluded.status,venue=excluded.venue,city=excluded.city,event_start_at=excluded.event_start_at,event_end_at=excluded.event_end_at,setup_start_at=excluded.setup_start_at,teardown_end_at=excluded.teardown_end_at,capacity=excluded.capacity,notes=excluded.notes,updated_at=now()
  returning id into v_event_id;
  insert into public.event_financials(event_id,estimated_revenue,estimated_cost,currency,updated_at) values(v_event_id,coalesce(v_offer.total,0),coalesce(v_offer.estimated_cost,0),coalesce(v_offer.currency,'TRY'),now()) on conflict(event_id) do update set estimated_revenue=excluded.estimated_revenue,estimated_cost=excluded.estimated_cost,currency=excluded.currency,updated_at=now();
  return new;
end; $$;
revoke execute on function public.sync_job_to_event_project() from public,anon,authenticated;
commit;
