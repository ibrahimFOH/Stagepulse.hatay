-- StagePulse Staff Portal v2
-- SAFE / ADDITIVE MIGRATION
-- Production permission source: public.permission_catalog + public.staff_permissions.
-- IMPORTANT: Existing tables/columns and legacy permissions are preserved.
-- This migration does NOT drop, rename, or delete anything.
-- It is intentionally aligned with the LIVE schema used by staff-manage:
-- permission_catalog.key / active and staff_permissions.permission_key / enabled.

-- Create the canonical tables only if they do not already exist.
-- On the current production schema these statements are no-ops.
create table if not exists public.permission_catalog (
  key text primary key,
  category text not null default 'Genel',
  label text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.permission_catalog(key) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

-- Keep the existing catalog intact and add only missing capabilities.
-- Existing keys are deliberately not renamed or overwritten.
insert into public.permission_catalog (key, category, label, description, sort_order, active)
values
  ('dashboard_view', 'dashboard', 'Genel Bakış / Dashboard görüntüleme', 'Dashboard ve özet bilgilerini görüntüleme', 10, true),
  ('offers_view', 'offers', 'Teklifleri görüntüleme', 'Teklif kayıtlarını görüntüleme', 20, true),
  ('offers_manage', 'offers', 'Teklif oluşturma / düzenleme', 'Teklif oluşturma ve mevcut teklifleri düzenleme', 21, true),
  ('offers_delete', 'offers', 'Teklif silme', 'Teklif kayıtlarını silme', 4, true),
  ('customers_view', 'customers', 'Müşterileri görüntüleme', 'Müşteri kayıtlarını görüntüleme', 30, true),
  ('customers_manage', 'customers', 'Müşteri ekleme / düzenleme', 'Müşteri oluşturma ve düzenleme', 31, true),
  ('customers_delete', 'customers', 'Müşteri silme', 'Müşteri kayıtlarını silme', 7, true),
  ('equipment_view', 'equipment', 'Ekipman listesini görüntüleme', 'Ekipman kayıtlarını görüntüleme', 40, true),
  ('equipment_manage', 'equipment', 'Ekipman ekleme / düzenleme', 'Ekipman oluşturma ve düzenleme', 41, true),
  ('equipment_delete', 'equipment', 'Ekipman silme', 'Ekipman kayıtlarını silme', 10, true),
  ('calendar_view', 'calendar', 'Takvim / İş programı görüntüleme', 'Takvim ve iş programını görüntüleme', 11, true),
  ('calendar_edit', 'calendar', 'Takvim / İş programı düzenleme', 'Takvim ve iş programında değişiklik yapma', 12, true),
  ('settlements_view', 'finance', 'Gelir-Gider (Settlements) görüntüleme', 'Gelir-gider ve settlement kayıtlarını görüntüleme', 13, true),
  ('finance_view', 'finance', 'Ödemeler / Finans görüntüleme', 'Ödeme ve finans bilgilerini görüntüleme', 80, true),
  ('pricing_view', 'pricing', 'Fiyatlandırma görüntüleme', 'Fiyatlandırma kayıtlarını görüntüleme', 90, true),
  ('pricing_manage', 'pricing', 'Fiyatlandırma düzenleme', 'Fiyatlandırma kayıtlarını düzenleme', 16, true),
  ('personnel_view', 'personnel', 'Personel listesini görüntüleme', 'Personel listesini görüntüleme', 17, true),
  ('notifications_view', 'settings', 'Bildirimleri görüntüleme', 'Sistem bildirimlerini görüntüleme', 111, true),
  ('activity_view', 'reports', 'Aktivite loglarını görüntüleme', 'Aktivite ve işlem kayıtlarını görüntüleme', 102, true),
  ('analytics_view', 'reports', 'Analitik / Raporları görüntüleme', 'Analitik ve raporları görüntüleme', 101, true),
  ('settings_manage', 'settings', 'Ayarlar / Profil düzenleme', 'Profil ve hesap ayarlarını düzenleme', 110, true),
  ('file_upload', 'operations', 'Dosya yükleme', 'Portal üzerinden dosya yükleme', 31, true),
  ('offer_approve', 'offers', 'Teklif onaylama', 'Teklifleri onaylama', 33, true),
  ('whatsapp_send', 'communication', 'WhatsApp bildirim gönderme', 'Yetkili bildirim kanallarından mesaj gönderme', 32, true),
  ('personnel_manage', 'personnel', 'Personel yönetme', 'Personel hesaplarını ve yetkilerini yönetme', 71, true),
  ('activity_export', 'reports', 'Aktivite loglarını dışa aktarma', 'Aktivite kayıtlarını dışa aktarma', 103, true),
  ('offers_export', 'offers', 'Teklifleri dışa aktarma', 'Teklif kayıtlarını dışa aktarma', 34, true),
  ('customers_export', 'customers', 'Müşterileri dışa aktarma', 'Müşteri kayıtlarını dışa aktarma', 35, true)
on conflict (key) do nothing;

-- Make the canonical per-user permission table available to the API/index planner.
create index if not exists idx_staff_permissions_user_id
  on public.staff_permissions(user_id);

create index if not exists idx_staff_permissions_key_enabled
  on public.staff_permissions(permission_key, enabled);

-- Keep RLS enabled. Existing production policies are intentionally preserved.
alter table public.permission_catalog enable row level security;
alter table public.staff_permissions enable row level security;

-- Seed only missing permission rows for existing ACTIVE staff accounts.
-- Existing enabled/disabled choices are never overwritten.
insert into public.staff_permissions (user_id, permission_key, enabled)
select sp.user_id, pc.key, false
from public.staff_profiles sp
cross join public.permission_catalog pc
where sp.active = true
  and pc.active = true
on conflict (user_id, permission_key) do nothing;

comment on table public.permission_catalog is
  'StagePulse canonical staff permission catalog. Existing keys are preserved; v2 migration is additive.';

comment on table public.staff_permissions is
  'StagePulse canonical per-user staff permissions. Source of truth for portal authorization.';
