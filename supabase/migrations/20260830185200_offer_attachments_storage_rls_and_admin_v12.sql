begin;
create table if not exists public.offer_attachments (
 id uuid primary key default gen_random_uuid(), offer_id uuid not null references public.teklifler(id) on delete cascade,
 storage_path text not null unique, file_name text not null, mime_type text not null, size_bytes bigint not null default 0,
 sort_order integer not null default 0, customer_visible boolean not null default true, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists offer_attachments_offer_idx on public.offer_attachments(offer_id,sort_order,created_at);
alter table public.offer_attachments enable row level security;
drop policy if exists offer_attachments_admin_all on public.offer_attachments;
create policy offer_attachments_admin_all on public.offer_attachments for all to authenticated using (private.is_admin()) with check (private.is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('offer-assets','offer-assets',false,15728640,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists offer_assets_admin_object_all on storage.objects;
create policy offer_assets_admin_object_all on storage.objects for all to authenticated using (bucket_id='offer-assets' and private.is_admin()) with check (bucket_id='offer-assets' and private.is_admin());

create or replace function public.admin_register_offer_attachment(p_offer_id uuid,p_storage_path text,p_file_name text,p_mime_type text,p_size_bytes bigint,p_sort_order integer default 0,p_customer_visible boolean default true)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v uuid;
begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception 'Desteklenmeyen fotoğraf türü.'; end if;
 insert into public.offer_attachments(offer_id,storage_path,file_name,mime_type,size_bytes,sort_order,customer_visible,created_by) values(p_offer_id,p_storage_path,p_file_name,p_mime_type,p_size_bytes,p_sort_order,p_customer_visible,auth.uid()) returning id into v;
 return v;
end;$$;
create or replace function public.admin_set_offer_attachment_visibility(p_attachment_id uuid,p_visible boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
begin if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if; update public.offer_attachments set customer_visible=p_visible,updated_at=now() where id=p_attachment_id; return found; end;$$;
create or replace function public.admin_delete_offer_attachment(p_attachment_id uuid)
returns table(storage_path text,deleted boolean) language plpgsql security invoker set search_path='' as $$
begin if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if; return query delete from public.offer_attachments where id=p_attachment_id returning offer_attachments.storage_path,true; end;$$;
grant execute on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) to authenticated;
grant execute on function public.admin_set_offer_attachment_visibility(uuid,boolean) to authenticated;
grant execute on function public.admin_delete_offer_attachment(uuid) to authenticated;
commit;
