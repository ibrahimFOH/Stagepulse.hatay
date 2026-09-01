-- Gelir-Gider / İş mutabakat tablosu (fiyatlandırmadan bağımsız)
-- Supabase SQL Editor → Run

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  offer_id uuid references public.teklifler(id) on delete set null,
  event_date date,
  location text,
  agreed_amount numeric(14,2) not null default 0,
  expense_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) generated always as (agreed_amount - expense_amount) stored,
  owner_pct numeric(5,2) not null default 100 check (owner_pct between 0 and 100),
  revenue_owner_type text not null default 'owner' check (revenue_owner_type in ('owner','shared','partner')),
  owner_revenue numeric(14,2) generated always as (round(agreed_amount * (owner_pct / 100.0), 2)) stored,
  owner_expense numeric(14,2) generated always as (0::numeric) stored,
  owner_share numeric(14,2) generated always as (round((agreed_amount - case when revenue_owner_type = 'shared' then expense_amount else 0 end) * (owner_pct / 100.0), 2)) stored,
  supplier_share numeric(14,2) generated always as (round((agreed_amount - case when revenue_owner_type = 'shared' then expense_amount else 0 end) * ((100 - owner_pct) / 100.0), 2)) stored,
  status text not null default 'open' check (status in ('open','partial','closed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists settlements_event_date_idx on public.settlements(event_date desc);
create index if not exists settlements_status_idx on public.settlements(status);

alter table public.settlements enable row level security;
drop policy if exists settlements_admin on public.settlements;
create policy settlements_admin on public.settlements
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

grant all on public.settlements to authenticated;

create or replace function public.normalize_settlement_finance()
returns trigger
language plpgsql
as $$
begin
  if new.revenue_owner_type = 'owner' then
    new.owner_pct := 100;
    new.expense_amount := 0;
  elsif new.revenue_owner_type = 'partner' then
    new.owner_pct := 0;
    new.expense_amount := 0;
  elsif new.revenue_owner_type = 'shared' then
    if new.owner_pct is null then new.owner_pct := 33; end if;
    if new.owner_pct < 0 or new.owner_pct > 100 then
      raise exception 'owner_pct 0 ile 100 arasında olmalıdır';
    end if;
  else
    raise exception 'Geçersiz gelir sahibi tipi: %', new.revenue_owner_type;
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_finance_normalize on public.settlements;
create trigger settlements_finance_normalize
before insert or update on public.settlements
for each row execute function public.normalize_settlement_finance();

create or replace view public.owner_financial_summary as
select
  coalesce(sum(s.agreed_amount),0)::numeric(14,2) as total_revenue,
  coalesce(sum(case when s.revenue_owner_type = 'shared' then s.expense_amount else 0 end),0)::numeric(14,2) as total_expense,
  coalesce(sum(s.agreed_amount - case when s.revenue_owner_type = 'shared' then s.expense_amount else 0 end),0)::numeric(14,2) as total_net,
  coalesce(sum(s.owner_revenue),0)::numeric(14,2) as owner_revenue,
  coalesce(sum(s.owner_expense),0)::numeric(14,2) as owner_expense,
  coalesce(sum(s.owner_share),0)::numeric(14,2) as owner_profit,
  count(*)::integer as job_count
from public.settlements s
where s.status <> 'cancelled';

revoke all on public.owner_financial_summary from anon, authenticated;
grant select on public.owner_financial_summary to authenticated;

create or replace function public.get_owner_financial_summary()
returns table(total_revenue numeric, total_expense numeric, total_net numeric, owner_revenue numeric, owner_expense numeric, owner_profit numeric, job_count integer)
language sql stable security definer set search_path=public,private
as $$
  select total_revenue,total_expense,total_net,owner_revenue,owner_expense,owner_profit,job_count
  from public.owner_financial_summary
  where private.is_admin();
$$;
revoke all on function public.get_owner_financial_summary() from public;
grant execute on function public.get_owner_financial_summary() to authenticated;
