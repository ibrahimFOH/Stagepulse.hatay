-- KALICI PERSONEL İŞ LİSTESİ — canonical organization RBAC
-- Personel atamaları auth user_id üzerinden tutulur. Yetki kaynağı
-- admin_capabilities/admin_capability_grants + org_memberships'tir.

create table if not exists public.job_assignments (
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'crew',
  created_at timestamptz not null default now(),
  primary key (job_id, user_id)
);
create index if not exists job_assignments_user_idx on public.job_assignments(user_id);
alter table public.job_assignments enable row level security;

drop policy if exists job_assignments_admin on public.job_assignments;
create policy job_assignments_admin on public.job_assignments
  for all to authenticated
  using (public.is_org_owner())
  with check (public.is_org_owner());

drop policy if exists job_assignments_self_select on public.job_assignments;
create policy job_assignments_self_select on public.job_assignments
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_owner());

create or replace function public.is_active_staff()
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_org_owner()
      or exists (select 1 from public.org_memberships om where om.user_id=auth.uid() and om.active=true);
$$;

create or replace function public.staff_has_perm(p_keys text[])
returns boolean
language sql stable security definer set search_path=public
as $$
  select public.is_org_owner()
      or exists (
        select 1
        from public.admin_capability_grants g
        join public.org_memberships om on om.user_id=g.user_id and om.active=true
        join public.admin_capabilities c on c.key=g.capability_key and c.active=true
        where g.user_id=auth.uid() and g.enabled=true and g.capability_key=any(p_keys)
      );
$$;

revoke all on function public.staff_has_perm(text[]) from public,anon,authenticated;
revoke all on function public.staff_list_jobs() from public,anon,authenticated;
revoke all on function public.is_active_staff() from public,anon,authenticated;

grant execute on function public.is_active_staff() to authenticated;

create or replace function public.staff_list_jobs()
returns setof public.jobs
language sql stable security definer set search_path=public
as $$
  select j.*
  from public.jobs j
  where public.is_active_staff()
    and (
      public.is_org_owner()
      or public.staff_has_perm(array['schedule.view','schedule.manage','jobs.view','jobs.manage'])
      or exists (select 1 from public.job_assignments ja where ja.job_id=j.id and ja.user_id=auth.uid())
    )
  order by j.event_at nulls last, j.created_at desc;
$$;
revoke all on function public.staff_list_jobs() from public,anon,authenticated;

create or replace function public.ensure_job_for_offer(p_offer_id uuid)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  t public.teklifler;
  j_id uuid;
  ev timestamptz;
  su timestamptz;
  td timestamptz;
  ttl text;
  r record;
begin
  if not public.is_org_owner() then raise exception 'Yetkisiz'; end if;
  select * into t from public.teklifler where id=p_offer_id;
  if not found then return null; end if;
  select id into j_id from public.jobs where offer_id=p_offer_id limit 1;
  if j_id is null then
    if t.event_date is not null then
      ev := (t.event_date::text||' 18:00:00')::timestamp;
      su := (t.event_date::text||' 14:00:00')::timestamp;
      td := (t.event_date::text||' 23:00:00')::timestamp;
    end if;
    ttl := trim(both ' ·' from concat_ws(' ·',nullif(t.quote_number,''),nullif(t.name,''),nullif(t.type,'')));
    if ttl is null or ttl='' then ttl:='İş'; end if;
    insert into public.jobs(offer_id,title,location,setup_at,event_at,teardown_at,status,notes)
    values(t.id,ttl,t.location,su,ev,td,'planned',t.message)
    returning id into j_id;
  end if;
  for r in select user_id from public.org_memberships where active=true and user_id<>auth.uid() loop
    insert into public.job_assignments(job_id,user_id,role) values(j_id,r.user_id,'crew') on conflict do nothing;
  end loop;
  return j_id;
end;
$$;
revoke all on function public.ensure_job_for_offer(uuid) from public,anon,authenticated;
grant execute on function public.ensure_job_for_offer(uuid) to authenticated;

drop policy if exists jobs_staff_select on public.jobs;
create policy jobs_staff_select on public.jobs for select to authenticated
using (
  public.is_org_owner()
  or (public.is_active_staff() and (
    public.staff_has_perm(array['jobs.view','schedule.view','schedule.manage'])
    or exists(select 1 from public.job_assignments ja where ja.job_id=jobs.id and ja.user_id=auth.uid())
  ))
);

create or replace view public.my_jobs_staff as
select j.* from public.jobs j
where public.is_active_staff()
  and (public.is_org_owner() or public.staff_has_perm(array['jobs.view','schedule.view','schedule.manage'])
       or exists(select 1 from public.job_assignments ja where ja.job_id=j.id and ja.user_id=auth.uid()));

grant select on public.my_jobs_staff to authenticated;
notify pgrst,'reload schema';
