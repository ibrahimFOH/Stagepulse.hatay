-- Staff customer CRUD + staff read access to Gelir · Gider.
-- Additive migration. Existing admin policies remain unchanged.

create or replace function public.staff_has_perm(perm text)
returns boolean
language sql stable security invoker
set search_path='public, pg_temp'
as $$
  with aliases(canonical, legacy) as (
    values
      ('schedule.view','jobs'),('schedule.view','view_assigned_jobs'),
      ('jobs.accept','accept_job'),('jobs.reject','reject_job'),
      ('jobs.status.update','update_job_status'),('jobs.notes.update','update_job_notes'),
      ('jobs.equipment.manage','manage_job_equipment'),('jobs.documents.view','view_job_documents'),
      ('equipment.view','equipment'),('equipment.checkout','equipment_checkout'),('equipment.return','equipment_return'),
      ('offers.view','offers'),('offers.approve','offer_approve'),
      ('customers.view','customers'),('customers.create','customers_manage'),('customers.create','customers'),
      ('customers.update','customers_manage'),('customers.update','customers'),('customers.delete','customers_delete'),
      ('payments.view','finance'),('pricing.view','pricing'),('pricing.manage','pricing_manage'),
      ('financials.view','financials'),('notifications.view','notifications_view'),('notifications.send','whatsapp_send'),
      ('staff.view','personnel_view'),('staff.manage','personnel_manage'),('analytics.view','analytics'),
      ('activity.view','activity_view'),('dashboard.view','dashboard_view'),('settings.update','settings_manage'),
      ('settings.view','settings_manage'),('profile.update','profile_update'),('files.upload','file_upload'),
      ('team.view','view_team'),('issues.create','report_issue'),('settlements.view','settlements_view'),('settlements.view','financials')
  )
  select exists (select 1 from public.admin_profiles a where a.user_id=(select auth.uid()) and a.active=true)
  or exists (
    select 1 from public.staff_permissions sp
    join public.permission_catalog pc on pc.key=sp.permission_key and pc.active=true
    where sp.user_id=(select auth.uid()) and sp.enabled=true
      and (sp.permission_key=perm or sp.permission_key in (select legacy from aliases where canonical=perm))
  )
  or exists (
    select 1 from public.staff_profiles p
    where p.user_id=(select auth.uid()) and p.active=true
      and (coalesce((p.permissions ->> perm)::boolean,false)
        or exists (select 1 from aliases a where a.canonical=perm and coalesce((p.permissions ->> a.legacy)::boolean,false)))
  );
$$;
revoke all on function public.staff_has_perm(text) from public, anon;
grant execute on function public.staff_has_perm(text) to authenticated;

create or replace function public.staff_can_any(p_keys text[])
returns boolean language sql stable security definer set search_path='public, private'
as $$
select public.is_admin() or exists (select 1 from unnest(p_keys) k(permission_key) where public.staff_has_perm(k.permission_key));
$$;
revoke all on function public.staff_can_any(text[]) from public;
grant execute on function public.staff_can_any(text[]) to authenticated;

create or replace function public.staff_delete_customer(p_id uuid)
returns public.customers language plpgsql security definer set search_path='public, private'
as $$
declare r public.customers;
begin
  if not public.staff_has_perm('customers.delete') then raise exception 'Müşteri silme yetkiniz yok'; end if;
  delete from public.customers where id=p_id returning * into r;
  if not found then raise exception 'Müşteri bulunamadı'; end if;
  return r;
end;
$$;
revoke all on function public.staff_delete_customer(uuid) from public;
grant execute on function public.staff_delete_customer(uuid) to authenticated;

-- Staff sees only operational income/expense fields; owner/supplier share details stay private.
create or replace function public.staff_list_settlements()
returns table(id uuid,title text,offer_id uuid,event_date date,location text,agreed_amount numeric,expense_amount numeric,net_amount numeric,status text,notes text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='public, private'
as $$
  select s.id,s.title,s.offer_id,s.event_date,s.location,s.agreed_amount,s.expense_amount,s.net_amount,s.status,s.notes,s.created_at,s.updated_at
  from public.settlements s
  where public.staff_has_perm('settlements.view') and s.status <> 'cancelled'
  order by s.event_date desc nulls last, s.created_at desc;
$$;
revoke all on function public.staff_list_settlements() from public;
grant execute on function public.staff_list_settlements() to authenticated;

create or replace function public.staff_financial_summary()
returns table(total_revenue numeric,total_expense numeric,total_net numeric,job_count integer)
language sql stable security definer set search_path='public, private'
as $$
  select coalesce(sum(s.agreed_amount),0),
         coalesce(sum(case when s.revenue_owner_type='shared' then s.expense_amount else 0 end),0),
         coalesce(sum(s.agreed_amount-case when s.revenue_owner_type='shared' then s.expense_amount else 0 end),0),
         count(*)::integer
  from public.settlements s
  where public.staff_has_perm('settlements.view') and s.status <> 'cancelled';
$$;
revoke all on function public.staff_financial_summary() from public;
grant execute on function public.staff_financial_summary() to authenticated;

notify pgrst,'reload schema';
