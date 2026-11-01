-- Public quote RPCs deliberately support bearer-token access for customers.
-- Remove implicit PUBLIC and authenticated grants. The customer quote page uses
-- the publishable/anon client; token possession is the only public authorization.
-- No signed-in session is required for this customer-facing flow.
begin;

revoke execute on function public.get_public_quote(text) from public;
revoke execute on function public.respond_to_quote(text, text) from public;

revoke execute on function public.get_public_quote(text) from authenticated;
revoke execute on function public.respond_to_quote(text, text) from authenticated;

grant execute on function public.get_public_quote(text) to anon;
grant execute on function public.respond_to_quote(text, text) to anon;

commit;
