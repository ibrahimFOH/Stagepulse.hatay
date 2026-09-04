begin;

alter table public.sp_staff_timesheets add column if not exists client_event_id text;
alter table public.sp_equipment_scans add column if not exists client_event_id text;
alter table public.sp_field_proofs add column if not exists client_event_id text;

create unique index if not exists uq_sp_timesheet_client_event on public.sp_staff_timesheets(user_id,client_event_id) where client_event_id is not null;
create unique index if not exists uq_sp_scan_client_event on public.sp_equipment_scans(scanned_by,client_event_id) where client_event_id is not null;
create unique index if not exists uq_sp_proof_client_event on public.sp_field_proofs(user_id,client_event_id) where client_event_id is not null;

commit;
