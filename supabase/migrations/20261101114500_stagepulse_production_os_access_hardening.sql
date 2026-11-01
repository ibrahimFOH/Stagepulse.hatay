begin;

-- Staff may inspect only their own timesheet rows. Creation, editing, deletion,
-- approval state and hourly cost are reserved for administrators.
drop policy if exists sp_timesheet_access on public.sp_staff_timesheets;
drop policy if exists sp_timesheet_select on public.sp_staff_timesheets;
drop policy if exists sp_timesheet_admin_insert on public.sp_staff_timesheets;
drop policy if exists sp_timesheet_admin_update on public.sp_staff_timesheets;
drop policy if exists sp_timesheet_admin_delete on public.sp_staff_timesheets;

create policy sp_timesheet_select
  on public.sp_staff_timesheets
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy sp_timesheet_admin_insert
  on public.sp_staff_timesheets
  for insert to authenticated
  with check (public.is_admin());

create policy sp_timesheet_admin_update
  on public.sp_staff_timesheets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy sp_timesheet_admin_delete
  on public.sp_staff_timesheets
  for delete to authenticated
  using (public.is_admin());

comment on policy sp_timesheet_select on public.sp_staff_timesheets is
  'Staff can read their own timesheets; admins can read all timesheets.';
comment on policy sp_timesheet_admin_update on public.sp_staff_timesheets is
  'Timesheet status, approval metadata and hourly cost are administrator-controlled.';

commit;
