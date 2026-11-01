-- Trial records are server-managed. Keep direct PostgREST access closed.
begin;
alter table public.sesm_trials enable row level security;
drop policy if exists sesm_trials_deny_client_access on public.sesm_trials;
create policy sesm_trials_deny_client_access
  on public.sesm_trials
  for all to anon, authenticated
  using (false) with check (false);
revoke all on table public.sesm_trials from public, anon, authenticated;
grant all on table public.sesm_trials to service_role;
commit;
