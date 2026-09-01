begin;
revoke execute on function public.sync_job_to_event_project() from public;
grant execute on function public.sync_job_to_event_project() to authenticated;
commit;
