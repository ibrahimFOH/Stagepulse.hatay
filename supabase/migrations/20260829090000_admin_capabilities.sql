-- Stagepulse Admin capabilities
-- Admin access remains governed by private.is_admin(); these capabilities provide
-- explicit, auditable admin actions without changing the existing staff RBAC.

create table if not exists public.admin_capabilities (
  key text primary key,
  name text not null,
  category text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_capabilities enable row level security;

drop policy if exists admin_capabilities_admin_all on public.admin_capabilities;
create policy admin_capabilities_admin_all
on public.admin_capabilities
for all
using (private.is_admin())
with check (private.is_admin());

insert into public.admin_capabilities (key,name,category,description) values
('system.settings.manage','Sistem ayarlarını yönet','Sistem','Sistem ayarlarını değiştirme'),
('system.config.manage','Sistem yapılandırmasını yönet','Sistem','Sistem yapılandırmasını değiştirme'),
('system.maintenance.manage','Bakım modunu aç/kapat','Sistem','Bakım modunu yönetme'),
('system.status.view','Sistem durumunu görüntüle','Sistem','Sistem sağlık ve durum bilgilerini görüntüleme'),
('system.errors.view','Sistem hatalarını görüntüle','Sistem','Sistem hata kayıtlarını görüntüleme'),
('admin.accounts.manage','Admin hesaplarını yönet','Kullanıcı ve Güvenlik','Admin hesaplarını yönetme'),
('staff.accounts.manage','Personel hesaplarını yönet','Kullanıcı ve Güvenlik','Personel hesaplarını yönetme'),
('roles.manage','Rolleri yönet','Kullanıcı ve Güvenlik','Roller oluşturma, düzenleme ve silme'),
('permission.groups.manage','Yetki gruplarını yönet','Kullanıcı ve Güvenlik','Yetki gruplarını yönetme'),
('sessions.view','Kullanıcı oturumlarını görüntüle','Kullanıcı ve Güvenlik','Aktif kullanıcı oturumlarını görüntüleme'),
('sessions.terminate','Kullanıcı oturumunu sonlandır','Kullanıcı ve Güvenlik','Kullanıcı oturumlarını sonlandırma'),
('security.settings.manage','Güvenlik ayarlarını yönet','Kullanıcı ve Güvenlik','Güvenlik ayarlarını yönetme'),
('audit.view','Audit kayıtlarını görüntüle','Kullanıcı ve Güvenlik','Denetim kayıtlarını görüntüleme'),
('data.export','Veri dışa aktar','Veri','Sistem verilerini dışa aktarma'),
('data.import','Veri içe aktar','Veri','Sistem verilerini içe aktarma'),
('backup.manage','Yedekleme yönet','Veri','Yedekleme işlemlerini yönetme'),
('restore.manage','Geri yükleme yönet','Veri','Yedekten geri yükleme işlemlerini yönetme'),
('data.bulk.manage','Toplu veri işlemlerini yönet','Veri','Toplu veri işlemlerini yönetme'),
('site.content.manage','Site içeriğini yönet','Site','Site içeriklerini yönetme'),
('site.seo.manage','SEO ayarlarını yönet','Site','SEO ayarlarını yönetme'),
('site.publish.manage','Site yayın ayarlarını yönet','Site','Yayınlama ayarlarını yönetme'),
('site.menu.manage','Menüleri yönet','Site','Site menülerini yönetme'),
('site.home.manage','Ana sayfa içeriklerini yönet','Site','Ana sayfa içeriklerini yönetme'),
('ai.settings.manage','AI ayarlarını yönet','AI','AI yapılandırmasını yönetme'),
('ai.usage.manage','AI kullanımını yönet','AI','AI kullanımını yönetme'),
('ai.limits.manage','AI limitlerini yönet','AI','AI kullanım limitlerini yönetme'),
('ai.approvals.manage','AI işlemlerini onayla','AI','AI işlemlerini onaylama'),
('ai.automation.manage','AI otomasyonlarını yönet','AI','AI otomasyonlarını yönetme'),
('integrations.manage','Entegrasyonları yönet','Entegrasyon','Harici entegrasyonları yönetme'),
('api.manage','API bağlantılarını yönet','Entegrasyon','API bağlantılarını yönetme'),
('webhooks.manage','Webhookları yönet','Entegrasyon','Webhook yapılandırmalarını yönetme'),
('external_services.manage','Harici servisleri yönet','Entegrasyon','Harici servis bağlantılarını yönetme'),
('jobs.manage','Tüm işleri yönet','Operasyon','Tüm iş kayıtlarını yönetme'),
('events.manage','Tüm etkinlikleri yönet','Operasyon','Tüm etkinlik kayıtlarını yönetme'),
('equipment.manage','Tüm ekipmanları yönet','Operasyon','Tüm ekipman kayıtlarını yönetme'),
('staff.manage','Tüm personeli yönet','Operasyon','Tüm personel kayıtlarını yönetme'),
('customers.manage','Tüm müşterileri yönet','Operasyon','Tüm müşteri kayıtlarını yönetme'),
('finance.manage','Tüm finans kayıtlarını yönet','Operasyon','Finans kayıtlarını yönetme'),
('files.manage','Tüm dosyaları yönet','Operasyon','Dosya ve medya kayıtlarını yönetme'),
('reports.manage','Tüm raporları yönet','Yönetim','Tüm raporları yönetme'),
('kpi.manage','KPI yönetimi','Yönetim','KPI tanımlarını ve sonuçlarını yönetme'),
('management.reports.manage','Yönetim raporlarını yönet','Yönetim','Yönetim raporlarını yönetme'),
('decisions.manage','Karar kayıtlarını yönet','Yönetim','Yönetim karar kayıtlarını yönetme'),
('risk.manage','Risk yönetimi','Yönetim','Risk kayıtlarını yönetme'),
('organization.manage','Organizasyon yapısını yönet','Yönetim','Organizasyon yapısını yönetme')
on conflict (key) do update set name=excluded.name, category=excluded.category, description=excluded.description, active=true;

comment on table public.admin_capabilities is 'Explicit Admin capability catalog. Full Admin access remains protected by private.is_admin().';
