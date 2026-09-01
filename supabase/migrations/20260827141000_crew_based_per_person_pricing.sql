-- Kişi başı ek ücret = EKİP (çalışan) sayısı × ücret.
-- people (seyirci/katılımcı) yalnızca bilgi; fiyata girmez.
-- Varsayılan ekip: 3 (2–4 kişilik ekip için panelden 2, 3 veya 4 yapın).

insert into public.price_rules(name, rule_type, value, notes, active)
values (
  'Varsayılan ekip sayısı',
  'fixed',
  3,
  'Otomatik teklif tahmini için ekip büyüklüğü (2–4). Seyirci sayısı değildir.',
  true
)
on conflict (name) do update
set notes = excluded.notes,
    active = true,
    updated_at = now();

-- Kullanıcının girdiği 2500 vb. değeri koru; sadece anlamı netleştir ve aç
update public.price_rules
set active = true,
    notes = 'Ekip (çalışan) kişi başı ek ücret. Seyirci/people alanına çarpılmaz; Varsayılan ekip sayısı ile çarpılır.',
    updated_at = now()
where name = 'Kişi başı ek ücret';

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
  crew numeric := 3;
  per_crew numeric := 0;
  setup_fee numeric := 0;
  teardown_fee numeric := 0;
  explicit_total boolean;
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

  -- Admin / panel zaten total yazdıysa otomatik hesabı ezme
  explicit_total := coalesce(new.total, 0) > 0 or coalesce(new.estimated_price, 0) > 0;

  if not explicit_total then
    select * into svc from public.services where name = new.type and active = true limit 1;
    if found then
      base := coalesce(svc.base_price, 0);
    end if;

    select value into margin_pct from public.price_rules
      where name = 'Varsayılan kâr marjı' and active = true limit 1;
    select value into min_quote from public.price_rules
      where name = 'Minimum teklif' and active = true limit 1;
    select value into per_crew from public.price_rules
      where name = 'Kişi başı ek ücret' and active = true limit 1;
    select value into setup_fee from public.price_rules
      where name = 'Kurulum' and active = true limit 1;
    select value into teardown_fee from public.price_rules
      where name = 'Söküm' and active = true limit 1;
    select value into crew from public.price_rules
      where name = 'Varsayılan ekip sayısı' and active = true limit 1;

    if per_crew is null then per_crew := 0; end if;
    if setup_fee is null then setup_fee := 0; end if;
    if teardown_fee is null then teardown_fee := 0; end if;
    if crew is null or crew < 1 then crew := 3; end if;
    -- Makul tavan: 1–12 kişi ekip (seyirci kaçak girişi engeli)
    if crew > 12 then crew := 12; end if;

    -- people (seyirci) KULLANILMAZ
    price := base + setup_fee + teardown_fee + (crew * per_crew);

    if price > 0 and price < coalesce(min_quote, 0) then
      price := coalesce(min_quote, 0);
    end if;

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

-- Eski seyirci×2500 şişirmesi: new + >1M → sıfırla (admin yeniden yazar)
update public.teklifler
set total = 0,
    estimated_price = 0,
    estimated_cost = 0,
    margin = 0,
    updated_at = now()
where status = 'new'
  and coalesce(total, 0) > 1000000
  and accepted_at is null;
