begin;
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','image/avif'] where id='offer-assets';
create or replace function public.admin_register_offer_attachment(p_offer_id uuid,p_storage_path text,p_file_name text,p_mime_type text,p_size_bytes bigint,p_sort_order integer default 0,p_customer_visible boolean default true)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v uuid;
begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_mime_type not in ('image/jpeg','image/png','image/webp','image/gif','image/avif') then raise exception 'Desteklenmeyen fotoğraf türü.'; end if;
 if p_size_bytes<1 or p_size_bytes>15728640 then raise exception 'Fotoğraf boyutu 15 MB sınırını aşamaz.'; end if;
 insert into public.offer_attachments(offer_id,storage_path,file_name,mime_type,size_bytes,sort_order,customer_visible,created_by) values(p_offer_id,p_storage_path,p_file_name,p_mime_type,p_size_bytes,p_sort_order,p_customer_visible,auth.uid()) returning id into v;
 return v;
end;$$;
grant execute on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
