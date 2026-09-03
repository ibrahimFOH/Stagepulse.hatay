-- AI action compatibility: frontend/legacy clients may send or read a human-readable reason.
alter table public.ai_action_requests add column if not exists reason text;

-- Keep the owner finance summary useful before settlement records exist.
create or replace view public.owner_financial_summary as
with s as (
  select coalesce(sum(agreed_amount),0)::numeric total_revenue,
         coalesce(sum(expense_amount),0)::numeric total_expense,
         coalesce(sum(net_amount),0)::numeric total_net,
         coalesce(sum(owner_revenue),0)::numeric owner_revenue,
         coalesce(sum(owner_expense),0)::numeric owner_expense,
         coalesce(sum(owner_share),0)::numeric owner_profit,
         count(*)::integer job_count
  from public.settlements where status<>'cancelled'
),
o as (
  select coalesce(sum(total),0)::numeric revenue,
         coalesce(sum(estimated_cost),0)::numeric expense,
         count(*)::integer cnt
  from public.teklifler where status='accepted'
)
select case when s.job_count>0 then s.total_revenue else o.revenue end::numeric(14,2) total_revenue,
       case when s.job_count>0 then s.total_expense else o.expense end::numeric(14,2) total_expense,
       case when s.job_count>0 then s.total_net else (o.revenue-o.expense) end::numeric(14,2) total_net,
       case when s.job_count>0 then s.owner_revenue else o.revenue end::numeric(14,2) owner_revenue,
       case when s.job_count>0 then s.owner_expense else o.expense end::numeric(14,2) owner_expense,
       case when s.job_count>0 then s.owner_profit else (o.revenue-o.expense) end::numeric(14,2) owner_profit,
       case when s.job_count>0 then s.job_count else o.cnt end::integer job_count
from s cross join o;
