begin;

-- REVOKE from PUBLIC is required because PostgreSQL functions default to PUBLIC EXECUTE.
revoke all on function public.admin_delete_offer_attachment(uuid) from public;
revoke all on function public.admin_get_offer_attachments(uuid) from public;
revoke all on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) from public;
revoke all on function public.admin_set_offer_attachment_visibility(uuid,boolean) from public;

grant execute on function public.admin_delete_offer_attachment(uuid) to authenticated;
grant execute on function public.admin_get_offer_attachments(uuid) to authenticated;
grant execute on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) to authenticated;
grant execute on function public.admin_set_offer_attachment_visibility(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
