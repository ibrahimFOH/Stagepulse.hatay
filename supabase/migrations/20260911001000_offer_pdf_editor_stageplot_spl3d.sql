begin;

alter table public.teklifler
  add column if not exists pdf_layout jsonb not null default '{"version":1,"sections":["brand","customer","scope","items","totals","attachments","footer"]}'::jsonb;

alter table public.offer_attachments
  add column if not exists kind text not null default 'image',
  add column if not exists title text,
  add column if not exists include_in_pdf boolean not null default true;

update public.offer_attachments
set kind = case
  when lower(coalesce(mime_type,'')) = 'application/pdf' then 'document'
  else 'image'
end
where kind is null or kind = '';

update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif','application/pdf'],
    file_size_limit = greatest(coalesce(file_size_limit,0),52428800)
where id='offer-assets';

create index if not exists offer_attachments_offer_pdf_idx
  on public.offer_attachments(offer_id,include_in_pdf,sort_order,created_at);

create or replace function public.admin_get_offer_pdf_editor(p_offer_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  v_offer jsonb;
  v_layout jsonb;
  v_attachments jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
  end if;
  select to_jsonb(t) into v_offer from public.teklifler t where t.id=p_offer_id;
  if v_offer is null then raise exception 'Teklif bulunamadı.'; end if;
  select coalesce(t.pdf_layout,'{"version":1,"sections":["brand","customer","scope","items","totals","attachments","footer"]}'::jsonb)
    into v_layout from public.teklifler t where t.id=p_offer_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,
    'storage_path',a.storage_path,
    'file_name',a.file_name,
    'mime_type',a.mime_type,
    'size_bytes',a.size_bytes,
    'sort_order',a.sort_order,
    'customer_visible',a.customer_visible,
    'kind',a.kind,
    'title',a.title,
    'include_in_pdf',a.include_in_pdf
  ) order by a.sort_order,a.created_at),'[]'::jsonb)
  into v_attachments
  from public.offer_attachments a
  where a.offer_id=p_offer_id;
  return jsonb_build_object('offer',v_offer,'layout',v_layout,'attachments',v_attachments);
end;
$$;

grant execute on function public.admin_get_offer_pdf_editor(uuid) to authenticated;

create or replace function public.admin_save_offer_pdf_layout(p_offer_id uuid,p_layout jsonb)
returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_layout jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
  end if;
  if p_layout is null or jsonb_typeof(p_layout) <> 'object' then
    raise exception 'Geçerli PDF düzeni gerekli.';
  end if;
  v_layout := jsonb_build_object(
    'version',1,
    'title',coalesce(nullif(trim(p_layout->>'title'),''),'Teklif'),
    'subtitle',coalesce(p_layout->>'subtitle',''),
    'show_validity',coalesce((p_layout->>'show_validity')::boolean,true),
    'show_customer',coalesce((p_layout->>'show_customer')::boolean,true),
    'show_scope',coalesce((p_layout->>'show_scope')::boolean,true),
    'show_items',coalesce((p_layout->>'show_items')::boolean,true),
    'show_totals',coalesce((p_layout->>'show_totals')::boolean,true),
    'show_attachments',coalesce((p_layout->>'show_attachments')::boolean,true),
    'show_footer',coalesce((p_layout->>'show_footer')::boolean,true),
    'custom_note',coalesce(p_layout->>'custom_note',''),
    'attachment_heading',coalesce(nullif(trim(p_layout->>'attachment_heading'),''),'Sahne / Sistem Görseli'),
    'sections',coalesce(p_layout->'sections','["brand","customer","scope","items","totals","attachments","footer"]'::jsonb)
  );
  update public.teklifler set pdf_layout=v_layout,updated_at=now() where id=p_offer_id;
  if not found then raise exception 'Teklif bulunamadı.'; end if;
  return v_layout;
end;
$$;

grant execute on function public.admin_save_offer_pdf_layout(uuid,jsonb) to authenticated;

create or replace function public.admin_register_offer_document_attachment(
  p_offer_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_kind text default 'stage_plot',
  p_title text default null,
  p_sort_order integer default 999,
  p_customer_visible boolean default true,
  p_include_in_pdf boolean default true
)
returns uuid
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_id uuid; v_kind text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
  end if;
  if not exists(select 1 from public.teklifler where id=p_offer_id) then raise exception 'Teklif bulunamadı.'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp','image/gif','image/avif') then
    raise exception 'Desteklenmeyen dosya türü.';
  end if;
  v_kind := case when p_kind in ('spl_3d','stage_plot','document','image') then p_kind else 'stage_plot' end;
  insert into public.offer_attachments(
    offer_id,storage_path,file_name,mime_type,size_bytes,sort_order,customer_visible,created_by,kind,title,include_in_pdf
  ) values(
    p_offer_id,p_storage_path,p_file_name,p_mime_type,coalesce(p_size_bytes,0),coalesce(p_sort_order,999),coalesce(p_customer_visible,true),auth.uid(),v_kind,nullif(trim(p_title),''),coalesce(p_include_in_pdf,true)
  ) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.admin_register_offer_document_attachment(uuid,text,text,text,bigint,text,text,integer,boolean,boolean) to authenticated;

create or replace function public.admin_set_offer_attachment_pdf_options(
  p_attachment_id uuid,
  p_title text,
  p_kind text,
  p_include_in_pdf boolean,
  p_customer_visible boolean
)
returns boolean
language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode='42501';
  end if;
  if p_kind not in ('spl_3d','stage_plot','document','image') then raise exception 'Geçersiz ek türü.'; end if;
  update public.offer_attachments
  set title=nullif(trim(p_title),''),kind=p_kind,include_in_pdf=coalesce(p_include_in_pdf,true),customer_visible=coalesce(p_customer_visible,true),updated_at=now()
  where id=p_attachment_id;
  if not found then raise exception 'Ek bulunamadı.'; end if;
  return true;
end;
$$;

grant execute on function public.admin_set_offer_attachment_pdf_options(uuid,text,text,boolean,boolean) to authenticated;

commit;
