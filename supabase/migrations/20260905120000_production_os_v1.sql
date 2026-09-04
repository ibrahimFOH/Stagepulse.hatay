begin;

-- Additive production-operations layer. Existing tables/functions are untouched.
create table if not exists public.sp_crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  customer_id uuid,
  source text,
  name text not null,
  company text,
  email text,
  phone text,
  stage text not null default 'new' check (stage in ('new','qualified','meeting','quoted','won','lost')),
  estimated_value numeric(14,2) not null default 0,
  next_follow_up_at timestamptz,
  notes text,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sp_quote_followups (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid,
  organization_id uuid,
  channel text not null default 'manual' check (channel in ('manual','email','sms','whatsapp','phone')),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  completed_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','sent','completed','cancelled')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sp_quote_revisions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null,
  revision_no integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (offer_id, revision_no)
);

create table if not exists public.sp_quote_packages (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid,
  organization_id uuid,
  name text not null,
  tier text not null check (tier in ('basic','pro','premium','custom')),
  price numeric(14,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  recommended boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sp_staff_timesheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid,
  check_in_at timestamptz,
  check_out_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  hourly_cost numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sp_staff_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available' check (status in ('available','leave','busy','unavailable')),
  note text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.sp_equipment_scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  equipment_id uuid,
  job_id uuid,
  code text not null,
  action text not null check (action in ('check_out','load','deliver','return','inspect','check_in')),
  scanned_by uuid references auth.users(id) on delete set null,
  scanned_at timestamptz not null default now(),
  latitude numeric(9,6),
  longitude numeric(9,6),
  note text
);

create table if not exists public.sp_warehouse_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid,
  status text not null default 'picking' check (status in ('picking','qc','packed','loaded','on_site','returning','returned','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sp_field_proofs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  proof_type text not null check (proof_type in ('photo','signature','gps','delivery','damage','checklist')),
  file_path text,
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table if not exists public.sp_equipment_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  equipment_id uuid,
  job_id uuid,
  reported_by uuid references auth.users(id) on delete set null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','investigating','repair','resolved','closed')),
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  estimated_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.sp_maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  equipment_id uuid,
  type text not null default 'preventive' check (type in ('preventive','corrective','inspection','calibration')),
  status text not null default 'due' check (status in ('due','locked','in_progress','tested','available','cancelled')),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  technician_user_id uuid references auth.users(id) on delete set null,
  notes text,
  test_result text,
  created_at timestamptz not null default now()
);

create table if not exists public.sp_vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid,
  vehicle_id uuid,
  driver_user_id uuid references auth.users(id) on delete set null,
  load_plan jsonb not null default '[]'::jsonb,
  route_text text,
  eta_at timestamptz,
  status text not null default 'planned' check (status in ('planned','loaded','en_route','on_site','returning','complete')),
  created_at timestamptz not null default now()
);

create table if not exists public.sp_event_readiness (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid unique,
  readiness_percent numeric(5,2) not null default 0 check (readiness_percent between 0 and 100),
  crew_percent numeric(5,2) not null default 0 check (crew_percent between 0 and 100),
  equipment_percent numeric(5,2) not null default 0 check (equipment_percent between 0 and 100),
  logistics_percent numeric(5,2) not null default 0 check (logistics_percent between 0 and 100),
  safety_percent numeric(5,2) not null default 0 check (safety_percent between 0 and 100),
  finance_percent numeric(5,2) not null default 0 check (finance_percent between 0 and 100),
  blockers jsonb not null default '[]'::jsonb,
  last_calculated_at timestamptz not null default now()
);

create table if not exists public.sp_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid,
  supplier_id uuid,
  status text not null default 'draft' check (status in ('draft','requested','approved','ordered','received','cancelled')),
  total numeric(14,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sp_supplier_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid,
  equipment_need jsonb not null default '{}'::jsonb,
  supplier_id uuid,
  status text not null default 'draft' check (status in ('draft','requested','quoted','approved','fulfilled','cancelled')),
  expected_cost numeric(14,2) not null default 0,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sp_marketing_attribution (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  lead_id uuid references public.sp_crm_leads(id) on delete cascade,
  source text not null,
  campaign text,
  medium text,
  first_touch_at timestamptz not null default now(),
  won_at timestamptz,
  revenue numeric(14,2) not null default 0
);

create table if not exists public.sp_customer_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  customer_id uuid,
  quote_count integer not null default 0,
  won_count integer not null default 0,
  revenue numeric(14,2) not null default 0,
  last_activity_at timestamptz,
  ltv numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id)
);

create table if not exists public.sp_ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid,
  type text not null check (type in ('quote','crew','inventory','risk','finance','followup','maintenance','logistics')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  title text not null,
  rationale text,
  proposed_action jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','expired')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  executed_at timestamptz
);

create table if not exists public.sp_workflow_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  job_id uuid,
  offer_id uuid,
  event_type text not null,
  from_status text,
  to_status text,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sp_crm_stage_followup on public.sp_crm_leads(stage,next_follow_up_at);
