-- ============================================================
-- STAGEPULSE PERSONEL PORTALI
-- schema.sql çalıştıktan SONRA Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1) Personel hesapları (auth.users ile bağlı) + yetki alanları
create table if not exists public.staff_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique,
  display_name  text not null,
  role          text not null default 'crew'
                check (role in ('crew','tech','warehouse','lead')),
  phone         text,
  active        boolean not null default true,
  notes         text,
  -- Admin personel oluştururken hangi modülleri göreceğini seçer.
  -- Temel modüller (jobs/equipment/offers/update_job_status) varsayılan açık;
  -- hassas/mali modüller (customers/finance/pricing/financials) admin
  -- açıkça işaretlemeden asla açılmaz.
  permissions   jsonb not null default '{
    "jobs": true,
    "equipment": true,
    "offers": true,
    "view_assigned_jobs": true,
    "accept_job": true,
    "reject_job": true,
    "update_job_status": true,
    "customers": false,
    "finance": false,
    "pricing": false,
    "financials": false
  }'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Eski kurulumlarda permissions kolonu yoksa ekle
alter table public.staff_profiles
  add column if not exists permissions jsonb not null default '{
    "jobs": true,
    "equipment": true,
    "offers": true,
    "view_assigned_jobs": true,
    "accept_job": true,
    "reject_job": true,
    "update_job_status": true,
    "customers": false,
    "finance": false,
    "pricing": false,
    "financials": false
  }'::jsonb;

create index if not exists staff_profiles_active_idx on public.staff_profiles(active);
create index if not exists staff_profiles_username_idx on public.staff_profiles(username);


-- 2) İş ↔ Ekipman (malzeme listesi)
create table if not exists public.job_equipment (
  job_id        uuid not null references public.jobs(id) on delete cascade,
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  quantity      integer not null default 1 check (quantity > 0),
  notes         text,
  primary key (job_id, equipment_id)
);


-- 3) Yardımcı fonksiyonlar
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.active = true
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid() and p.active = true
  );
$$;

create or replace function public.is_admin_or_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_staff();
$$;

-- Oturum sahibi personelin belirli bir yetkiye ("permissions" jsonb alanında)
-- sahip olup olmadığını kontrol eder. Admin için her zaman true döner, çünkü
-- admin panelin kendisi zaten ayrı bir giriş/yetki setiyle çalışır.
create or replace function public.staff_has_perm(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.staff_profiles p
      where p.user_id = auth.uid()
        and p.active = true
        and coalesce((p.permissions ->> perm)::boolean, false) = true
    );
$$;


-- 4) Güvenli görünümler
-- Temel görünümler: maliyet / marj YOK + ilgili yetki açık olmalı
-- (staff_has_perm kontrolü olmadan sadece arayüz gizler, API'den yine
-- okunabilirdi — bu yüzden burada da kontrol ediyoruz).
create or replace view public.equipment_staff as
select
  id, category, brand, model, quantity, active, notes, created_at, updated_at
from public.equipment
where active = true and public.staff_has_perm('equipment');

create or replace view public.offers_staff as
select
  id, quote_number, name, company, location, people,
  event_date, event_type, type,
  total as agreed_amount, currency, status, public_token,
  created_at, updated_at
from public.teklifler
where status in ('accepted', 'preparing', 'sent', 'new')
  and public.staff_has_perm('offers');

-- Hassas görünümler: sadece admin'in ilgili personele o yetkiyi açıkça
-- verdiği durumda satır döner (staff_has_perm kontrolü view tanımının
-- içinde). Yetkisi olmayan personel bu view'lardan hiç satır alamaz —
-- sorguyu değiştirse bile, çünkü filtre client tarafında değil burada.
create or replace view public.customers_staff as
select
  id, name, company, phone, email, last_contact_at, created_at
from public.customers
where public.staff_has_perm('customers');

create or replace view public.payments_staff as
select
  pay.id, pay.offer_id, pay.description, pay.amount, pay.due_date,
  pay.paid_at, pay.status, pay.created_at,
  t.quote_number, t.name as customer_name
