-- Single source of truth for all customer-facing minimum prices published on stagepulse.com.tr.
begin;
create table if not exists public.published_pricing (
 id uuid primary key default gen_random_uuid(),
 category text not null,
 item_name text not null,
 description text,
 minimum_price numeric(12,2) not null check (minimum_price >= 0),
 unit text not null default 'TL',
 source_path text not null,
 sort_order integer not null default 0,
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
create index if not exists idx_published_pricing_active_sort on public.published_pricing(active,sort_order);
alter table public.published_pricing enable row level security;
revoke all on public.published_pricing from anon;
grant select on public.published_pricing to authenticated;
drop policy if exists published_pricing_authenticated_read on public.published_pricing;
create policy published_pricing_authenticated_read on public.published_pricing for select to authenticated using (active=true);
delete from public.published_pricing;
insert into public.published_pricing(category,item_name,description,minimum_price,unit,source_path,sort_order) values
('Ses Sistemi Kiralama','Kompakt Ses Paketi','Küçük davet / butik etkinlik; aktif PA, mixer, mikrofonlar.',15000,'TL','ses-sistemi-kiralama.html',10),
('Ses Sistemi Kiralama','Standart Davet Ses Paketi','250-700 kişi; PA, sub, monitor, mixer ve temel teknik ekip.',25000,'TL','ses-sistemi-kiralama.html',20),
('Ses Sistemi Kiralama','Line Array Ses Paketi','Orta ölçek konser/açık hava; line array, sub, monitor ve dijital mixer.',45000,'TL','ses-sistemi-kiralama.html',30),
('Ses Sistemi Kiralama','Konser / Festival Ses Paketi','Geniş PA, sub grubu, monitor, FOH ve teknik ekip.',65000,'TL','ses-sistemi-kiralama.html',40),
('Ses Sistemi Kiralama','Tam Prodüksiyon','Ses + ışık + sahne + LED + teknik ekip; proje bazlı.',95000,'TL','ses-sistemi-kiralama.html',50),
('FOH Mühendisliği','FOH Engineer - Etkinlik Günü','Tek günlük canlı miks operasyonu.',7500,'TL','foh-muhendisligi.html',60),
('FOH Mühendisliği','FOH + Soundcheck','Soundcheck/prova + etkinlik operasyonu.',10000,'TL','foh-muhendisligi.html',70),
('FOH Mühendisliği','FOH + Monitor','FOH ve monitor/IEM operasyonu birlikte.',15000,'TL','foh-muhendisligi.html',80),
('FOH Mühendisliği','Uzun Gün / Festival','Uzun süreli veya çok sanatçılı operasyon.',12500,'TL','foh-muhendisligi.html',90),
('FOH Mühendisliği','Teknik Saha Sorumluluğu','Etkinlik günü saha koordinasyonu.',5000,'TL','foh-muhendisligi.html',100),
('Monitor & IEM','Wedge Monitor Paketi','2-4 adet wedge ve temel monitor routing.',5000,'TL','monitor-iem.html',110),
('Monitor & IEM','Geniş Monitor Paketi','6-8 adet wedge ve çoklu monitor bus.',10000,'TL','monitor-iem.html',120),
('Monitor & IEM','IEM Tek Sistem','1 kablosuz IEM sistemi.',3500,'TL','monitor-iem.html',130),
('Monitor & IEM','IEM 2 Sistem','2 kablosuz IEM sistemi ve routing.',6000,'TL','monitor-iem.html',140),
('Monitor & IEM','Monitor Mühendisi','Soundcheck + etkinlik boyunca monitor miks.',7500,'TL','monitor-iem.html',150),
('Sahne Işık & Truss','Temel Işık Paketi','Par/Wash + temel kontrol.',8500,'TL','sahne-isik-truss.html',160),
('Sahne Işık & Truss','Standart Işık Paketi','Moving Head/Wash + kontrol + temel kurulum.',18000,'TL','sahne-isik-truss.html',170),
('Sahne Işık & Truss','Beam + Wash + Strobe','8 Beam + 8 Wash + 2 Strobe + dijital kontrol.',28000,'TL','sahne-isik-truss.html',180),
('Sahne Işık & Truss','Işık + Truss Paketi','Işık sistemi + taşıyıcı truss + kurulum/söküm.',40000,'TL','sahne-isik-truss.html',190),
('Sahne Işık & Truss','Mini Platform','Küçük portatif sahne sınıfı.',12000,'TL','sahne-isik-truss.html',200),
('Sahne Işık & Truss','Orta Sahne / Platform','Yaklaşık 6x5 m sınıfı sahne + truss.',30000,'TL','sahne-isik-truss.html',210),
('Sahne Işık & Truss','Büyük Outdoor Sahne','Büyük sahne + truss + teknik ekip.',75000,'TL','sahne-isik-truss.html',220),
('Sahne Işık & Truss','Truss Ayrı Hizmet','Zemin/asma truss; statik ve kurulum kapsamına göre.',4500,'TL','sahne-isik-truss.html',230),
('LED & Görüntü','Rental LED P3.9 - Panel','Outdoor P3.9 sınıfında panel kullanım başlangıcı.',2250,'TL / m²','led-goruntu.html',240),
('LED & Görüntü','LED Kontrol / İşlemci','Sinyal yönetimi ve işlemci.',3500,'TL','led-goruntu.html',250),
('LED & Görüntü','LED Kurulum / Söküm','Panel montajı, kablolama ve temel test.',7500,'TL','led-goruntu.html',260),
('LED & Görüntü','LED Proje Paketi','LED + işlemci + yapı/kurulum + teknik ekip.',25000,'TL','led-goruntu.html',270),
('Network Audio & Dante','Dante Sistem Tasarımı','Kanal yapısı, network ve cihaz planlaması.',6000,'TL','network-audio-dante.html',280),
('Network Audio & Dante','Dante Kurulum / Konfigürasyon','Switch, IP, routing ve clock yapılandırması.',10000,'TL','network-audio-dante.html',290),
('Network Audio & Dante','Dijital Ses Entegrasyonu','Mixer/stagebox/ağ entegrasyonu.',12500,'TL','network-audio-dante.html',300),
('Network Audio & Dante','Dante Arıza / Teknik Destek','Saha teşhisi ve düzeltme.',4000,'TL','network-audio-dante.html',310),
('Kurulum, Tuning, Söküm & Teslim','Küçük Sistem Kurulum','Kompakt PA + mixer + mikrofonlar.',5000,'TL','kurulum-tuning-sokum.html',320),
('Kurulum, Tuning, Söküm & Teslim','Standart Sistem Kurulum','PA + sub + monitor + mixer + kablaj.',8000,'TL','kurulum-tuning-sokum.html',330),
('Kurulum, Tuning, Söküm & Teslim','Line Array Kurulum','Line array + sub + monitor + routing + tuning.',15000,'TL','kurulum-tuning-sokum.html',340),
('Kurulum, Tuning, Söküm & Teslim','Büyük Prodüksiyon Kurulum','Ses + ışık + LED + sahne + çoklu teknik ekip.',25000,'TL','kurulum-tuning-sokum.html',350),
('Kurulum, Tuning, Söküm & Teslim','Söküm / Teslim','Güvenli söküm, toplama ve teslim kontrolü.',6000,'TL','kurulum-tuning-sokum.html',360),
('Teknik Mühendislik','Teknik Mühendislik Hizmetleri - Başlangıç','Stage Plot, 3D sahne çizimi, SPL analizi, rider ve sistem mühendisliği.',3000,'TL','muhendislik.html',370),
('Teknik Mühendislik','Yerinde Teknik Keşif','Mekân, seyirci alanı, sahne ve kullanım senaryosu.',5000,'TL','muhendislik.html',380),
('Teknik Mühendislik','Akustik / SPL Ölçümü','Yerinde ölçüm ve mevcut koşulların analizi.',7500,'TL','muhendislik.html',390),
('Teknik Mühendislik','Sistem Mühendisliği','Ana PA, subbass, monitor ve kontrol sistemi.',8000,'TL','muhendislik.html',400),
('Teknik Mühendislik','SPL ve Kapsama Analizi','Hoparlör yerleşimi ve kapsama değerlendirmesi.',6000,'TL','muhendislik.html',410),
('Teknik Mühendislik','Sinyal Akışı ve Sistem Tasarımı','Mixer, DSP, DI, işlemci ve bağlantı planlaması.',4000,'TL','muhendislik.html',420),
('Teknik Mühendislik','Marka / Model Araştırması','Uygun ekipman ve alternatiflerin araştırılması.',3000,'TL','muhendislik.html',430),
('Teknik Mühendislik','Alternatif Sistem Karşılaştırması','Teknik ve fiyat karşılaştırması.',3000,'TL','muhendislik.html',440),
('Teknik Mühendislik','Mühendislik Raporu','Teknik rapor, sistem listesi ve sonuç raporu.',3500,'TL','muhendislik.html',450),
('Teknik Mühendislik','Revizyonlar','Müşteri taleplerine göre doküman revizyonları.',2000,'TL','muhendislik.html',460),
('Teknik Mühendislik','Uygulama Kontrolü','Kurulum sonrası projeye uygunluk ve yönlendirme.',3000,'TL','muhendislik.html',470),
('Teknik Mühendislik','Stage Plot','Sahne yerleşim planı.',4500,'TL','muhendislik.html',480),
('Teknik Mühendislik','3D Sahne Çizimi','3D sahne ve sistem görselleştirmesi.',7500,'TL','muhendislik.html',490),
('Teknik Mühendislik','Teknik Rider','Rider inceleme ve teknik çözüm dokümanı.',4000,'TL','muhendislik.html',500),
('Teknik Mühendislik','Sistem Tuning / Commissioning','Ölçüm, doğrulama ve teslim ayarları.',7500,'TL','muhendislik.html',510),
('Canlı Ses Mikseri Kullanım Eğitimi','Tek Eğitim Günü','Uygulamalı canlı ses mikseri kullanımı.',3500,'TL','mikser-egitimi.html',520),
('Canlı Ses Mikseri Kullanım Eğitimi','4 Günlük Paket','Temel kullanım + miks + seviye kontrolü.',12000,'TL','mikser-egitimi.html',530),
('Canlı Ses Mikseri Kullanım Eğitimi','8 Günlük Paket','Temel + ileri günlük kullanım + canlı uygulama.',24000,'TL','mikser-egitimi.html',540),
('Canlı Ses Mikseri Kullanım Eğitimi','12 Günlük / 1 Aylık Paket','Haftada 3 gün, yaklaşık 1 ay; 12 uygulamalı gün.',35000,'TL','mikser-egitimi.html',550);
commit;