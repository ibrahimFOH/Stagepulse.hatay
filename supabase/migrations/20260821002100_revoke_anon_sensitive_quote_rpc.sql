-- Public quote access is served by the hardened public-quote Edge Function.
-- Remove the explicit anon/authenticated grants that existed on the legacy RPCs.

revoke all on function public.get_public_quote(text) from anon;
revoke all on function public.get_public_quote(text) from authenticated;
revoke all on function public.respond_to_quote(text, text) from anon;
revoke all on function public.respond_to_quote(text, text) from authenticated;