from public.payments pay
join public.teklifler t on t.id = pay.offer_id
where public.staff_has_perm('finance');

create or replace view public.pricing_staff as
select id, name, description, base_price, sort_order
from public.services
where active = true and public.staff_has_perm('pricing')
union all
select id, name, null as description, value as base_price, 0 as sort_order
from public.price_rules
where active = true and public.staff_has_perm('pricing');

-- Mali detay görünümleri: maliyet / kâr / marj sadece "financials" yetkisi
-- açıkça verilmiş VE ilgili temel yetki (offers/equipment) de açık olan
-- personele gösterilir. offers_staff / equipment_staff (yukarıdaki) bu
-- alanları hiçbir zaman içermez.
create or replace view public.offers_financial_staff as
select
  id, quote_number, estimated_cost, estimated_price, discount, margin, total
from public.teklifler
where status in ('accepted', 'preparing', 'sent', 'new')
  and public.staff_has_perm('offers')
  and public.staff_has_perm('financials');

create or replace view public.equipment_financial_staff as
select id, daily_cost, daily_price
from public.equipment
where active = true
  and public.staff_has_perm('equipment')
  and public.staff_has_perm('financials');


-- 5) RLS
alter table public.staff_profiles enable row level security;
alter table public.job_equipment  enable row level security;
alter table public.jobs           enable row level security;
alter table public.equipment      enable row level security;
alter table public.teklifler      enable row level security;
alter table public.job_staff      enable row level security;
alter table public.staff          enable row level security;


-- 6) Eski policy temizliği
drop policy if exists staff_profiles_admin   on public.staff_profiles;
drop policy if exists staff_profiles_self    on public.staff_profiles;
drop policy if exists job_equipment_admin    on public.job_equipment;
drop policy if exists job_equipment_staff    on public.job_equipment;
drop policy if exists jobs_staff_select      on public.jobs;
drop policy if exists jobs_staff_update      on public.jobs;
-- equipment_staff_select ve teklifler_staff_select KASITLI olarak siliniyor
-- ve yeniden oluşturulmuyor: bu policy'ler personele equipment/teklifler
-- tablolarına DOĞRUDAN erişim veriyordu, yani personel sorguyu değiştirip
-- daily_cost / estimated_cost / margin gibi mali sütunları da çekebiliyordu
-- (RLS satır bazlıdır, sütun gizlemez). Personel artık sadece aşağıdaki
-- güvenli view'lar üzerinden okuyor (equipment_staff, offers_staff,
-- *_financial_staff) — bu view'lar hem satırı hem sütunu kontrol eder.
drop policy if exists equipment_staff_select on public.equipment;
drop policy if exists teklifler_staff_select on public.teklifler;
drop policy if exists job_staff_staff_select on public.job_staff;
drop policy if exists staff_staff_select     on public.staff;


-- 7) Policy'ler
create policy staff_profiles_admin on public.staff_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy staff_profiles_self on public.staff_profiles
  for select to authenticated
  using (user_id = auth.uid() and active = true);

create policy job_equipment_admin on public.job_equipment
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy job_equipment_staff on public.job_equipment
  for select to authenticated
  using (public.staff_has_perm('jobs') or public.staff_has_perm('equipment'));

create policy jobs_staff_select on public.jobs
  for select to authenticated
  using (public.staff_has_perm('jobs'));

create policy jobs_staff_update on public.jobs
  for update to authenticated
  using (public.staff_has_perm('jobs') and public.staff_has_perm('update_job_status'))
  with check (public.staff_has_perm('jobs') and public.staff_has_perm('update_job_status'));

-- equipment ve teklifler için personele artık doğrudan bir SELECT policy
-- verilmiyor: erişim yalnızca yukarıdaki view'lar (equipment_staff,
-- offers_staff, equipment_financial_staff, offers_financial_staff)
-- üzerinden, staff_has_perm() kontrolüyle sağlanıyor.

