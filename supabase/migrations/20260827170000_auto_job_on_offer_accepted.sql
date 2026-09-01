-- Teklif Kabul olunca jobs satırı yoksa oluştur (takvim jobs tablosundan okur).
-- Mevcut accepted teklifleri de doldur.

create or replace function public.ensure_job_for_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.teklifler;
  j_id uuid;
  ev timestamptz;
  su timestamptz;
  td timestamptz;
  ttl text;
begin
  select * into t from public.teklifler where id = p_offer_id;
  if not found then return null; end if;

  select id into j_id from public.jobs where offer_id = p_offer_id limit 1;
  if j_id is not null then return j_id; end if;

  if t.event_date is not null then
    ev := (t.event_date::text || ' 18:00:00')::timestamp;
    su := (t.event_date::text || ' 14:00:00')::timestamp;
    td := (t.event_date::text || ' 23:00:00')::timestamp;
  end if;

  ttl := trim(both ' ·' from concat_ws(' ·',
    nullif(t.quote_number, ''),
    nullif(t.name, ''),
    nullif(t.type, '')
  ));
  if ttl is null or ttl = '' then ttl := 'İş'; end if;

  insert into public.jobs(offer_id, title, location, setup_at, event_at, teardown_at, status, notes)
  values (
    t.id,
    ttl,
    t.location,
    su,
    ev,
    td,
    'planned',
    t.message
  )
  returning id into j_id;

  return j_id;
end;
$$;

create or replace function public.trg_offer_accepted_ensure_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    perform public.ensure_job_for_offer(new.id);
  end if;

  -- Tarih değişince bağlı işlerin event/setup/teardown kaydır
  if new.event_date is distinct from old.event_date and new.event_date is not null then
    update public.jobs
    set event_at = (new.event_date::text || ' 18:00:00')::timestamp,
        setup_at = (new.event_date::text || ' 14:00:00')::timestamp,
        teardown_at = (new.event_date::text || ' 23:00:00')::timestamp
    where offer_id = new.id
      and (event_at is null or event_at::date = coalesce(old.event_date, event_at::date));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_offer_accepted_ensure_job on public.teklifler;
create trigger trg_offer_accepted_ensure_job
  after update of status, event_date on public.teklifler
  for each row execute function public.trg_offer_accepted_ensure_job();

-- Backfill: kabul edilmiş ama jobs kaydı olmayanlar
insert into public.jobs(offer_id, title, location, setup_at, event_at, teardown_at, status, notes)
select
  t.id,
  nullif(trim(both ' ·' from concat_ws(' ·', nullif(t.quote_number,''), nullif(t.name,''), nullif(t.type,''))), '') ,
  t.location,
  case when t.event_date is not null then (t.event_date::text || ' 14:00:00')::timestamp else null end,
  case when t.event_date is not null then (t.event_date::text || ' 18:00:00')::timestamp else null end,
  case when t.event_date is not null then (t.event_date::text || ' 23:00:00')::timestamp else null end,
  'planned',
  t.message
from public.teklifler t
where t.status = 'accepted'
  and not exists (select 1 from public.jobs j where j.offer_id = t.id);

-- title boş kalmasın
update public.jobs set title = 'İş' where title is null or title = '';

grant execute on function public.ensure_job_for_offer(uuid) to authenticated;

notify pgrst, 'reload schema';
