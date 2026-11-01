begin;

-- Customer quote links use the publishable/anon client and token authorization.
-- Signed-in users do not need a separate EXECUTE grant for this public workflow.
revoke execute on function public.get_public_quote(text) from public, authenticated;
revoke execute on function public.respond_to_quote(text, text) from public, authenticated;

grant execute on function public.get_public_quote(text) to anon;
grant execute on function public.respond_to_quote(text, text) to anon;

commit;
