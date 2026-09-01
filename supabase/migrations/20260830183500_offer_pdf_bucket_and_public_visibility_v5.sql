begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('offer-pdfs','offer-pdfs',false,52428800,array['application/pdf','text/html'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['application/pdf','text/html'];
create or replace function public.get_customer_offer_pdf_by_code(p_code text)
returns jsonb language sql security invoker set search_path='' as $$
select case when coalesce(t.pdf_customer_visible,true) and t.pdf_storage_path is not null and (t.validity_until is null or t.validity_until>=now()) and t.status not in ('cancelled','archived','expired') then jsonb_build_object('file_name',t.pdf_file_name,'storage_path',t.pdf_storage_path,'updated_at',t.pdf_updated_at) else null end
from public.teklifler t where t.public_code=p_code;
$$;
grant execute on function public.get_customer_offer_pdf_by_code(text) to anon,authenticated;
commit;
