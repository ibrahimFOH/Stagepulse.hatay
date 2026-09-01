begin;
create or replace function public.get_public_quote_by_code(p_code text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v jsonb;
begin
 select jsonb_build_object('id',t.id,'quote_number',t.quote_number,'name',t.name,'company',t.company,'type',t.type,'event_type',t.event_type,'location',t.location,'event_date',t.event_date,'duration_hours',t.duration_hours,'people',t.people,'message',t.message,'services',t.services,'status',t.status,'currency',t.currency,'estimated_price',t.estimated_price,'discount',t.discount,'total',t.total,'public_code',t.public_code,'pdf',case when coalesce(t.pdf_customer_visible,true) and t.pdf_storage_path is not null then jsonb_build_object('available',true,'file_name',t.pdf_file_name,'updated_at',t.pdf_updated_at) else jsonb_build_object('available',false) end) into v
 from public.teklifler t where t.public_code=p_code and (t.validity_until is null or t.validity_until>=now()) and t.status not in ('cancelled','archived','expired');
 if v is null then raise exception 'Quote not found, expired, or unavailable'; end if;
 return v;
end;$$;
revoke all on function public.get_public_quote_by_code(text) from public;
grant execute on function public.get_public_quote_by_code(text) to anon,authenticated;
revoke all on function public.customer_offer_pdf_state(text) from public,anon,authenticated;
commit;
