-- 1) Hizmet başına varsayılan malzeme (Ses/Işık/Truss kaç adet)
create table if not exists public.service_equipment_defaults (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (service_id, equipment_id)
);
create index if not exists service_equipment_defaults_svc_idx on public.service_equipment_defaults(service_id);

alter table public.service_equipment_defaults enable row level security;
drop policy if exists service_bom_admin on public.service_equipment_defaults;
create policy service_bom_admin on public.service_equipment_defaults
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists service_bom_staff_read on public.service_equipment_defaults;
create policy service_bom_staff_read on public.service_equipment_defaults
  for select to authenticated
  using (public.staff_has_perm('pricing') or public.staff_has_perm('equipment') or public.is_admin());

grant select on public.service_equipment_defaults to authenticated;

-- 2) Personel fiyat listesi: hizmet + kurallar (tür bilgisiyle)
create or replace view public.pricing_staff as
select
  s.id,
  s.name,
  coalesce(s.description, '') as description,
  s.base_price,
  s.sort_order,
  'service'::text as kind,
  'fixed'::text as rule_type,
  null::numeric as rule_value
from public.services s
where s.active = true
  and public.staff_has_perm('pricing')
union all
select
  r.id,
  r.name,
  coalesce(r.notes, '') as description,
  r.value as base_price,
  9000 as sort_order,
  'rule'::text as kind,
  r.rule_type,
  r.value as rule_value
from public.price_rules r
where r.active = true
  and public.staff_has_perm('pricing');

grant select on public.pricing_staff to authenticated;

-- 3) Personel: hizmet malzeme listesi
create or replace view public.service_bom_staff as
select
  d.id,
  d.service_id,
  s.name as service_name,
  d.equipment_id,
  e.category,
  e.brand,
  e.model,
  d.quantity,
  d.notes
from public.service_equipment_defaults d
join public.services s on s.id = d.service_id
join public.equipment e on e.id = d.equipment_id
where s.active = true
  and e.active = true
  and (public.staff_has_perm('pricing') or public.staff_has_perm('equipment') or public.is_admin());

grant select on public.service_bom_staff to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.services;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.price_rules;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.service_equipment_defaults;
exception when duplicate_object then null; when undefined_object then null; end $$;

notify pgrst, 'reload schema';
