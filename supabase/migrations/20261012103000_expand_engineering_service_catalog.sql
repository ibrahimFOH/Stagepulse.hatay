-- Make all engineering items from the Stagepulse service/quote documents available in the service catalog.
insert into public.services(name,sort_order) values
('Yerinde Teknik Keşif',9),
('Akustik / SPL Ölçümü',10),
('Sistem Mühendisliği',11),
('SPL ve Kapsama Analizi',12),
('Sinyal Akışı ve Sistem Tasarımı',13),
('Marka / Model Araştırması',14),
('Alternatif Sistem Karşılaştırması',15),
('Mühendislik Raporu',16),
('Revizyonlar',17),
('Uygulama Kontrolü',18),
('Sistem Tuning / Commissioning',19),
('Canlı Ses Mikseri Kullanım Eğitimi',20),
('Diğer / Özel Hizmet',99)
on conflict (name) do nothing;
