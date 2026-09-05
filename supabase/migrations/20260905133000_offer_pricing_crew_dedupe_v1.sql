begin;

alter table public.teklifler add column if not exists crew_count integer not null default 0;
alter table public.teklifler add column if not exists crew_unit_price numeric(12,2) not null default 0;
alter table public.teklifler add column if not exists crew_total numeric(12,2) generated always as (crew_count * crew_unit_price) stored;

drop index if exists public.offer_items_offer_equipment_idx;
create unique index if not exists offer_items_offer_equipment_uq on public.offer_items(offer_id,equipment_id) where equipment_id is not null;

create or replace function public.recalculate_offer_total(p_offer_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_items numeric(12,2); v_crew numeric(12,2); v_discount numeric(12,2);
begin
 if p_offer_id is null then return; end if;
 select coalesce(sum(coalesce(total,quantity*unit_price)),0) into v_items from public.offer_items where offer_id=p_offer_id;
 select coalesce(crew_count,0)*coalesce(crew_unit_price,0),coalesce(discount,0) into v_crew,v_discount from public.teklifler where id=p_offer_id;
 if not found then return; end if;
 update public.teklifler set total=greatest(0,coalesce(v_items,0)+coalesce(v_crew,0)-coalesce(v_discount,0)),estimated_price=greatest(0,coalesce(v_items,0)+coalesce(v_crew,0)-coalesce(v_discount,0)),updated_at=now() where id=p_offer_id;
end; $$;
grant execute on function public.recalculate_offer_total(uuid) to service_role;

create or replace function public.trg_recalculate_offer_total_items()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
begin perform public.recalculate_offer_total(coalesce(new.offer_id,old.offer_id)); return coalesce(new,old); end; $$;
drop trigger if exists trg_recalculate_offer_total_items on public.offer_items;
create trigger trg_recalculate_offer_total_items after insert or update of quantity,unit_price or delete on public.offer_items for each row execute function public.trg_recalculate_offer_total_items();

create or replace function public.trg_recalculate_offer_total_crew()
returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
begin
 if new.crew_count is distinct from old.crew_count or new.crew_unit_price is distinct from old.crew_unit_price or new.discount is distinct from old.discount then
  new.total:=greatest(0,coalesce((select sum(coalesce(total,quantity*unit_price)) from public.offer_items where offer_id=new.id),0)+coalesce(new.crew_count,0)*coalesce(new.crew_unit_price,0)-coalesce(new.discount,0));
  new.estimated_price:=new.total;
 end if;
 return new;
end; $$;
drop trigger if exists trg_recalculate_offer_total_crew on public.teklifler;
create trigger trg_recalculate_offer_total_crew before update of crew_count,crew_unit_price,discount on public.teklifler for each row execute function public.trg_recalculate_offer_total_crew();

create or replace function public.admin_set_offer_crew_pricing(p_offer_id uuid,p_crew_count integer,p_crew_unit_price numeric)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.' using errcode='42501'; end if;
 if p_crew_count is null or p_crew_count<0 then raise exception 'Personel sayısı geçersiz.'; end if;
 if p_crew_unit_price is null or p_crew_unit_price<0 then raise exception 'Kişi başı ücret geçersiz.'; end if;
 update public.teklifler set crew_count=p_crew_count,crew_unit_price=p_crew_unit_price,updated_at=now() where id=p_offer_id;
 if not found then raise exception 'Teklif bulunamadı.'; end if;
 return (select jsonb_build_object('ok',true,'crew_count',crew_count,'crew_unit_price',crew_unit_price,'crew_total',crew_total,'total',total) from public.teklifler where id=p_offer_id);
end; $$;
grant execute on function public.admin_set_offer_crew_pricing(uuid,integer,numeric) to authenticated;

update public.teklifler t set total=greatest(0,coalesce((select sum(coalesce(oi.total,oi.quantity*oi.unit_price)) from public.offer_items oi where oi.offer_id=t.id),0)+coalesce(t.crew_count,0)*coalesce(t.crew_unit_price,0)-coalesce(t.discount,0)),estimated_price=greatest(0,coalesce((select sum(coalesce(oi.total,oi.quantity*oi.unit_price)) from public.offer_items oi where oi.offer_id=t.id),0)+coalesce(t.crew_count,0)*coalesce(t.crew_unit_price,0)-coalesce(t.discount,0)),updated_at=now();
notify pgrst,'reload schema';
commit;