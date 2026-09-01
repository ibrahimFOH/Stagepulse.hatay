-- Stagepulse Command Center Foundation
-- IMPORTANT: additive only. Existing offer/job/staff/notification flows are not replaced.
-- This migration creates the new operational data layer so future UI/AI features can be added safely.

create table if not exists public.event_projects (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.teklifler(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  event_type text,
  status text not null default 'planning' check (status in ('planning','confirmed','active','completed','cancelled','archived')),
  venue text,
  city text,
  event_start_at timestamptz,
  event_end_at timestamptz,
  setup_start_at timestamptz,
  teardown_end_at timestamptz,
  capacity integer,
  risk_score numeric(5,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_projects_offer_idx on public.event_projects(offer_id);
create index if not exists event_projects_job_idx on public.event_projects(job_id);
create index if not exists event_projects_schedule_idx on public.event_projects(event_start_at,event_end_at);

create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_projects(id) on delete cascade,
  parent_task_id uuid references public.event_tasks(id) on delete cascade,
  title text not null,
  task_type text not null default 'general',
  status text not null default 'todo' check (status in ('todo','assigned','in_progress','blocked','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists event_tasks_event_idx on public.event_tasks(event_id);
create index if not exists event_tasks_assignee_idx on public.event_tasks(assigned_user_id,status);

create table if not exists public.staff_skill_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null unique,
  level_max integer not null default 5 check (level_max between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_skills (
  user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  skill_id uuid not null references public.staff_skill_catalog(id) on delete cascade,
  level integer not null default 1 check (level between 1 and 5),
  verified boolean not null default false,
  verified_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available' check (status in ('available','unavailable','tentative','leave','sick','assigned')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists staff_availability_user_time_idx on public.staff_availability(user_id,starts_at,ends_at);

create table if not exists public.equipment_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.equipment_subclasses (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.equipment_classes(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  unique(class_id,name)
);

alter table public.equipment
  add column if not exists class_id uuid references public.equipment_classes(id) on delete set null;

alter table public.equipment
  add column if not exists subclass_id uuid references public.equipment_subclasses(id) on delete set null;

alter table public.equipment
  add column if not exists serial_number text;

alter table public.equipment
  add column if not exists asset_code text;

alter table public.equipment
  add column if not exists status text not null default 'available';

create unique index if not exists equipment_asset_code_uidx on public.equipment(asset_code) where asset_code is not null;
create index if not exists equipment_class_idx on public.equipment(class_id,subclass_id);

create table if not exists public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  parent_id uuid references public.warehouse_locations(id) on delete set null,
  location_type text not null default 'warehouse' check (location_type in ('warehouse','vehicle','venue','room','shelf','field')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_movements (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  event_id uuid references public.event_projects(id) on delete set null,
  from_location_id uuid references public.warehouse_locations(id) on delete set null,
  to_location_id uuid references public.warehouse_locations(id) on delete set null,
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  movement_type text not null check (movement_type in ('checkout','checkin','transfer','reserve','release','maintenance','repair','loss')),
  moved_at timestamptz not null default now(),
  notes text
);
create index if not exists equipment_movements_equipment_idx on public.equipment_movements(equipment_id,moved_at desc);
create index if not exists equipment_movements_event_idx on public.equipment_movements(event_id,moved_at desc);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text unique,
  vehicle_type text,
  capacity_kg numeric,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  event_id uuid references public.event_projects(id) on delete cascade,
  driver_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'planned' check (status in ('planned','confirmed','active','completed','cancelled')),
  notes text,
  check (ends_at > starts_at)
);
create index if not exists vehicle_assignments_schedule_idx on public.vehicle_assignments(vehicle_id,starts_at,ends_at);

create table if not exists public.event_resources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_projects(id) on delete cascade,
  resource_type text not null check (resource_type in ('staff','equipment','vehicle','external')),
  staff_user_id uuid references auth.users(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  quantity numeric not null default 1,
  required boolean not null default true,
  status text not null default 'planned' check (status in ('planned','reserved','confirmed','issued','returned','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  check (quantity > 0)
);
create index if not exists event_resources_event_idx on public.event_resources(event_id);
create index if not exists event_resources_equipment_idx on public.event_resources(equipment_id);
create index if not exists event_resources_staff_idx on public.event_resources(staff_user_id);

create table if not exists public.event_risks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_projects(id) on delete cascade,
  category text not null,
  title text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  likelihood text not null default 'possible' check (likelihood in ('rare','unlikely','possible','likely','almost_certain')),
  status text not null default 'open' check (status in ('open','mitigated','accepted','closed')),
  mitigation text,
  detected_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists event_risks_event_idx on public.event_risks(event_id,status,severity);

create table if not exists public.event_checklists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_projects(id) on delete cascade,
  name text not null,
  phase text not null check (phase in ('advance','load_in','soundcheck','show','load_out','closeout')),
  status text not null default 'open' check (status in ('open','complete','blocked')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.event_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.event_checklists(id) on delete cascade,
  title text not null,
  required boolean not null default true,
  status text not null default 'open' check (status in ('open','done','blocked','skipped')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  notes text
);
create index if not exists event_checklist_items_checklist_idx on public.event_checklist_items(checklist_id,status);

create table if not exists public.event_financials (
  event_id uuid primary key references public.event_projects(id) on delete cascade,
  estimated_revenue numeric not null default 0,
  estimated_cost numeric not null default 0,
  estimated_margin numeric generated always as (estimated_revenue-estimated_cost) stored,
  actual_revenue numeric not null default 0,
  actual_cost numeric not null default 0,
  actual_margin numeric generated always as (actual_revenue-actual_cost) stored,
  currency text not null default 'TRY',
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  purpose text not null,
  scope text not null default 'system',
  active boolean not null default true,
  can_read boolean not null default true,
  can_propose boolean not null default true,
  can_execute boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.ai_agents(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_id uuid references public.event_projects(id) on delete set null,
  action_type text not null default 'analysis',
  status text not null default 'started' check (status in ('started','completed','failed','cancelled')),
  input_summary text,
  output_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists ai_runs_event_idx on public.ai_runs(event_id,created_at desc);

create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  memory_type text not null check (memory_type in ('customer','event','equipment','staff','company','procedure')),
  entity_id uuid,
  title text not null,
  content text not null,
  source text,
  confidence numeric(5,4) not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_memory_type_entity_idx on public.ai_memory(memory_type,entity_id);

create table if not exists public.ai_action_requests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.ai_runs(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  action_type text not null,
  target_type text,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','failed','expired')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_action_requests_status_idx on public.ai_action_requests(status,created_at desc);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  trigger_type text not null,
  condition jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.automation_rules(id) on delete set null,
  event_id uuid references public.event_projects(id) on delete set null,
  status text not null default 'started' check (status in ('started','completed','failed','skipped')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Canonical operational staff skill seeds.
insert into public.staff_skill_catalog(category,name) values
('Ses','FOH Miks'),
('Ses','Monitor Miks'),
('Ses','Sistem Kurulumu'),
('Ses','Midas M32'),
('Ses','Behringer X32'),
('Ses','Yamaha CL5'),
('Ses','Kablosuz Mikrofon'),
('Ses','IEM'),
('Ses','Line Array Kurulumu'),
('Işık','Işık Operasyonu'),
('Işık','DMX'),
('Işık','Avolites'),
('Işık','Moving Head'),
('Işık','Wash / Beam'),
('Görüntü','LED Ekran'),
('Görüntü','Video Playback'),
('Görüntü','Resolume'),
('Görüntü','vMix'),
('Sahne','Sahne Kurulumu'),
('Sahne','Truss'),
('Sahne','Rigging Koordinasyonu'),
('Teknik','Stage Plot'),
('Teknik','Technical Rider'),
('Teknik','SPL Hesaplama'),
('Teknik','Kablo / Patch'),
('Operasyon','Saha Liderliği'),
('Operasyon','Araç Kullanımı'),
('Operasyon','Depo / Lojistik')
on conflict (name) do nothing;

-- Professional AV equipment classification seeds.
insert into public.equipment_classes(name,description,sort_order) values
('Audio','Ses sistemleri ve ses sinyal zinciri',10),
('Lighting','Sahne ve etkinlik ışık sistemleri',20),
('Video','LED, görüntü ve video sistemleri',30),
('Stage','Sahne, truss ve sahne aksesuarları',40),
('Rigging','Askı ve yük taşıma ekipmanları',50),
('Power','Elektrik, dağıtım ve güç altyapısı',60),
('Control','Kontrol, ağ ve show kontrol ekipmanları',70),
('Cables','Ses, ışık, görüntü, güç ve ağ kabloları',80),
('Cases','Flight case, rack ve taşıma çözümleri',90),
('Tools','Kurulum ve servis el aletleri',100),
('Vehicles','Araç ve taşıma ekipmanları',110),
('Safety','İSG ve saha güvenlik ekipmanları',120)
on conflict (name) do nothing;

insert into public.ai_agents(code,name,purpose,scope,can_execute) values
('stagepulse-command','Stagepulse AI','Şirket genelini analiz eder, riskleri ve fırsatları özetler.','owner',false),
('operations-planner','Operasyon AI','Etkinlik, personel, ekipman ve zaman planlamasına yardımcı olur.','operations',false),
('sales-assistant','Satış AI','Teklif ve müşteri süreçlerini analiz eder ve öneriler üretir.','commercial',false),
('staff-assistant','Personel AI','Personelin görevlerini, programını ve işiyle ilgili bilgileri özetler.','staff',false),
('inventory-assistant','Ekipman AI','Ekipman, stok, bakım ve çakışmaları analiz eder.','inventory',false),
('site-assistant','Site AI','Müşterilere Stagepulse hizmetleri hakkında kontrollü bilgi verir.','public',false)
on conflict (code) do nothing;

insert into public.automation_rules(code,name,trigger_type,condition,action) values
('event-advance-7d','Etkinlik 7 gün kontrolü','time_before_event','{"days":7}','{"action":"run_event_readiness_check"}'),
('event-advance-24h','Etkinlik 24 saat kontrolü','time_before_event','{"hours":24}','{"action":"run_final_readiness_check"}'),
('resource-conflict','Kaynak çakışması','resource_conflict','{}','{"action":"create_risk"}'),
('staff-assignment-change','Personel atama değişikliği','assignment_change','{"resource":"staff"}','{"action":"notify_staff"}'),
('equipment-return','Ekipman dönüşü','job_closed','{"resource":"equipment"}','{"action":"create_return_checklist"}')
on conflict (code) do nothing;

-- RLS: new tables are private by default. Admin access is explicit; staff gets only scoped self/event access where appropriate.
alter table public.event_projects enable row level security;
alter table public.event_tasks enable row level security;
alter table public.staff_skill_catalog enable row level security;
alter table public.staff_skills enable row level security;
alter table public.staff_availability enable row level security;
alter table public.equipment_classes enable row level security;
alter table public.equipment_subclasses enable row level security;
alter table public.warehouse_locations enable row level security;
alter table public.equipment_movements enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_assignments enable row level security;
alter table public.event_resources enable row level security;
alter table public.event_risks enable row level security;
alter table public.event_checklists enable row level security;
alter table public.event_checklist_items enable row level security;
alter table public.event_financials enable row level security;
alter table public.ai_agents enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_memory enable row level security;
alter table public.ai_action_requests enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;

-- Admin policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'event_projects','event_tasks','staff_skill_catalog','staff_skills','staff_availability',
    'equipment_classes','equipment_subclasses','warehouse_locations','equipment_movements',
    'vehicles','vehicle_assignments','event_resources','event_risks','event_checklists',
    'event_checklist_items','event_financials','ai_agents','ai_runs','ai_memory',
    'ai_action_requests','automation_rules','automation_runs']
  loop
    execute format('drop policy if exists %I_admin on public.%I', t, t);
    execute format('create policy %I_admin on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- Limited staff policies.
drop policy if exists staff_skill_catalog_authenticated on public.staff_skill_catalog;
create policy staff_skill_catalog_authenticated on public.staff_skill_catalog
  for select to authenticated using (public.is_active_staff() or public.is_admin());

drop policy if exists staff_skills_self on public.staff_skills;
create policy staff_skills_self on public.staff_skills
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists staff_availability_self on public.staff_availability;
create policy staff_availability_self on public.staff_availability
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists event_projects_staff on public.event_projects;
create policy event_projects_staff on public.event_projects
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.event_resources er
      where er.event_id = event_projects.id
        and er.resource_type = 'staff'
        and er.staff_user_id = auth.uid()
    )
    or exists (
      select 1 from public.event_tasks et
      where et.event_id = event_projects.id
        and et.assigned_user_id = auth.uid()
    )
  );

drop policy if exists event_tasks_staff on public.event_tasks;
create policy event_tasks_staff on public.event_tasks
  for select to authenticated
  using (assigned_user_id = auth.uid() or public.is_admin());

drop policy if exists event_resources_staff on public.event_resources;
create policy event_resources_staff on public.event_resources
  for select to authenticated
  using (staff_user_id = auth.uid() or public.is_admin());

drop policy if exists event_checklists_staff on public.event_checklists;
create policy event_checklists_staff on public.event_checklists
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.event_resources er
      where er.event_id = event_checklists.event_id
        and er.resource_type = 'staff'
        and er.staff_user_id = auth.uid()
    )
  );

drop policy if exists event_checklist_items_staff on public.event_checklist_items;
create policy event_checklist_items_staff on public.event_checklist_items
  for select to authenticated
  using (assigned_user_id = auth.uid() or public.is_admin());

comment on table public.event_projects is 'Stagepulse central Event DNA record. Additive layer; current offers/jobs remain source systems until explicitly migrated.';
comment on table public.ai_action_requests is 'AI may propose actions; execution remains disabled by default and requires explicit approval.';
