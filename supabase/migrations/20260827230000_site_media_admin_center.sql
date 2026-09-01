-- Stagepulse: admin-only site media center.
-- Files live in Supabase Storage; GitHub remains source-code only.

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('site-media','site-media',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml','video/mp4','video/webm','video/quicktime','application/pdf'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.site_media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  alt_text text,
  placement text not null default 'library' check (placement in ('library','gallery','reference','rider','home','service','region')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_media enable row level security;
revoke all on public.site_media from anon,authenticated;
grant select,insert,update,delete on public.site_media to authenticated;
drop policy if exists site_media_admin_select on public.site_media;
drop policy if exists site_media_admin_insert on public.site_media;
drop policy if exists site_media_admin_update on public.site_media;
drop policy if exists site_media_admin_delete on public.site_media;
create policy site_media_admin_select on public.site_media for select to authenticated using (private.is_admin());
create policy site_media_admin_insert on public.site_media for insert to authenticated with check (private.is_admin() and created_by=auth.uid());
create policy site_media_admin_update on public.site_media for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy site_media_admin_delete on public.site_media for delete to authenticated using (private.is_admin());

drop policy if exists site_media_storage_admin_insert on storage.objects;
drop policy if exists site_media_storage_admin_update on storage.objects;
drop policy if exists site_media_storage_admin_delete on storage.objects;
create policy site_media_storage_admin_insert on storage.objects for insert to authenticated with check (bucket_id='site-media' and private.is_admin() and (storage.foldername(name))[1]='site');
create policy site_media_storage_admin_update on storage.objects for update to authenticated using (bucket_id='site-media' and private.is_admin()) with check (bucket_id='site-media' and private.is_admin());
create policy site_media_storage_admin_delete on storage.objects for delete to authenticated using (bucket_id='site-media' and private.is_admin());

create index if not exists site_media_created_at_idx on public.site_media(created_at desc);
create index if not exists site_media_placement_idx on public.site_media(placement);
