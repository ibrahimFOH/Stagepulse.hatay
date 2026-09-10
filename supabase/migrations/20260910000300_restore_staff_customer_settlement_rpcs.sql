begin;

create or replace function public.staff_delete_customer(p_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = 'public, pg_temp'
as $$
declare
  result public.customers;
begin
  if not public.staff_has_perm(array['customers.delete', 'customers.manage']) then
    raise exception 'Müşteri silme yetkiniz yok';
  end if;

  delete from public.customers
  where id = p_id
  returning * into result;

  if not found then
    raise exception 'Müşteri bulunamadı';
  end if;

  return result;
end;
$$;
revoke all on function public.staff_delete_customer(uuid) from public, anon;
grant execute on function public.staff_delete_customer(uuid) to authenticated;

create or replace function public.staff_list_settlements()
returns table(
  id uuid,
  title text,
  offer_id uuid,
  event_date date,
  location text,
  agreed_amount numeric,
  expense_amount numeric,
  net_amount numeric,
  status text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = 'public, pg_temp'
as $$
  select
    s.id,
    s.title,
    s.offer_id,
    s.event_date,
    s.location,
    s.agreed_amount,
    s.expense_amount,
    s.net_amount,
    s.status,
    s.notes,
    s.created_at,
    s.updated_at
  from public.settlements s
  where public.staff_has_perm(array['settlements.view', 'finance.manage'])
    and s.status <> 'cancelled'
  order by s.event_date desc nulls last, s.created_at desc;
$$;
revoke all on function public.staff_list_settlements() from public, anon;
grant execute on function public.staff_list_settlements() to authenticated;

create or replace function public.staff_financial_summary()
returns table(
  total_revenue numeric,
  total_expense numeric,
  total_net numeric,
  job_count integer
)
language sql
stable
security definer
set search_path = 'public, pg_temp'
as $$
  select
    coalesce(sum(s.agreed_amount), 0)::numeric,
    coalesce(sum(
      case when s.revenue_owner_type = 'shared' then s.expense_amount else 0 end
    ), 0)::numeric,
    coalesce(sum(
      s.agreed_amount
      - case when s.revenue_owner_type = 'shared' then s.expense_amount else 0 end
    ), 0)::numeric,
    count(*)::integer
  from public.settlements s
  where public.staff_has_perm(array['settlements.view', 'finance.manage'])
    and s.status <> 'cancelled';
$$;
revoke all on function public.staff_financial_summary() from public, anon;
grant execute on function public.staff_financial_summary() to authenticated;

notify pgrst, 'reload schema';

commit;