create policy job_staff_staff_select on public.job_staff
  for select to authenticated
  using (public.is_staff());

create policy staff_staff_select on public.staff
  for select to authenticated
  using (public.is_staff() and active = true);


-- 8) Grant
grant select on public.equipment_staff            to authenticated;
grant select on public.offers_staff                to authenticated;
grant select on public.customers_staff             to authenticated;
grant select on public.payments_staff              to authenticated;
grant select on public.pricing_staff               to authenticated;
grant select on public.offers_financial_staff      to authenticated;
grant select on public.equipment_financial_staff   to authenticated;
grant select, insert, update, delete on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.job_equipment  to authenticated;
grant select, update on public.jobs to authenticated;


-- 9) updated_at tetikleyicisi
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_profiles_updated_at on public.staff_profiles;
create trigger staff_profiles_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- V2 OPERASYON YETKİLERİ: personel iş kabul/red + atama sınırı
-- ============================================================
alter table public.staff_profiles
  alter column permissions set default '{
    "jobs": true,
    "equipment": true,
    "offers": true,
    "view_assigned_jobs": true,
    "accept_job": true,
    "reject_job": true,
    "update_job_status": true,
    "customers": false,
    "finance": false,
    "pricing": false,
    "financials": false
  }'::jsonb;

update public.staff_profiles
set permissions = permissions || '{
  "view_assigned_jobs": true,
  "accept_job": true,
  "reject_job": true
}'::jsonb;

create or replace function public.staff_has_perm(perm text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid() and p.active = true
      and coalesce((p.permissions ->> perm)::boolean, false) = true
  );
$$;

alter table public.job_staff add column if not exists response_status text not null default 'pending'
  check (response_status in ('pending','accepted','rejected'));
alter table public.job_staff add column if not exists response_note text;
alter table public.job_staff add column if not exists responded_at timestamptz;

-- Yukarıdaki view'da staff_id UUID'si public.staff.id ile eşleşen kurulumlar için
-- auth user id kullanıldığı için eski şemayı bozmamak adına ikinci güvenli view:
drop view if exists public.my_jobs_staff;
create or replace view public.my_jobs_staff as
select
  j.id,j.title,j.setup_at,j.event_at,j.teardown_at,j.location,j.status,j.notes,j.created_at,
  js.response_status,js.response_note,js.responded_at,js.fee
from public.jobs j
join public.job_staff js on js.job_id = j.id
join public.staff s on s.id = js.staff_id
join public.staff_profiles sp on sp.user_id = auth.uid() and sp.active = true and lower(sp.display_name)=lower(s.name)
where public.staff_has_perm('jobs');

grant select on public.my_jobs_staff to authenticated;

create or replace function public.staff_respond_job(p_job_id uuid, p_response text, p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_staff_id uuid;
  v_row public.job_staff%rowtype;
begin
  if not public.is_staff() then raise exception 'Yetkisiz'; end if;
  if p_response not in ('accepted','rejected') then raise exception 'Geçersiz cevap'; end if;
  if p_response='accepted' and not public.staff_has_perm('accept_job') then raise exception 'İş kabul yetkiniz yok'; end if;
  if p_response='rejected' and not public.staff_has_perm('reject_job') then raise exception 'İş red yetkiniz yok'; end if;
  select s.id into v_staff_id
  from public.staff s
  join public.staff_profiles sp on lower(sp.display_name)=lower(s.name)
  where sp.user_id=auth.uid() and sp.active=true and s.active=true
    and lower(sp.display_name)=lower(s.name)
    and (sp.phone is null or s.phone is null or regexp_replace(sp.phone, '\D', '', 'g') = regexp_replace(s.phone, '\D', '', 'g'))
  limit 1;
  if v_staff_id is null then raise exception 'Personel kaydı bulunamadı'; end if;
  update public.job_staff
    set response_status=p_response,response_note=nullif(trim(p_note),''),responded_at=now()
    where job_id=p_job_id and staff_id=v_staff_id
    returning * into v_row;
  if not found then raise exception 'Bu iş size atanmamış'; end if;
  return jsonb_build_object('ok',true,'job_id',p_job_id,'response',p_response,'responded_at',v_row.responded_at);
end;
$$;
revoke all on function public.staff_respond_job(uuid,text,text) from public;
grant execute on function public.staff_respond_job(uuid,text,text) to authenticated;

-- ============================================================
-- V3 GENİŞLETİLMİŞ OPERASYON YETKİLERİ
-- Admin panelinden kişi bazında açılıp kapatılır.
-- Mali yetkiler varsayılan olarak KAPALI kalır.
-- ============================================================
alter table public.staff_profiles
  alter column permissions set default '{
    "jobs": true,
    "equipment": true,
    "offers": true,
    "view_assigned_jobs": true,
    "accept_job": true,
    "reject_job": true,
    "update_job_status": true,
    "update_job_notes": true,
    "manage_job_equipment": true,
    "view_job_contacts": false,
    "view_job_documents": true,
    "equipment_checkout": false,
    "equipment_return": false,
    "report_issue": true,
    "view_team": true,
    "customers": false,
    "finance": false,
    "pricing": false,
    "financials": false
  }'::jsonb;

