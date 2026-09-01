-- Stagepulse: allow the admin media center to upload into the existing gallery path.
-- Existing public media lives under images/gallery/. The previous policy only allowed site/,
-- which made the Media Center show files but reject new uploads to its real destination.

drop policy if exists site_media_storage_admin_insert on storage.objects;

create policy site_media_storage_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-media'
  and private.is_admin()
  and (storage.foldername(name))[1] in ('site', 'images')
);
