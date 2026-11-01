begin;

-- All referenced tables and application functions are schema-qualified.
-- Pin SECURITY DEFINER execution to pg_catalog only to prevent search_path shadowing.
alter function public.can_manage_org_member(uuid) set search_path = '';
alter function public.check_login_rate_limit(text, integer) set search_path = '';
alter function public.enforce_public_quote_rate_limit() set search_path = '';
alter function public.is_org_owner() set search_path = '';
alter function public.set_offer_public_code() set search_path = '';
alter function public.set_quote_defaults() set search_path = '';
alter function public.stagepulse_activate_license_device(uuid, text) set search_path = '';

commit;
