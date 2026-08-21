-- StagePulse Staff Portal v2
-- Safe additive migration for the live staff permission architecture.
-- Does not drop or remove legacy columns/tables.
-- Production permission source: permission_catalog + staff_permissions.

create table if not exists public.permission_catalog (
  permission_key text primary key,
  label text not null,
  description text,
  category text not null default 'Genel',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.permission_catalog(permission_key) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

insert into public.permission_catalog
  (permission_key, label, description, category, sort_order)
values
  ('dashboard.view', 'Genel Bakış / Dashboard görüntüleme', 'Dashboard ve özet bilgilerini görüntüleme', 'Genel', 10),
  ('offers.view', 'Teklifleri görüntüleme', 'Teklif kayıtlarını görüntüleme', 'Teklifler', 20),
  ('offers.manage', 'Teklif oluşturma / düzenleme', 'Teklif oluşturma ve mevcut teklifleri düzenleme', 'Teklifler', 30),
  ('offers.delete', 'Teklif silme', 'Teklif kayıtlarını silme', 'Teklifler', 40),
  ('customers.view', 'Müşterileri görüntüleme', 'Müşteri kayıtlarını görüntüleme', 'Müşteriler', 50),
  ('customers.manage', 'Müşteri ekleme / düzenleme', 'Müşteri oluşturma ve düzenleme', 'Müşteriler', 60),
  ('customers.delete', 'Müşteri silme', 'Müşteri kayıtlarını silme', 'Müşteriler', 70),
  ('equipment.view', 'Ekipman listesini görüntüleme', 'Ekipman kayıtlarını görüntüleme', 'Ekipman', 80),
  ('equipment.manage', 'Ekipman ekleme / düzenleme', 'Ekipman oluşturma ve düzenleme', 'Ekipman', 90),
  ('equipment.delete', 'Ekipman silme', 'Ekipman kayıtlarını silme', 'Ekipman', 100),
  ('schedule.view', 'Takvim / İş programı görüntüleme', 'Takvim ve iş programını görüntüleme', 'İşler', 110),
  ('schedule.manage', 'Takvim / İş programı düzenleme', 'Takvim ve iş programında değişiklik yapma', 'İşler', 120),
  ('settlements.view', 'Gelir-Gider (Settlements) görüntüleme', 'Gelir-gider ve settlement kayıtlarını görüntüleme', 'Finans', 130),
  ('payments.view', 'Ödemeler / Finans görüntüleme', 'Ödeme ve finans bilgilerini görüntüleme', 'Finans', 140),
  ('pricing.view', 'Fiyatlandırma görüntüleme', 'Fiyatlandırma kayıtlarını görüntüleme', 'Fiyatlandırma', 150),
  ('pricing.manage', 'Fiyatlandırma düzenleme', 'Fiyatlandırma kayıtlarını düzenleme', 'Fiyatlandırma', 160),
  ('staff.view', 'Personel listesini görüntüleme', 'Personel listesini görüntüleme', 'Personel', 170),
  ('notifications.view', 'Bildirimleri görüntüleme', 'Sistem bildirimlerini görüntüleme', 'Genel', 180),
  ('activity_logs.view', 'Aktivite loglarını görüntüleme', 'Aktivite ve işlem kayıtlarını görüntüleme', 'Güvenlik', 190),
  ('analytics.view', 'Analitik / Raporları görüntüleme', 'Analitik ve raporları görüntüleme', 'Raporlar', 200),
  ('profile.manage', 'Ayarlar / Profil düzenleme', 'Kendi profil ve hesap ayarlarını düzenleme', 'Profil', 210),
  ('files.upload', 'Dosya yükleme', 'Portal üzerinden dosya yükleme', 'Dosyalar', 220),
  ('offers.approve', 'Teklif onaylama', 'Teklifleri onaylama veya reddetme', 'Teklifler', 230),
  ('notifications.send', 'WhatsApp / Bildirim gönderme', 'Yetkili bildirim kanallarından mesaj gönderme', 'Bildirimler', 240),
  ('jobs.manage', 'İş oluşturma / düzenleme', 'İş kayıtlarını oluşturma ve düzenleme', 'İşler', 250),
  ('jobs.delete', 'İş silme', 'İş kayıtlarını silme', 'İşler', 260),
  ('staff.manage', 'Personel yetkilerini yönetme', 'Personel hesaplarını ve yetkilerini yönetme', 'Personel', 270),
  ('activity_logs.export', 'Aktivite loglarını dışa aktarma', 'Aktivite kayıtlarını dışa aktarma', 'Güvenlik', 280)
on conflict (permission_key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  sort_order = excluded.sort_order,
  enabled = true;

create index if not exists idx_staff_permissions_user_id
  on public.staff_permissions(user_id);

create index if not exists idx_staff_permissions_key_enabled
  on public.staff_permissions(permission_key, enabled);

alter table public.permission_catalog enable row level security;
alter table public.staff_permissions enable row level security;

-- These policies are intentionally additive and use the existing admin helper.
-- If the live project exposes a different admin helper signature, apply the
-- equivalent policy through the existing production migration rather than
-- replacing the live helper.
drop policy if exists permission_catalog_authenticated_read on public.permission_catalog;
create policy permission_catalog_authenticated_read
  on public.permission_catalog
  for select
  to authenticated
  using (enabled = true);

drop policy if exists staff_permissions_self_read on public.staff_permissions;
create policy staff_permissions_self_read
  on public.staff_permissions
  for select
  to authenticated
  using (user_id = auth.uid());

-- Seed missing permission rows for existing active staff accounts.
insert into public.staff_permissions (user_id, permission_key, enabled)
select sp.user_id, pc.permission_key, false
from public.staff_profiles sp
cross join public.permission_catalog pc
where sp.active = true
on conflict (user_id, permission_key) do nothing;

comment on table public.permission_catalog is 'StagePulse canonical staff permission catalog. Additive v2 architecture.';
comment on table public.staff_permissions is 'StagePulse canonical per-user staff permissions. Source of truth for portal authorization.';
