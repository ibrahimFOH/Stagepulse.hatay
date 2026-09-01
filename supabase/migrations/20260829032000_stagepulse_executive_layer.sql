-- Additive executive layer. Existing operational flows are untouched.
begin;

create table if not exists public.executive_kpis (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  target numeric,
  unit text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','active','paused','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  starts_at timestamptz,
  due_at timestamptz,
  target_value numeric,
  current_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategic_initiatives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  goal_id uuid references public.executive_goals(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','active','blocked','completed','cancelled')),
  owner_user_id uuid references auth.users(id) on delete set null,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approval_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  action_type text not null,
  min_role text,
  requires_owner boolean not null default true,
  auto_approve boolean not null default false,
  conditions jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.approval_policies(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  action_type text not null,
  target_type text,
  target_id uuid,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','failed','expired')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists approval_requests_status_idx on public.approval_requests(status,created_at desc);

create table if not exists public.business_risks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  likelihood text not null default 'possible' check (likelihood in ('rare','unlikely','possible','likely','almost_certain')),
  status text not null default 'open' check (status in ('open','mitigated','accepted','closed')),
  owner_user_id uuid references auth.users(id) on delete set null,
  mitigation text,
  detected_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.decision_log (
  id uuid primary key default gen_random_uuid(),
  decision_type text not null,
  title text not null,
  decision text not null,
  rationale text,
  decided_by uuid references auth.users(id) on delete set null,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  objective text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','cancelled')),
  budget numeric not null default 0,
  spent numeric not null default 0,
  leads integer not null default 0,
  conversions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  channel text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  rules jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table if not exists public.staff_training_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  training_name text not null,
  category text,
  provider text,
  completed_at timestamptz,
  expires_at timestamptz,
  status text not null default 'completed' check (status in ('planned','completed','expired','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  maintenance_type text not null,
  interval_days integer,
  last_completed_at timestamptz,
  next_due_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','due','overdue','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_records (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contract_type text not null,
  counterparty text,
  starts_at timestamptz,
  ends_at timestamptz,
  value numeric,
  status text not null default 'active' check (status in ('draft','active','expired','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

insert into public.ai_agents(code,name,purpose,scope,can_read,can_propose,can_execute) values
('executive','Stagepulse Executive AI','Company-wide management analysis, forecasting, risks and strategic proposals','executive',true,true,false),
('operations','Stagepulse Operations AI','Event, staffing, equipment, vehicle and schedule planning','operations',true,true,false),
('sales','Stagepulse Sales AI','Lead, offer, conversion and commercial analysis','commercial',true,true,false),
('finance','Stagepulse Finance AI','Revenue, cost, margin and financial forecasting','finance',true,true,false),
('people','Stagepulse People AI','Staff skills, availability, training and workload analysis','people',true,true,false),
('asset','Stagepulse Asset AI','Equipment inventory, maintenance, utilization and lifecycle analysis','assets',true,true,false),
('marketing','Stagepulse Marketing AI','Campaign, channel, enquiry and attribution analysis','marketing',true,true,false),
('technical','Stagepulse Technical Production AI','Rider, stage, audio, lighting, video, rigging and power readiness','technical',true,true,false)
on conflict (code) do nothing;

insert into public.approval_policies(code,name,action_type,min_role,requires_owner,auto_approve) values
('ai_critical_action','AI critical action approval','critical','admin',true,false),
('ai_financial_action','AI financial action approval','financial','admin',true,false),
('ai_staff_assignment','AI staff assignment approval','staff_assignment','admin',true,false),
('ai_equipment_reservation','AI equipment reservation approval','equipment_reservation','admin',true,false)
on conflict (code) do nothing;

commit;
