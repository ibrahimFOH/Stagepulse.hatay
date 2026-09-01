begin;
drop policy if exists offer_pdf_assets_admin_read on public.offer_pdf_assets;
drop policy if exists offer_pdf_assets_admin_write on public.offer_pdf_assets;
drop policy if exists offer_pdf_assets_admin_all on public.offer_pdf_assets;
create policy offer_pdf_assets_admin_all on public.offer_pdf_assets for all to authenticated using (private.is_admin()) with check (private.is_admin());
create index if not exists offer_pdf_assets_created_by_idx on public.offer_pdf_assets(created_by);
create index if not exists offer_attachments_created_by_idx on public.offer_attachments(created_by);
commit;
