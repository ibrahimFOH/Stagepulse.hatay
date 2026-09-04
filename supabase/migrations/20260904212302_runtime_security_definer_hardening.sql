begin;

-- Harden the existing RPC surface in place; do not change routes, tables, or client contracts.
-- Keep pg_temp last so untrusted temporary objects cannot shadow trusted names.

alter function public.is_admin() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.org_visible_staff() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.owner_control_center() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.owner_executive_foundation() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.panel_access(text) set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.staff_assigned_jobs() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.staff_capabilities(uuid) set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.staff_capability(text) set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.staff_list_jobs() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.stagepulse_command_action(text,text,uuid,jsonb) set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.stagepulse_command_catalog() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.stagepulse_command_form_schema(text) set search_path = pg_catalog, public, information_schema, private, auth, pg_temp;
alter function public.stagepulse_command_list(text,integer) set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.stagepulse_command_report(text,jsonb) set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.admin_org_bootstrap_check() set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.admin_update_business_settings(jsonb) set search_path = pg_catalog, public, private, auth, pg_temp;
alter function public.current_admin_profile() set search_path = pg_catalog, public, private, auth, pg_temp;

create or replace function public.current_admin_profile()
returns table(username text, display_name text, active boolean)
language sql stable security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
  select p.username, p.display_name, p.active
  from public.admin_profiles p
  where auth.uid() is not null
    and p.user_id = auth.uid()
    and p.active = true
  limit 1;
$$;

create or replace function public.panel_access(p_kind text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
  select case
    when auth.uid() is null then false
    when p_kind = 'admin' then private.is_admin()
    when p_kind = 'staff' then public.is_staff()
    else false
  end;
$$;

-- Preserve the authenticated client surface; anonymous callers remain explicitly denied.
revoke execute on function public.current_admin_profile() from anon;
revoke execute on function public.panel_access(text) from anon;
revoke execute on function public.admin_org_bootstrap_check() from anon;
revoke execute on function public.admin_update_business_settings(jsonb) from anon;
revoke execute on function public.staff_assigned_jobs() from anon;
revoke execute on function public.staff_capabilities(uuid) from anon;
revoke execute on function public.staff_capability(text) from anon;
revoke execute on function public.staff_list_jobs() from anon;
revoke execute on function public.stagepulse_command_action(text,text,uuid,jsonb) from anon;
revoke execute on function public.stagepulse_command_catalog() from anon;
revoke execute on function public.stagepulse_command_form_schema(text) from anon;
revoke execute on function public.stagepulse_command_list(text,integer) from anon;
revoke execute on function public.stagepulse_command_report(text,jsonb) from anon;
revoke execute on function public.owner_control_center() from anon;
revoke execute on function public.owner_executive_foundation() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.org_visible_staff() from anon;

commit;
