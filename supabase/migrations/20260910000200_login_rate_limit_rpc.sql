begin;

create table if not exists private.login_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.check_login_rate_limit(
  p_key text,
  p_max integer default 10
)
returns boolean
language plpgsql
security definer
set search_path=private,pg_temp
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'Rate limit key is required';
  end if;
  if p_max < 1 or p_max > 1000 then
    raise exception 'Invalid rate limit';
  end if;

  insert into private.login_rate_limits(rate_key, window_started_at, attempt_count, updated_at)
  values (left(trim(p_key), 200), now(), 1, now())
  on conflict (rate_key) do update
  set window_started_at = case
        when private.login_rate_limits.window_started_at <= now() - interval '1 minute'
          then now()
        else private.login_rate_limits.window_started_at
      end,
      attempt_count = case
        when private.login_rate_limits.window_started_at <= now() - interval '1 minute'
          then 1
        else private.login_rate_limits.attempt_count + 1
      end,
      updated_at = now()
  returning window_started_at, attempt_count into v_window, v_count;

  return v_count <= p_max;
end;
$$;

revoke all on table private.login_rate_limits from public, anon, authenticated;
revoke all on function public.check_login_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.check_login_rate_limit(text, integer) to service_role;

commit;