-- Keep sensitive read RPCs authenticated and trigger-only functions non-callable via PostgREST.
revoke execute on function public.get_owner_financial_summary() from public, anon;
grant execute on function public.get_owner_financial_summary() to authenticated;

revoke execute on function public.register_webpush_subscription(text,text,text,text) from public, anon;
grant execute on function public.register_webpush_subscription(text,text,text,text) to authenticated;

revoke execute on function public.app_versions_set_updated_at() from public, anon, authenticated;
revoke execute on function public.coalesce_quote_numeric_fields() from public, anon, authenticated;
revoke execute on function public.normalize_settlement_finance() from public, anon, authenticated;
revoke execute on function public.validate_event_resource() from public, anon, authenticated;
