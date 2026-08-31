begin;

create or replace function public.sync_offer_pdf_state()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.is_current then
    update public.teklifler
    set pdf_storage_path = new.storage_path,
        pdf_file_name = new.file_name,
        pdf_updated_at = coalesce(new.updated_at, now()),
        pdf_customer_visible = new.customer_visible,
        updated_at = now()
    where id = new.offer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_offer_pdf_state on public.offer_pdf_assets;
create trigger trg_sync_offer_pdf_state
after insert or update of storage_path,file_name,is_current,customer_visible,updated_at
on public.offer_pdf_assets
for each row execute function public.sync_offer_pdf_state();

revoke all on function public.sync_offer_pdf_state() from public, anon, authenticated;

commit;