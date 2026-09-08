begin;

-- Final runtime ACL reconciliation.
-- Earlier hardening migrations correctly removed anon access, but a later ACL
-- sweep left several canonical authenticated RPCs without EXECUTE. Restore only
-- the public wrappers that are intentionally consumed by the authenticated UI.

revoke execute on function public.owner_control_center() from anon;
grant execute on function public.owner_control_center() to authenticated;

revoke execute on function public.owner_executive_foundation() from anon;
grant execute on function public.owner_executive_foundation() to authenticated;

revoke execute on function public.stagepulse_command_action(text,text,uuid,jsonb) from anon;
grant execute on function public.stagepulse_command_action(text,text,uuid,jsonb) to authenticated;

revoke execute on function public.stagepulse_command_catalog() from anon;
grant execute on function public.stagepulse_command_catalog() to authenticated;

revoke execute on function public.stagepulse_command_form_schema(text) from anon;
grant execute on function public.stagepulse_command_form_schema(text) to authenticated;

revoke execute on function public.stagepulse_command_list(text,integer) from anon;
grant execute on function public.stagepulse_command_list(text,integer) to authenticated;

revoke execute on function public.stagepulse_command_report(text,jsonb) from anon;
grant execute on function public.stagepulse_command_report(text,jsonb) to authenticated;

commit;
