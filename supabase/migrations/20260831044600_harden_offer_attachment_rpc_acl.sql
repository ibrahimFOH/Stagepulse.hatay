begin;

-- Attachment RPCs are admin-only and must never be callable by anonymous users.
revoke all on function public.admin_delete_offer_attachment(uuid) from anon;
revoke all on function public.admin_get_offer_attachments(uuid) from anon;
revoke all on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) from anon;
revoke all on function public.admin_set_offer_attachment_visibility(uuid,boolean) from anon;

grant execute on function public.admin_delete_offer_attachment(uuid) to authenticated;
grant execute on function public.admin_get_offer_attachments(uuid) to authenticated;
grant execute on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) to authenticated;
grant execute on function public.admin_set_offer_attachment_visibility(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
