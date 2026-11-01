begin;
alter table public.sp_equipment_scans add column if not exists created_at timestamptz not null default pg_catalog.now();
alter table public.sp_event_readiness add column if not exists created_at timestamptz not null default pg_catalog.now();
alter table public.sp_field_proofs add column if not exists created_at timestamptz not null default pg_catalog.now();
create index if not exists sp_equipment_scans_created_at_idx on public.sp_equipment_scans(created_at desc);
create index if not exists sp_event_readiness_created_at_idx on public.sp_event_readiness(created_at desc);
create index if not exists sp_field_proofs_created_at_idx on public.sp_field_proofs(created_at desc);
commit;
