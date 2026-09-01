begin;

alter table public.teklifler
  add column if not exists public_code text;

update public.teklifler
set public_code = upper(substr(encode(gen_random_bytes(6),'hex'),1,10))
where public_code is null or public_code='';

create unique index if not exists teklifler_public_code_uq on public.teklifler(public_code) where public_code is not null;

create or replace function public.ensure_quote_public_code(p_offer_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_code text;
begin
  select public_code into v_code from public.teklifler where id=p_offer_id;
  if v_code is not null and v_code<>'' then return v_code; end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(6),'hex'),1,10));
    exit when not exists(select 1 from public.teklifler where public_code=v_code);
  end loop;
  update public.teklifler set public_code=v_code,updated_at=now() where id=p_offer_id;
  return v_code;
end;
$$;

create or replace function public.get_public_quote_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare q public.teklifler;
begin
  select * into q
  from public.teklifler
  where upper(public_code)=upper(trim(p_code))
    and valid_until >= current_date
    and status not in ('cancelled','archived','expired');
  if not found then raise exception 'Quote not found, expired, or unavailable'; end if;
  return jsonb_build_object(
    'id',q.id,'quote_number',q.quote_number,'name',q.name,'company',q.company,
    'type',q.type,'event_type',q.event_type,'location',q.location,'people',q.people,
    'event_date',q.event_date,'duration_hours',q.duration_hours,'services',q.services,
    'total',q.total,'currency',q.currency,'valid_until',q.valid_until,'status',q.status,
    'public_code',q.public_code
  );
end;
$$;

create or replace function public.respond_to_quote_code(p_code text,p_action text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r public.teklifler;
begin
  if p_action not in ('accepted','rejected') then raise exception 'Invalid action'; end if;
  update public.teklifler
  set status=p_action,
      accepted_at=case when p_action='accepted' then now() else accepted_at end,
      rejected_at=case when p_action='rejected' then now() else rejected_at end,
      updated_at=now()
  where upper(public_code)=upper(trim(p_code))
    and valid_until >= current_date
    and status not in ('accepted','rejected','cancelled','archived','expired')
  returning * into r;
  if not found then raise exception 'Quote not found, expired, or already answered'; end if;
  insert into public.notifications(kind,title,body,offer_id)
  values('quote_response','Teklif yanıtı',coalesce(r.quote_number,'Teklif')||' müşteriden '||p_action||' yanıtı aldı.',r.id);
  return jsonb_build_object('ok',true,'status',r.status,'quote_number',r.quote_number);
end;
$$;

revoke all on function public.get_public_quote_by_code(text) from public,anon,authenticated;
grant execute on function public.get_public_quote_by_code(text) to anon,authenticated;
revoke all on function public.respond_to_quote_code(text,text) from public,anon,authenticated;
grant execute on function public.respond_to_quote_code(text,text) to anon,authenticated;

commit;
