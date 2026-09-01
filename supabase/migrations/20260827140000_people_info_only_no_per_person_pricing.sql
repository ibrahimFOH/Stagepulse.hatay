-- people (seyirci/katılımcı) yalnızca proje bilgisidir; fiyata çarpılmaz.
-- Site lead'lerinde total admin girene kadar 0 kalır (otomatik milyonluk fiyat engeli).

create or replace function public.on_quote_insert_enrich() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_id uuid;
  svc public.services;
  margin_pct numeric := 35;
  min_quote numeric := 0;
  base numeric := 0;
  price numeric := 0;
  explicit_total boolean;
begin
  -- Müşteri eşle / oluştur
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

  -- Admin manuel total verdiyse dokunma
  explicit_total := coalesce(new.total, 0) > 0 or coalesce(new.estimated_price, 0) > 0;

  if not explicit_total then
    -- Sadece hizmet taban fiyatı (kişi sayısı ASLA çarpan değil)
    select * into svc from public.services where name = new.type and active = true limit 1;
    if found then
      base := coalesce(svc.base_price, 0);
    end if;

    select value into margin_pct from public.price_rules
      where name = 'Varsayılan kâr marjı' and active = true limit 1;
    select value into min_quote from public.price_rules
      where name = 'Minimum teklif' and active = true limit 1;

    price := base;
    if price > 0 and price < coalesce(min_quote, 0) then
      price := coalesce(min_quote, 0);
    end if;

    -- Lead / site form: taban yoksa total = 0 (admin teklif yazar)
    new.estimated_price := round(price, 2);
    new.total := new.estimated_price;
    if margin_pct is not null and margin_pct > 0 and price > 0 then
      new.estimated_cost := round(price / (1 + (margin_pct / 100)), 2);
    else
      new.estimated_cost := coalesce(svc.base_cost, 0);
    end if;
    new.margin := coalesce(new.total, 0) - coalesce(new.estimated_cost, 0);
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

-- Kişi başı kuralını devre dışı bırak + not güncelle (seyirci ≠ fiyat)
update public.price_rules
set active = false,
    value = 0,
    notes = 'Kullanılmıyor: people alanı seyirci/katılımcı bilgisidir, fiyat çarpanı değildir.',
    updated_at = now()
where name = 'Kişi başı ek ücret';

-- Opsiyonel temizlik: status=new ve total>1_000_000 gibi uçuk otomatik fiyatları sıfırla
-- (admin henüz teklif yazmamış lead'ler). Kabul edilmiş / manuel işlere dokunma.
update public.teklifler
set total = 0,
    estimated_price = 0,
    estimated_cost = 0,
    margin = 0,
    updated_at = now()
where status = 'new'
  and coalesce(total, 0) > 1000000
  and accepted_at is null;
