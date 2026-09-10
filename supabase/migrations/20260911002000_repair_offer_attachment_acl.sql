begin;

-- The attachment editor must remain available to the authenticated Patron/admin
-- while still requiring the existing admin/capability gate. Some production
-- environments retained the function ACL but lost the capability resolution
-- path after the owner-only hardening pass.
create or replace function public.admin_get_offer_attachments(p_offer_id uuid)
returns table(id uuid, storage_path text, file_name text, mime_type text, size_bytes bigint, sort_order integer, customer_visible boolean, created_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select a.id,a.storage_path,a.file_name,a.mime_type,a.size_bytes,a.sort_order,a.customer_visible,a.created_at
  from public.offer_attachments a
  where a.offer_id=p_offer_id
    and (private.is_admin() or private.admin_has_capability('offers.attachments'))
  order by a.sort_order,a.created_at;
$$;

create or replace function public.admin_register_offer_attachment(p_offer_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_size_bytes bigint, p_sort_order integer default 0, p_customer_visible boolean default true)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v uuid;
begin
  if not (private.is_admin() or private.admin_has_capability('offers.attachments')) then
    raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
  end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp','image/gif','image/avif') then
    raise exception 'Desteklenmeyen fotoğraf türü.';
  end if;
  if p_size_bytes<1 or p_size_bytes>15728640 then
    raise exception 'Fotoğraf boyutu 15 MB sınırını aşamaz.';
  end if;
  insert into public.offer_attachments(offer_id,storage_path,file_name,mime_type,size_bytes,sort_order,customer_visible,created_by)
  values(p_offer_id,p_storage_path,p_file_name,p_mime_type,p_size_bytes,p_sort_order,p_customer_visible,auth.uid())
  returning id into v;
  return v;
end;
$$;

create or replace function public.admin_delete_offer_attachment(p_attachment_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select private.admin_delete_offer_attachment(p_attachment_id);
$$;

create or replace function public.admin_set_offer_attachment_visibility(p_attachment_id uuid, p_visible boolean)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select private.admin_set_offer_attachment_visibility(p_attachment_id,p_visible);
$$;

revoke all on function public.admin_get_offer_attachments(uuid) from public;
revoke all on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) from public;
revoke all on function public.admin_delete_offer_attachment(uuid) from public;
revoke all on function public.admin_set_offer_attachment_visibility(uuid,boolean) from public;
grant execute on function public.admin_get_offer_attachments(uuid) to authenticated;
grant execute on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) to authenticated;
grant execute on function public.admin_delete_offer_attachment(uuid) to authenticated;
grant execute on function public.admin_set_offer_attachment_visibility(uuid,boolean) to authenticated;

-- Keep the private storage bucket protected, but use the same attachment
-- capability gate as the RPCs so upload/delete does not fail after listing works.
drop policy if exists offer_assets_admin_select on storage.objects;
drop policy if exists offer_assets_admin_insert on storage.objects;
drop policy if exists offer_assets_admin_update on storage.objects;
drop policy if exists offer_assets_admin_delete on storage.objects;
create policy offer_assets_admin_select on storage.objects
  for select to authenticated
  using (bucket_id='offer-assets' and (private.is_admin() or private.admin_has_capability('offers.attachments')));
create policy offer_assets_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id='offer-assets' and (private.is_admin() or private.admin_has_capability('offers.attachments')));
create policy offer_assets_admin_update on storage.objects
  for update to authenticated
  using (bucket_id='offer-assets' and (private.is_admin() or private.admin_has_capability('offers.attachments')))
  with check (bucket_id='offer-assets' and (private.is_admin() or private.admin_has_capability('offers.attachments')));
create policy offer_assets_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id='offer-assets' and (private.is_admin() or private.admin_has_capability('offers.attachments')));

notify pgrst, 'reload schema';
commit;
