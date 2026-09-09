# Stagepulse Command Center

## Amaç
Mevcut Stagepulse teklif, iş, personel, bildirim, APK ve site akışlarını değiştirmeden bunların üzerine gelişmiş bir yönetim ve operasyon katmanı eklemek.

## Ana hiyerarşi
- Patron / Seviye 0
- Yönetim: Admin, Finans, Operasyon
- Personel: Ses, Işık, Sahne, FOH, Monitör, Teknisyen, Şoför, Diğer
- Ekipman
- İşler
- Etkinlikler

## Korunan yollar
- Teklif alma ve mevcut teklif kayıtları
- Teklif -> iş akışı
- Admin ve personel girişleri
- Mevcut personel yetkileri
- FCM bildirim sistemi
- Android cihaz kayıtları
- APK sürüm/güncelleme altyapısı
- Mevcut site ve müşteri tasarımı
- Mevcut Supabase tabloları ve RPC'ler

## Merkezi veri zinciri
Müşteri -> Teklif -> İş -> Etkinlik -> Personel/Ekipman/Görev/Araç/Nakliye/Depo -> Finans -> Onay.

`event_projects` etkinliğin merkezi kaydıdır (Event DNA). `event_tasks` görevleri, `event_resources` personel/ekipman/araç/dış kaynakları, `event_checklists` operasyon aşamalarını, `event_risks` riskleri ve `event_financials` tahmini/gerçek finansı bağlar.

Personel için `staff_skill_catalog`, `staff_skills`, `staff_availability` kullanılır. Ekipman için sınıf/alt sınıf, depo konumu ve hareket geçmişi; araç için sürücü ve etkinlik ataması tutulur.

## Yönetim bağlamları
Komuta Merkezi şu bağlamları canlı veriden okumalıdır: Genel Bakış, Müşteriler, Teklifler, İşler, Etkinlikler, Personel, Ekipman, Görevler, Depo, Araç/Nakliye, Finans, Tedarikçiler, Sözleşmeler, Pazarlama, Eğitim/Bakım, Riskler, Hedefler, Stratejik Girişimler ve Onay.

## Otomasyon
`automation_rules` olay/zaman tabanlı kuralları, `automation_runs` gerçekleşen çalışmaları tutar. Aktif kurallar Komuta Merkezi'nden izlenebilir.

## Profesyonel AV ana sınıfları
Audio, Lighting, Video, Stage, Rigging, Power, Control, Cables, Cases, Tools, Vehicles, Safety.

## Web ve APK
Komuta Merkezi web yönetim panelinde kullanılabilir olmalı; aynı veri modeli APK tarafından da kullanılacaktır. Web tarafında veri kaynağı ve yetki modeli tamamlanmadan APK için ayrı bir veri modeli oluşturulmaz.

## Geri alma
GitHub'da `backup/pre-command-center-20260829` dalı korunur. Veritabanı tarafındaki ters işlem SQL'i `supabase/rollback/stagepulse_command_center_foundation_down.sql` dosyasındadır; otomatik migration değildir.
