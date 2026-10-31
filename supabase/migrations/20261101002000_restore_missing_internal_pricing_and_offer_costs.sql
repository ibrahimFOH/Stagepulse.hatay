-- Restore Stagepulse internal costs independently from the public price catalog.
-- Internal unit costs must never be exposed through public customer pricing.
create table if not exists public.internal_pricing (
  id uuid primary key default gen_random_uuid(),
  published_pricing_id uuid unique references public.published_pricing(id) on delete set null,
  category text not null,
  item_name text not null unique,
  cost_price numeric(12,2),
  target_margin_pct numeric(6,2),
  notes text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint internal_pricing_cost_nonnegative check (cost_price is null or cost_price >= 0),
  constraint internal_pricing_margin_range check (
    target_margin_pct is null or (target_margin_pct >= 0 and target_margin_pct <= 500)
  )
);

insert into public.internal_pricing(published_pricing_id, category, item_name, cost_price, target_margin_pct)
select id, category, item_name, null, null
from public.published_pricing
on conflict (item_name) do update
set published_pricing_id = excluded.published_pricing_id,
    category = excluded.category,
    updated_at = now();

create index if not exists idx_internal_pricing_active_category
  on public.internal_pricing(active, category, item_name);

alter table public.internal_pricing enable row level security;
drop policy if exists internal_pricing_admin_all on public.internal_pricing;
create policy internal_pricing_admin_all
  on public.internal_pricing
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.internal_pricing from anon, public;
grant select, insert, update, delete on public.internal_pricing to authenticated;

alter table public.teklifler
  add column if not exists internal_costs jsonb not null default '[]'::jsonb;

comment on column public.teklifler.internal_costs is
  'Private item-level costs. Never include in public quote views or customer PDFs.';

notify pgrst, 'reload schema';
