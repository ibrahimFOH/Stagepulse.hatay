begin;

-- RLS policies call these public compatibility helpers for signed-in staff.
-- Keep anonymous callers blocked while restoring the authenticated ACL that
-- an older jobs migration intentionally revoked.
do $$
begin
  if to_regprocedure('public.staff_has_perm(text)') is null
    or to_regprocedure('public.staff_has_perm(text[])') is null
    or to_regprocedure('public.staff_has_exact_perm(text)') is null
  then
    raise exception 'Required canonical staff permission helpers are missing';
  end if;
end;
$$;

revoke all on function public.staff_has_perm(text) from public, anon;
revoke all on function public.staff_has_perm(text[]) from public, anon;
revoke all on function public.staff_has_exact_perm(text) from public, anon;

grant execute on function public.staff_has_perm(text) to authenticated;
grant execute on function public.staff_has_perm(text[]) to authenticated;
grant execute on function public.staff_has_exact_perm(text) to authenticated;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.staff_has_perm(text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.staff_has_perm(text[])',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.staff_has_exact_perm(text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated staff permission helper ACL validation failed';
  end if;

  if has_function_privilege(
    'anon',
    'public.staff_has_perm(text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_has_perm(text[])',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_has_exact_perm(text)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous staff permission helper ACL validation failed';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;