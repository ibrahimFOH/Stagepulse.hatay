begin;
alter table public.teklifler add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.offer_items add column if not exists notes text;
alter table public.offer_items add column if not exists equipment_id uuid references public.equipment(id) on delete set null;
insert into public.offer_items(offer_id,equipment_id,description,quantity,unit_price,unit_cost,notes)
select oe.offer_id,oe.equipment_id,coalesce(nullif(oe.label,''),'Ekipman'),coalesce(oe.quantity,1),0,0,oe.notes
from public.offer_equipment oe
where not exists (select 1 from public.offer_items oi where oi.offer_id=oe.offer_id and coalesce(oi.description,'')=coalesce(oe.label,''));
with x as (
 select offer_id,jsonb_agg(jsonb_build_object('id',id,'label',coalesce(label,'Fotoğraf'),'data_url',data_url,'path',path,'sort_order',coalesce(sort_order,0)) order by coalesce(sort_order,0),created_at) imgs
 from public.offer_pdf_attachments where kind='image' group by offer_id
)
update public.teklifler t set attachments=x.imgs from x where t.id=x.offer_id;
drop table if exists public.offer_pdf_attachments cascade;
drop table if exists public.offer_equipment cascade;
commit;
