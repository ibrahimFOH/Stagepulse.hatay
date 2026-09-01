begin;
insert into public.admin_capabilities(key,name,category,description,active)
values
('offers.pdf.generate','Teklif PDF oluştur','offers','Teklif PDFini üretme',true),
('offers.pdf.download','Teklif PDF indir','offers','Teklif PDFini indirme',true),
('offers.pdf.preview','Teklif PDF önizle','offers','Teklif PDFini önizleme',true),
('offers.pdf.visibility','Teklif PDF müşteri görünürlüğü','offers','PDFnin müşteriye gösterilmesini yönetme',true),
('offers.equipment','Teklife ekipman ekle','offers','Envanter ekipmanını teklife bağlama',true),
('offers.crew','Teklif personel sayısı','offers','Teklif personel sayısını yönetme',true),
('offers.attachments','Teklif fotoğrafları','offers','Teklife bağlı fotoğrafları yükleme ve yönetme',true)
on conflict(key) do update set active=true,name=excluded.name,category=excluded.category,description=excluded.description;
commit;