create index if not exists idx_sp_followups_due on public.sp_quote_followups(status,scheduled_at);
create index if not exists idx_sp_timesheets_user_date on public.sp_staff_timesheets(user_id,check_in_at);
create index if not exists idx_sp_availability_user_time on public.sp_staff_availability(user_id,starts_at,ends_at);
create index if not exists idx_sp_scans_code_time on public.sp_equipment_scans(code,scanned_at desc);
create index if not exists idx_sp_warehouse_job on public.sp_warehouse_jobs(job_id,status);
create index if not exists idx_sp_proofs_job_time on public.sp_field_proofs(job_id,captured_at desc);
create index if not exists idx_sp_incidents_status on public.sp_equipment_incidents(status,severity);
create index if not exists idx_sp_maintenance_due on public.sp_maintenance_work_orders(status,due_at);
create index if not exists idx_sp_vehicle_job on public.sp_vehicle_assignments(job_id,status);
create index if not exists idx_sp_readiness_job on public.sp_event_readiness(job_id);
create index if not exists idx_sp_po_status on public.sp_purchase_orders(status,created_at desc);
create index if not exists idx_sp_supplier_status on public.sp_supplier_requests(status,due_at);
create index if not exists idx_sp_ai_status on public.sp_ai_recommendations(status,priority,created_at desc);
create index if not exists idx_sp_workflow_job_time on public.sp_workflow_events(job_id,created_at desc);

-- Safe browser access: administrators have company-wide access; staff see only records assigned to them.
do $$ declare t text; begin
  foreach t in array array['sp_crm_leads','sp_quote_followups','sp_quote_revisions','sp_quote_packages','sp_staff_timesheets','sp_staff_availability','sp_equipment_scans','sp_warehouse_jobs','sp_field_proofs','sp_equipment_incidents','sp_maintenance_work_orders','sp_vehicle_assignments','sp_event_readiness','sp_purchase_orders','sp_supplier_requests','sp_marketing_attribution','sp_customer_metrics','sp_ai_recommendations','sp_workflow_events'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

drop policy if exists sp_admin_all_crm on public.sp_crm_leads;
create policy sp_admin_all_crm on public.sp_crm_leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_admin_all_followups on public.sp_quote_followups;
create policy sp_admin_all_followups on public.sp_quote_followups for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_admin_all_revisions on public.sp_quote_revisions;
create policy sp_admin_all_revisions on public.sp_quote_revisions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_admin_all_packages on public.sp_quote_packages;
create policy sp_admin_all_packages on public.sp_quote_packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_timesheet_access on public.sp_staff_timesheets;
create policy sp_timesheet_access on public.sp_staff_timesheets for all to authenticated using (public.is_admin() or user_id=auth.uid()) with check (public.is_admin() or user_id=auth.uid());
drop policy if exists sp_availability_access on public.sp_staff_availability;
create policy sp_availability_access on public.sp_staff_availability for all to authenticated using (public.is_admin() or user_id=auth.uid()) with check (public.is_admin() or user_id=auth.uid());
drop policy if exists sp_scan_access on public.sp_equipment_scans;
create policy sp_scan_access on public.sp_equipment_scans for all to authenticated using (public.is_admin() or scanned_by=auth.uid()) with check (public.is_admin() or scanned_by=auth.uid());
drop policy if exists sp_warehouse_access on public.sp_warehouse_jobs;
create policy sp_warehouse_access on public.sp_warehouse_jobs for all to authenticated using (public.is_admin() or assigned_to=auth.uid()) with check (public.is_admin() or assigned_to=auth.uid());
drop policy if exists sp_proof_access on public.sp_field_proofs;
create policy sp_proof_access on public.sp_field_proofs for all to authenticated using (public.is_admin() or user_id=auth.uid()) with check (public.is_admin() or user_id=auth.uid());
drop policy if exists sp_incident_access on public.sp_equipment_incidents;
create policy sp_incident_access on public.sp_equipment_incidents for all to authenticated using (public.is_admin() or reported_by=auth.uid()) with check (public.is_admin() or reported_by=auth.uid());
drop policy if exists sp_maintenance_access on public.sp_maintenance_work_orders;
create policy sp_maintenance_access on public.sp_maintenance_work_orders for all to authenticated using (public.is_admin() or technician_user_id=auth.uid()) with check (public.is_admin() or technician_user_id=auth.uid());
drop policy if exists sp_vehicle_access on public.sp_vehicle_assignments;
create policy sp_vehicle_access on public.sp_vehicle_assignments for all to authenticated using (public.is_admin() or driver_user_id=auth.uid()) with check (public.is_admin() or driver_user_id=auth.uid());
drop policy if exists sp_readiness_admin on public.sp_event_readiness;
create policy sp_readiness_admin on public.sp_event_readiness for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_po_admin on public.sp_purchase_orders;
create policy sp_po_admin on public.sp_purchase_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_supplier_admin on public.sp_supplier_requests;
create policy sp_supplier_admin on public.sp_supplier_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_marketing_admin on public.sp_marketing_attribution;
create policy sp_marketing_admin on public.sp_marketing_attribution for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_customer_metrics_admin on public.sp_customer_metrics;
create policy sp_customer_metrics_admin on public.sp_customer_metrics for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_ai_admin on public.sp_ai_recommendations;
create policy sp_ai_admin on public.sp_ai_recommendations for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sp_workflow_admin on public.sp_workflow_events;
create policy sp_workflow_admin on public.sp_workflow_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Unified operational view for the command center.
create or replace view public.sp_production_readiness as
select
  er.job_id,
  er.readiness_percent,
  er.crew_percent,
  er.equipment_percent,
  er.logistics_percent,
  er.safety_percent,
  er.finance_percent,
  er.blockers,
  er.last_calculated_at
from public.sp_event_readiness er;

revoke all on public.sp_production_readiness from anon;
grant select on public.sp_production_readiness to authenticated;

commit;
