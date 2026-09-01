begin;

create unique index if not exists event_projects_job_uidx on public.event_projects(job_id) where job_id is not null;
create unique index if not exists event_projects_offer_uidx on public.event_projects(offer_id) where offer_id is not null;

create or replace function public.sync_job_to_event_project()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_offer public.teklifler%rowtype; v_event_id uuid; v_status text;
begin
  if new.offer_id is not null then select * into v_offer from public.teklifler where id=new.offer_id; end if;
  v_status := case when lower(coalesce(new.status,'')) in ('completed','complete','done','closed') then 'completed' when lower(coalesce(new.status,'')) in ('cancelled','canceled') then 'cancelled' when lower(coalesce(new.status,'')) in ('active','in_progress','ongoing') then 'active' when lower(coalesce(new.status,'')) in ('confirmed','approved') then 'confirmed' else 'planning' end;
  insert into public.event_projects(offer_id,job_id,title,event_type,status,venue,city,event_start_at,event_end_at,setup_start_at,teardown_end_at,capacity,notes,updated_at)
  values(new.offer_id,new.id,new.title,coalesce(v_offer.event_type,v_offer.type),v_status,coalesce(new.location,v_offer.location),v_offer.location,coalesce(new.event_start_at,new.event_at,v_offer.event_start_at,v_offer.event_date::timestamptz),coalesce(new.event_end_at,v_offer.event_end_at),coalesce(new.setup_start_at,new.setup_at,v_offer.event_start_at),coalesce(new.teardown_end_at,new.teardown_at,v_offer.event_end_at),v_offer.people,coalesce(new.notes,v_offer.message),now())
  on conflict(job_id) where job_id is not null do update set offer_id=excluded.offer_id,title=excluded.title,event_type=excluded.event_type,status=excluded.status,venue=excluded.venue,city=excluded.city,event_start_at=excluded.event_start_at,event_end_at=excluded.event_end_at,setup_start_at=excluded.setup_start_at,teardown_end_at=excluded.teardown_end_at,capacity=excluded.capacity,notes=excluded.notes,updated_at=now()
  returning id into v_event_id;
  insert into public.event_financials(event_id,estimated_revenue,estimated_cost,currency,updated_at) values(v_event_id,coalesce(v_offer.total,0),coalesce(v_offer.estimated_cost,0),coalesce(v_offer.currency,'TRY'),now()) on conflict(event_id) do update set estimated_revenue=excluded.estimated_revenue,estimated_cost=excluded.estimated_cost,currency=excluded.currency,updated_at=now();
  return new;
end; $$;

drop trigger if exists trg_sync_job_to_event_project on public.jobs;
create trigger trg_sync_job_to_event_project after insert or update of offer_id,title,setup_at,event_at,teardown_at,location,status,notes,event_start_at,event_end_at,setup_start_at,teardown_end_at on public.jobs for each row execute function public.sync_job_to_event_project();

insert into public.event_projects(offer_id,job_id,title,event_type,status,venue,city,event_start_at,event_end_at,setup_start_at,teardown_end_at,capacity,notes)
select j.offer_id,j.id,j.title,t.event_type,case when lower(coalesce(j.status,'')) in ('completed','complete','done','closed') then 'completed' when lower(coalesce(j.status,'')) in ('cancelled','canceled') then 'cancelled' when lower(coalesce(j.status,'')) in ('active','in_progress','ongoing') then 'active' when lower(coalesce(j.status,'')) in ('confirmed','approved') then 'confirmed' else 'planning' end,coalesce(j.location,t.location),t.location,coalesce(j.event_start_at,j.event_at,t.event_start_at,t.event_date::timestamptz),coalesce(j.event_end_at,t.event_end_at),coalesce(j.setup_start_at,j.setup_at,t.event_start_at),coalesce(j.teardown_end_at,j.teardown_at,t.event_end_at),t.people,coalesce(j.notes,t.message)
from public.jobs j left join public.teklifler t on t.id=j.offer_id
on conflict(job_id) where job_id is not null do update set offer_id=excluded.offer_id,title=excluded.title,event_type=excluded.event_type,status=excluded.status,venue=excluded.venue,city=excluded.city,event_start_at=excluded.event_start_at,event_end_at=excluded.event_end_at,setup_start_at=excluded.setup_start_at,teardown_end_at=excluded.teardown_end_at,capacity=excluded.capacity,notes=excluded.notes,updated_at=now();

insert into public.event_financials(event_id,estimated_revenue,estimated_cost,currency)
select ep.id,coalesce(t.total,0),coalesce(t.estimated_cost,0),coalesce(t.currency,'TRY') from public.event_projects ep left join public.teklifler t on t.id=ep.offer_id where t.id is not null on conflict(event_id) do update set estimated_revenue=excluded.estimated_revenue,estimated_cost=excluded.estimated_cost,currency=excluded.currency,updated_at=now();

create or replace function public.validate_event_resource() returns trigger language plpgsql as $$ begin
  if new.resource_type='staff' and (new.staff_user_id is null or new.equipment_id is not null or new.vehicle_id is not null) then raise exception 'staff resource requires staff_user_id only'; end if;
  if new.resource_type='equipment' and (new.equipment_id is null or new.staff_user_id is not null or new.vehicle_id is not null) then raise exception 'equipment resource requires equipment_id only'; end if;
  if new.resource_type='vehicle' and (new.vehicle_id is null or new.staff_user_id is not null or new.equipment_id is not null) then raise exception 'vehicle resource requires vehicle_id only'; end if;
  if new.resource_type='external' and (new.staff_user_id is not null or new.equipment_id is not null or new.vehicle_id is not null) then raise exception 'external resource cannot contain internal resource ids'; end if;
  return new;
end; $$;
drop trigger if exists trg_validate_event_resource on public.event_resources;
create trigger trg_validate_event_resource before insert or update on public.event_resources for each row execute function public.validate_event_resource();

create or replace view public.stagepulse_event_command_view as
select ep.id event_id,ep.job_id,ep.offer_id,ep.title,ep.event_type,ep.status,ep.venue,ep.city,ep.event_start_at,ep.event_end_at,ep.setup_start_at,ep.teardown_end_at,ep.capacity,ep.risk_score,t.customer_id,t.company customer_company,t.name customer_name,t.phone customer_phone,ef.estimated_revenue,ef.estimated_cost,ef.estimated_margin,ef.actual_revenue,ef.actual_cost,ef.actual_margin,ef.currency,(select count(*) from public.event_resources er where er.event_id=ep.id and er.resource_type='staff' and er.status<>'cancelled') staff_count,(select count(*) from public.event_resources er where er.event_id=ep.id and er.resource_type='equipment' and er.status<>'cancelled') equipment_count,(select count(*) from public.event_tasks et where et.event_id=ep.id and et.status<>'cancelled') task_count,(select count(*) from public.event_tasks et where et.event_id=ep.id and et.status='done') completed_task_count from public.event_projects ep left join public.teklifler t on t.id=ep.offer_id left join public.event_financials ef on ef.event_id=ep.id;

commit;
