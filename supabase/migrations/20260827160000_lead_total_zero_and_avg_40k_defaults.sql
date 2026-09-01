-- Gelen teklif (lead) total her zaman 0: admin hazırlayıp gönderir.
-- Ortalama paket varsayılanları ~40.000 ₺ bandı (sadece tabanı 0 olan hizmetler güncellenir).

create or replace function public.on_quote_insert_enrich() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_id uuid;
begin
  select id into c_id from public.customers where phone = new.phone limit 1;
  if c_id is null then
    insert into public.customers(name, company, phone, email, last_contact_at)
    values (new.name, new.company, new.phone, new.email, now())
    returning id into c_id;
  else
    update public.customers
    set name = coalesce(nullif(new.name, ''), name),
        company = coalesce(nullif(new.company, ''), company),
        email = coalesce(nullif(new.email, ''), email),
        last_contact_at = now(),
        updated_at = now()
    where id = c_id;
  end if;
  new.customer_id := c_id;

  -- Site / lead: fiyat ASLA otomatik şişmesin.
  if coalesce(new.total, 0) <= 0 and coalesce(new.estimated_price, 0) <= 0 then
    new.total := 0;
    new.estimated_price := 0;
    new.estimated_cost := 0;
    new.margin := 0;
  end if;

  insert into public.notifications(kind, title, body, offer_id)
  values (
    'new_quote',
    'Yeni teklif talebi',
    coalesce(new.quote_number, 'Yeni teklif') || ' - ' || coalesce(new.name, ''),
    new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_quote_insert_enrich on public.teklifler;
create trigger trg_quote_insert_enrich
  before insert on public.teklifler
  for each row execute function public.on_quote_insert_enrich();

-- Ortalama paket bandı ~40k (yalnızca boş/0 tabanlar). services tablosunda updated_at yok.
update public.services set base_price = 35000
where name = 'Ses Sistemi Kiralama' and coalesce(base_price, 0) = 0;
update public.services set base_price = 28000
where name = 'Işık & Truss Kiralama' and coalesce(base_price, 0) = 0;
update public.services set base_price = 40000
where name = 'Paket (Kiralama + Mühendislik)' and coalesce(base_price, 0) = 0;
update public.services set base_price = 22000
where name = 'FOH Operasyonu' and coalesce(base_price, 0) = 0;
update public.services set base_price = 8000
where name in ('Stage Plot / Sahne Planı', '3D Sahne Çizimi', 'SPL Hesaplama', 'Teknik Rider Hazırlama')
  and coalesce(base_price, 0) = 0;

insert into public.price_rules(name, rule_type, value, notes, active)
values ('Varsayılan ekip sayısı', 'fixed', 3, 'Otomatik öneri için ekip büyüklüğü', true)
on conflict (name) do update set active = true, updated_at = now();

update public.price_rules set value = 2500, active = true, notes = 'Kurulum bedeli', updated_at = now()
where name = 'Kurulum' and coalesce(value, 0) = 0;
update public.price_rules set value = 1500, active = true, notes = 'Söküm bedeli', updated_at = now()
where name = 'Söküm' and coalesce(value, 0) = 0;
update public.price_rules
set value = case when coalesce(value, 0) = 0 or value > 10000 then 1500 else value end,
    active = true,
    notes = 'Ekip (çalışan) kişi başı — seyirciye çarpılmaz',
    updated_at = now()
where name = 'Kişi başı ek ücret';

update public.teklifler
set total = 0, estimated_price = 0, estimated_cost = 0, margin = 0, updated_at = now()
where coalesce(total, 0) > 1000000
  and accepted_at is null
  and status in ('new', 'reviewing', 'preparing', 'sent');

notify pgrst, 'reload schema';