update public.staff_profiles
set permissions = permissions || '{
  "update_job_notes": true,
  "manage_job_equipment": true,
  "view_job_documents": true,
  "report_issue": true,
  "view_team": true
}'::jsonb;

-- Personelin atanmış işte durum değiştirmesi: yalnızca kendisine atanmış iş.
create or replace function public.staff_update_job_status(
  p_job_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_job_staff_exists boolean;
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz';
  end if;

  if not public.staff_has_perm('update_job_status') then
    raise exception 'İş durumu güncelleme yetkiniz yok';
  end if;

  if p_status not in ('planned','confirmed','in_progress','done','cancelled') then
    raise exception 'Geçersiz iş durumu';
  end if;

  select s.id into v_staff_id
  from public.staff s
  join public.staff_profiles sp
    on sp.user_id = auth.uid()
   and sp.active = true
   and lower(sp.display_name) = lower(s.name)
  where s.active = true
  limit 1;

  if v_staff_id is null then
    raise exception 'Personel kaydı bulunamadı';
  end if;

  select exists(
    select 1 from public.job_staff
    where job_id = p_job_id and staff_id = v_staff_id
  ) into v_job_staff_exists;

  if not v_job_staff_exists then
    raise exception 'Bu iş size atanmamış';
  end if;

  update public.jobs
  set status = p_status, updated_at = now()
  where id = p_job_id;

  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'status', p_status);
end;
$$;

revoke all on function public.staff_update_job_status(uuid,text) from public;
grant execute on function public.staff_update_job_status(uuid,text) to authenticated;

-- Personelin atanmış işin operasyon notunu değiştirmesi.
create or replace function public.staff_update_job_notes(
  p_job_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz';
  end if;

  if not public.staff_has_perm('update_job_notes') then
    raise exception 'İş notu güncelleme yetkiniz yok';
  end if;

  select s.id into v_staff_id
  from public.staff s
  join public.staff_profiles sp
    on sp.user_id = auth.uid()
   and sp.active = true
   and lower(sp.display_name) = lower(s.name)
  where s.active = true
  limit 1;

  if v_staff_id is null then
    raise exception 'Personel kaydı bulunamadı';
  end if;

  if not exists (
    select 1 from public.job_staff
    where job_id = p_job_id and staff_id = v_staff_id
  ) then
    raise exception 'Bu iş size atanmamış';
  end if;

  update public.jobs
  set notes = nullif(trim(p_notes), ''), updated_at = now()
  where id = p_job_id;

  return jsonb_build_object('ok', true, 'job_id', p_job_id);
end;
$$;

revoke all on function public.staff_update_job_notes(uuid,text) from public;
grant execute on function public.staff_update_job_notes(uuid,text) to authenticated;

notify pgrst, 'reload schema';
