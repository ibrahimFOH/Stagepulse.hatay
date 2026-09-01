begin;

drop function if exists public.admin_get_offer_attachments(uuid);
drop function if exists public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean);
drop function if exists public.admin_delete_offer_attachment(uuid);
drop function if exists public.admin_set_offer_attachment_visibility(uuid,boolean);

create table if not exists public.offer_attachments (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.teklifler(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null,
 mime_type text not null,
 size_bytes bigint not null default 0,
 sort_order integer not null default 999,
 customer_visible boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists offer_attachments_offer_idx on public.offer_attachments(offer_id,sort_order,created_at);
alter table public.offer_attachments enable row level security;
drop policy if exists offer_attachments_admin_all on public.offer_attachments;
create policy offer_attachments_admin_all on public.offer_attachments for all to authenticated using (private.is_admin()) with check (private.is_admin());

insert into storage.buckets(id,name,public) values ('offer-assets','offer-assets',false) on conflict (id) do update set public=false;
drop policy if exists offer_assets_admin_select on storage.objects;
drop policy if exists offer_assets_admin_insert on storage.objects;
drop policy if exists offer_assets_admin_update on storage.objects;
drop policy if exists offer_assets_admin_delete on storage.objects;
create policy offer_assets_admin_select on storage.objects for select to authenticated using (bucket_id='offer-assets' and private.is_admin());
create policy offer_assets_admin_insert on storage.objects for insert to authenticated with check (bucket_id='offer-assets' and private.is_admin());
create policy offer_assets_admin_update on storage.objects for update to authenticated using (bucket_id='offer-assets' and private.is_admin()) with check (bucket_id='offer-assets' and private.is_admin());
create policy offer_assets_admin_delete on storage.objects for delete to authenticated using (bucket_id='offer-assets' and private.is_admin());

create function public.admin_get_offer_attachments(p_offer_id uuid) returns table(id uuid,storage_path text,file_name text,mime_type text,size_bytes bigint,sort_order integer,customer_visible boolean,created_at timestamptz) language sql security invoker set search_path='' as $$ select a.id,a.storage_path,a.file_name,a.mime_type,a.size_bytes,a.sort_order,a.customer_visible,a.created_at from public.offer_attachments a where a.offer_id=p_offer_id and private.is_admin() order by a.sort_order,a.created_at; $$;
create function public.admin_register_offer_attachment(p_offer_id uuid,p_storage_path text,p_file_name text,p_mime_type text,p_size_bytes bigint,p_sort_order integer default 999,p_customer_visible boolean default true) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare v_id uuid; begin if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if; if not exists(select 1 from public.teklifler where id=p_offer_id) then raise exception 'Teklif bulunamadı.'; end if; insert into public.offer_attachments(offer_id,storage_path,file_name,mime_type,size_bytes,sort_order,customer_visible,created_by) values(p_offer_id,p_storage_path,p_file_name,p_mime_type,coalesce(p_size_bytes,0),coalesce(p_sort_order,999),coalesce(p_customer_visible,true),auth.uid()) returning id into v_id; return v_id; end; $$;
create function public.admin_delete_offer_attachment(p_attachment_id uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$ begin if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if; delete from public.offer_attachments where id=p_attachment_id; return found; end; $$;
create function public.admin_set_offer_attachment_visibility(p_attachment_id uuid,p_visible boolean) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$ begin if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if; update public.offer_attachments set customer_visible=p_visible,updated_at=now() where id=p_attachment_id; if not found then raise exception 'Fotoğraf bulunamadı.'; end if; return p_visible; end; $$;

grant execute on function public.admin_get_offer_attachments(uuid) to authenticated;
grant execute on function public.admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean) to authenticated;
grant execute on function public.admin_delete_offer_attachment(uuid) to authenticated;
grant execute on function public.admin_set_offer_attachment_visibility(uuid,boolean) to authenticated;
commit;
