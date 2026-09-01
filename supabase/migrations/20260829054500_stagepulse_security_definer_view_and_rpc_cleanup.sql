begin;

-- Command-center views must respect the caller's RLS rather than the creator's privileges.
alter view public.stagepulse_event_command_view set (security_invoker = true);
alter view public.stagepulse_job_command_view set (security_invoker = true);
alter view public.stagepulse_finance_command_view set (security_invoker = true);
alter view public.stagepulse_ai_command_view set (security_invoker = true);
alter view public.stagepulse_resource_command_view set (security_invoker = true);
alter view public.stagepulse_command_summary_view set (security_invoker = true);

-- Keep validation deterministic regardless of the caller's session search_path.
alter function public.validate_event_resource() set search_path = public, pg_catalog;

-- This synchronization helper is an internal write path and must never be callable anonymously.
revoke execute on function public.sync_job_to_event_project() from anon;

commit;
