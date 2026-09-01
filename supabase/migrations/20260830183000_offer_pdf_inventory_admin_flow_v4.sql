begin;

-- Offer PDF/inventory/crew control schema.
insert into public.admin_capabilities(key,name,category,description,active)
values
('offers.pdf.generate','Teklif PDF oluştur','offers','Teklif için müşteri PDFi oluşturma',true),
('offers.pdf.download','Teklif PDF indir','offers','Oluşturulan teklif PDFini indirme',true),
('offers.pdf.preview','Teklif PDF önizle','offers','PDFyi müşteri görünürlüğünü etkilemeden önizleme',true),
('offers.pdf.visibility','Teklif PDF görünürlüğü','offers','Müşterinin güncel PDFyi görmesini aç/kapat',true),
('offers.equipment','Teklife envanter ekle','offers','Envanter ekipmanını teklife bağlama',true),
('offers.crew','Teklif personel sayısı','offers','Teklifte görevlendirilecek çalışan sayısını değiştirme',true)
on conflict(key) do update set name=excluded.name,category=excluded.category,description=excluded.description,active=true;

create table if not exists public.offer_pdf_assets (
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.teklifler(id) on delete cascade,
 storage_path text not null,
 file_name text not null,
 mime_type text not null default 'application/pdf',
 size_bytes bigint not null default 0,
 sha256 text,
 version_no integer not null default 1,
 is_current boolean not null default true,
 customer_visible boolean not null default true,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists offer_pdf_assets_offer_idx on public.offer_pdf_assets(offer_id,created_at desc);
create unique index if not exists offer_pdf_assets_current_uq on public.offer_pdf_assets(offer_id) where is_current;

alter table public.teklifler add column if not exists pdf_storage_path text;
alter table public.teklifler add column if not exists pdf_file_name text;
alter table public.teklifler add column if not exists pdf_updated_at timestamptz;
alter table public.teklifler add column if not exists pdf_customer_visible boolean not null default true;
alter table public.offer_items add column if not exists source_type text not null default 'manual';
alter table public.offer_items add column if not exists inventory_reserved_qty numeric not null default 0;
alter table public.offer_items add column if not exists inventory_available_qty numeric not null default 0;

create or replace function public.admin_set_offer_pdf_visibility(p_offer_id uuid,p_visible boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 update public.teklifler set pdf_customer_visible=p_visible,pdf_updated_at=now(),updated_at=now() where id=p_offer_id;
 if not found then raise exception 'Teklif bulunamadı.'; end if;
 update public.offer_pdf_assets set customer_visible=p_visible,updated_at=now() where offer_id=p_offer_id and is_current;
 return p_visible;
end;$$;

create or replace function public.admin_set_offer_crew_count(p_offer_id uuid,p_crew_count integer)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_crew_count < 0 then raise exception 'Personel sayısı negatif olamaz.'; end if;
 update public.teklifler set crew_count=p_crew_count,updated_at=now() where id=p_offer_id;
 if not found then raise exception 'Teklif bulunamadı.'; end if;
 return p_crew_count;
end;$$;

create or replace function public.admin_upsert_offer_item_equipment(p_offer_id uuid,p_equipment_id uuid,p_quantity numeric,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_available numeric;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_quantity <= 0 then raise exception 'Miktar 0dan büyük olmalı.'; end if;
 select available_quantity into v_available from public.equipment where id=p_equipment_id and active;
 if v_available is null then raise exception 'Ekipman bulunamadı.'; end if;
 select id into v_id from public.offer_items where offer_id=p_offer_id and equipment_id=p_equipment_id limit 1;
 if v_id is null then
  insert into public.offer_items(offer_id,equipment_id,description,quantity,unit_price,unit_cost,notes,source_type,inventory_reserved_qty,inventory_available_qty)
  select p_offer_id,e.id,trim(concat_ws(' ',e.category,e.brand,e.model)),p_quantity,e.daily_price,e.daily_cost,p_notes,'inventory',0,v_available from public.equipment e where e.id=p_equipment_id returning id into v_id;
 else
  update public.offer_items set quantity=p_quantity,notes=p_notes,inventory_available_qty=v_available,source_type='inventory',updated_at=now() where id=v_id;
 end if;
 return v_id;
end;$$;

create or replace function public.admin_set_offer_inventory_reserved(p_offer_id uuid,p_equipment_id uuid,p_reserved_qty numeric)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_avail numeric;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_reserved_qty < 0 then raise exception 'Rezerv miktarı negatif olamaz.'; end if;
 select available_quantity into v_avail from public.equipment where id=p_equipment_id and active;
 if v_avail is null then raise exception 'Ekipman bulunamadı.'; end if;
 if p_reserved_qty > v_avail then raise exception 'Yetersiz stok: mevcut % adet.',v_avail; end if;
 update public.offer_items set inventory_reserved_qty=p_reserved_qty,inventory_available_qty=v_avail,updated_at=now() where offer_id=p_offer_id and equipment_id=p_equipment_id;
 if not found then raise exception 'Teklif ekipman kalemi bulunamadı.'; end if;
 return true;
end;$$;

create or replace function public.admin_get_offer_inventory(p_offer_id uuid)
returns table(item_id uuid,equipment_id uuid,category text,brand text,model text,requested_qty numeric,available_qty numeric,reserved_qty numeric,source_type text,notes text)
language sql security invoker set search_path='' as $$
select oi.id,oi.equipment_id,e.category,e.brand,e.model,oi.quantity,coalesce(e.available_quantity,0),oi.inventory_reserved_qty,oi.source_type,oi.notes
from public.offer_items oi join public.equipment e on e.id=oi.equipment_id
where oi.offer_id=p_offer_id and private.is_admin()
order by e.category,e.brand,e.model;
$$;

grant execute on function public.admin_set_offer_pdf_visibility(uuid,boolean) to authenticated;
grant execute on function public.admin_set_offer_crew_count(uuid,integer) to authenticated;
grant execute on function public.admin_upsert_offer_item_equipment(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.admin_set_offer_inventory_reserved(uuid,uuid,numeric) to authenticated;
grant execute on function public.admin_get_offer_inventory(uuid) to authenticated;

alter table public.offer_pdf_assets enable row level security;
drop policy if exists offer_pdf_assets_admin_all on public.offer_pdf_assets;
create policy offer_pdf_assets_admin_all on public.offer_pdf_assets for all to authenticated using (private.is_admin()) with check (private.is_admin());

commit;
