-- Public quote RPCs deliberately support bearer-token access for customers.
-- Remove the implicit PUBLIC grant while keeping only the explicitly required
-- anon/authenticated roles. Other SECURITY DEFINER RPCs remain authenticated-only.
begin;

revoke execute on function public.get_public_quote(text) from public;
revoke execute on function public.respond_to_quote(text, text) from public;

grant execute on function public.get_public_quote(text) to anon, authenticated;
grant execute on function public.respond_to_quote(text, text) to anon, authenticated;

commit;
