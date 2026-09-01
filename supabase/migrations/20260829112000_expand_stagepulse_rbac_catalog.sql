begin;

-- Canonical admin/portal capability catalog.
insert into public.admin_capabilities (key, category, name, description, active)
values
  ('events.view','Etkinlikler','Etkinlikleri görüntüleme','Etkinlik kayıtlarını ve durumlarını görüntüleme',true),
  ('events.create','Etkinlikler','Etkinlik oluşturma','Yeni etkinlik oluşturma',true),
  ('events.update','Etkinlikler','Etkinlik düzenleme','Etkinlik bilgilerini ve zamanlarını düzenleme',true),
  ('events.delete','Etkinlikler','Etkinlik silme','Etkinlik kaydını silme',true),
  ('events.status.update','Etkinlikler','Etkinlik durumu güncelleme','Etkinlik durumunu değiştirme',true),
  ('resources.view','Kaynak Yönetimi','Kaynakları görüntüleme','Etkinlik kaynaklarını görüntüleme',true),
  ('resources.manage','Kaynak Yönetimi','Kaynak yönetimi','Personel, ekipman ve araç kaynaklarını yönetme',true),
  ('vehicles.view','Araçlar','Araçları görüntüleme','Araç listesini görüntüleme',true),
  ('vehicles.manage','Araçlar','Araç yönetimi','Araç oluşturma, düzenleme ve pasifleştirme',true),
  ('vehicle_assignments.manage','Araçlar','Araç görevlendirme','Araçları etkinlik ve personele atama',true),
  ('maintenance.view','Envanter','Bakım kayıtlarını görüntüleme','Ekipman bakım planlarını görüntüleme',true),
  ('maintenance.manage','Envanter','Bakım yönetimi','Bakım planı ve bakım durumlarını yönetme',true),
  ('inventory.view','Envanter','Envanteri görüntüleme','Depo ve ekipman envanterini görüntüleme',true),
  ('inventory.manage','Envanter','Envanteri yönetme','Envanter hareketleri ve stok durumlarını yönetme',true),
  ('departments.view','Organizasyon','Departmanları görüntüleme','Departman yapısını görüntüleme',true),
  ('departments.manage','Organizasyon','Departman yönetimi','Departman oluşturma, düzenleme ve pasifleştirme',true),
  ('staff.skills.manage','Personel','Personel becerilerini yönetme','Personel beceri ve yeterliliklerini yönetme',true),
  ('staff.training.manage','Personel','Personel eğitimlerini yönetme','Eğitim ve sertifika kayıtlarını yönetme',true),
  ('staff.availability.manage','Personel','Personel uygunluğunu yönetme','Müsaitlik ve çalışma durumlarını yönetme',true),
  ('approvals.view','Onaylar','Onay taleplerini görüntüleme','Bekleyen ve geçmiş onay taleplerini görüntüleme',true),
  ('approvals.manage','Onaylar','Onay taleplerini yönetme','Onaylama, reddetme ve yürütme işlemlerini yönetme',true),
  ('ai.view','Yapay Zeka','Yapay zeka işlemlerini görüntüleme','AI ajanları ve çalışma kayıtlarını görüntüleme',true),
  ('ai.approve','Yapay Zeka','Yapay zeka işlemlerini onaylama','AI tarafından önerilen işlemleri onaylama',true),
  ('ai.execute','Yapay Zeka','Yapay zeka işlemlerini çalıştırma','Yetkili AI işlemlerinin yürütülmesine izin verme',true),
  ('automation.view','Otomasyon','Otomasyonları görüntüleme','Otomasyon kurallarını ve çalışma kayıtlarını görüntüleme',true),
  ('automation.manage','Otomasyon','Otomasyon yönetimi','Otomasyon kurallarını oluşturma ve düzenleme',true),
  ('documents.manage','Dosyalar','Doküman yönetimi','Dosya ve dokümanları oluşturma, düzenleme ve silme',true),
  ('suppliers.view','Tedarikçiler','Tedarikçileri görüntüleme','Tedarikçi kayıtlarını görüntüleme',true),
  ('suppliers.manage','Tedarikçiler','Tedarikçi yönetimi','Tedarikçi oluşturma, düzenleme ve pasifleştirme',true),
  ('contracts.view','Sözleşmeler','Sözleşmeleri görüntüleme','Sözleşme kayıtlarını görüntüleme',true),
  ('contracts.manage','Sözleşmeler','Sözleşme yönetimi','Sözleşme oluşturma, düzenleme ve durum yönetimi',true),
  ('risks.view','Risk Yönetimi','Riskleri görüntüleme','Operasyon ve işletme risklerini görüntüleme',true),
  ('risks.manage','Risk Yönetimi','Risk yönetimi','Risk oluşturma, azaltma ve kapatma',true),
  ('decisions.view','Yönetim','Karar kayıtlarını görüntüleme','Yönetim karar geçmişini görüntüleme',true),
  ('decisions.manage','Yönetim','Karar kayıtlarını yönetme','Yönetim kararlarını oluşturma ve düzenleme',true),
  ('executive.view','Yönetim','Yönetim merkezini görüntüleme','Yönetici KPI, hedef ve strateji ekranlarını görüntüleme',true),
  ('executive.manage','Yönetim','Yönetim merkezini yönetme','KPI, hedef ve stratejik girişimleri yönetme',true),
  ('marketing.view','Pazarlama','Pazarlama kayıtlarını görüntüleme','Pazarlama kampanyalarını görüntüleme',true),
  ('marketing.manage','Pazarlama','Pazarlama yönetimi','Pazarlama kampanyalarını oluşturma ve düzenleme',true),
  ('notifications.manage','Bildirimler','Bildirim ayarlarını yönetme','Bildirim tercihleri ve sistem bildirimlerini yönetme',true)
on conflict (key) do update set
  category=excluded.category,
  name=excluded.name,
  description=excluded.description,
  active=true;

commit;
