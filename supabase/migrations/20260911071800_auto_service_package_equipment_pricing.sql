begin;

-- Hizmet toplamı belirlendiğinde, hizmetin tanımlı ekipman BOM'u otomatik olarak
-- teklife eklenir ve toplam bedel ekipmanlara ekipmanın mevcut günlük satış fiyatı
-- ağırlığına göre dağıtılır. Böylece örneğin 40.000 TL hizmet seçildiğinde
-- hizmete bağlı bütün ekipmanların toplamı otomatik olarak 40.000 TL olur.
create or replace function public.auto_price_offer_service_equipment()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_service_id uuid;
  v_target numeric(12,2);
  v_weight_sum numeric(18,4);
  v_allocated numeric(12,2) := 0;
  v_index integer := 0;
  v_count integer := 0;
  r record;
begin
  -- offer_items -> teklif total -> bu trigger şeklindeki zincirde yeniden
  -- çalışıp sonsuz döngüye girmesin.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_target := greatest(0, coalesce(new.total, 0));
  if v_target <= 0 then
    return new;
  end if;

  -- Öncelik teklifin hizmet adı olan type alanıdır. Eski kayıtlar için
  -- services JSON alanındaki hizmet adı da desteklenir.
  select s.id into v_service_id
  from public.services s
  where s.active = true
    and lower(trim(s.name)) = lower(trim(coalesce(new.type, '')))
  limit 1;

  if v_service_id is null and jsonb_typeof(coalesce(new.services, '[]'::jsonb)) = 'array' then
    select s.id into v_service_id
    from public.services s
    where s.active = true
      and exists (
        select 1
        from jsonb_array_elements(coalesce(new.services, '[]'::jsonb)) j
        where lower(trim(coalesce(j #>> '{}', j->>'name', j->>'service', ''))) = lower(trim(s.name))
      )
    order by s.sort_order, s.name
    limit 1;
  end if;

  if v_service_id is null then
    return new;
  end if;

  -- Hizmet BOM'unda bulunan ekipmanlardan eksik olanları teklife ekle.
  insert into public.offer_items(
    offer_id, service_id, equipment_id, description, quantity, unit_price, unit_cost,
    source_type, notes
  )
  select
    new.id,
    d.service_id,
    d.equipment_id,
    trim(concat_ws(' ', nullif(e.brand,''), nullif(e.model,''), nullif(e.category,''))),
    d.quantity,
    0,
    coalesce(e.daily_cost,0),
    'service_default',
    d.notes
  from public.service_equipment_defaults d
  join public.equipment e on e.id=d.equipment_id
  where d.service_id=v_service_id
    and e.active=true
    and not exists (
      select 1
      from public.offer_items oi
      where oi.offer_id=new.id
        and oi.equipment_id=d.equipment_id
    );

  -- Ekipman satış fiyatlarını ağırlık olarak kullan. Böylece pahalı ekipman
  -- paketten daha yüksek pay alır; ancak toplam her durumda hizmet toplamına
  -- tam olarak eşitlenir. Günlük satış fiyatlarının tamamı 0 ise adet ağırlığı
  -- ile eşit dağıtım yapılır.
  select count(*),
         coalesce(sum(oi.quantity * greatest(coalesce(e.daily_price,0),0)),0)
    into v_count, v_weight_sum
  from public.offer_items oi
  join public.equipment e on e.id=oi.equipment_id
  where oi.offer_id=new.id
    and oi.service_id=v_service_id;

  if v_count=0 then
    return new;
  end if;

  if v_weight_sum <= 0 then
    select coalesce(sum(oi.quantity),0)
      into v_weight_sum
    from public.offer_items oi
    where oi.offer_id=new.id
      and oi.service_id=v_service_id;
  end if;

  -- Son kaleme kalan kuruşu vererek ekipman toplamını hedef hizmet bedeline
  -- tam olarak eşitle.
  for r in
    select oi.id,
           oi.quantity,
           case
             when v_weight_sum > 0 and v_weight_sum <> v_count
               then greatest(coalesce(e.daily_price,0),0) * oi.quantity
             else oi.quantity
           end as weight
    from public.offer_items oi
    left join public.equipment e on e.id=oi.equipment_id
    where oi.offer_id=new.id
      and oi.service_id=v_service_id
    order by oi.created_at, oi.id
  loop
    v_index := v_index + 1;

    if v_index = v_count then
      update public.offer_items
      set unit_price = case
        when r.quantity > 0 then round((v_target-v_allocated)/r.quantity,2)
        else 0
      end
      where id=r.id;
    else
      update public.offer_items
      set unit_price = case
        when r.quantity > 0 then round(v_target * r.weight / v_weight_sum / r.quantity,2)
        else 0
      end
      where id=r.id;

      v_allocated := v_allocated + round(v_target * r.weight / v_weight_sum,2);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_auto_price_offer_service_equipment on public.teklifler;
create trigger trg_auto_price_offer_service_equipment
after insert or update of total, type, services on public.teklifler
for each row execute function public.auto_price_offer_service_equipment();

notify pgrst, 'reload schema';
commit;
