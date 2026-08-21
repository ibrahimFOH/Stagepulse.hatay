# Stagepulse

**FOH Engineer • Ses Sistemi Kiralama • Teknik Mühendislik**

Profesyonel canlı etkinlik, konser, festival ve kurumsal organizasyonlar için Front of House (FOH) mühendisliği, ses/ışık kiralama, Stage Plot, SPL hesaplama ve 3D sahne çizimi hizmetleri.

**Canlı site:** https://stagepulse.com.tr  
**Geliştirici:** İbrahim Kavasoğlu

---

## Özellikler

- Tam responsive (mobil öncelikli) tasarım
- Türkçe / İngilizce i18n (dil tercihi kaydedilir)
- Otomatik medya yükleme sistemi
- KVKK uyumlu teklif formu + çerez onayı
- Formspree entegrasyonu + WhatsApp yedek
- Schema.org (ProfessionalService + LocalBusiness)
- PWA desteği (manifest + service worker)
- Güvenlik header'ları
- Google Analytics 4 + conversion event'leri
- Accessibility iyileştirmeleri

## Medya Ekleme

1. Fotoğraf → `images/gallery/`
2. Video → `videos/`
3. PDF → `documents/`

GitHub Actions veya `python generate_media_json.py` çalışınca `media.json` otomatik güncellenir.

## Yerel Geliştirme

```bash
python -m http.server 8080
# veya
npx serve .
```

## Deploy

Push to `main` = GitHub Pages + Cloudflare üzerinden otomatik yayın.

CNAME: `stagepulse.com.tr`

## Stagepulse CRM / Admin Sistemi

- `/admin/` — yönetici paneli
- `/portal/` — personel portalı; canlı `staff_permissions` yetkilerine göre dinamik erişim
- `/teklif-view.html?token=...` — müşteriye özel teklif görüntüleme/onay
- `supabase/schema.sql`, `supabase/staff-portal.sql`, `supabase/staff-portal-v2.sql`, `supabase/finance-settlements.sql` — CRM, personel yetkileri, fiyatlandırma, ekipman, finans ve iş şemaları
- `supabase/functions/admin-login` — admin girişi
- `supabase/functions/staff-login` — personel giriş uyumluluk endpoint'i
- `supabase/functions/staff-session` — personel oturum ve canlı yetki kaynağı
- `supabase/functions/staff-manage` — admin tarafından personel yönetimi
- `supabase/functions/admin-password-reset` — yetkili admin şifre işlemleri

### Edge Function Source-of-Truth

**Production Edge Function kaynak kodunun tek gerçek kaynağı `supabase/functions/` klasörüdür.**

Kök dizindeki `functions/` klasörü **silinmemiştir**. Geriye dönük uyumluluk, inceleme ve rollback amacıyla korunur ve `functions/DEPRECATED.md` ile işaretlenmiştir. Altındaki mevcut `DEPRECATED.md` dosyaları da aynı kuralı belirtir. Yeni Edge Function veya authorization/business logic bu eski ağaca eklenmemelidir.

### Personel Yetki Sistemi

Yetkiler `public.permission_catalog` + `public.staff_permissions` üzerinden yönetilir. Admin panelindeki personel yetkileri bağımsız toggle'lar olarak saklanır; Portal menüleri ve erişim kontrolleri canlı permission durumuna göre değerlendirilir. Mevcut permission kayıtları silinmez veya varsayılan istemci yetkileriyle genişletilmez.

### Güvenlik / Uyumluluk Notları

- CORS kuralları production origin'leri ile sınırlandırılmıştır.
- Admin/personel şifre politikaları backend ve arayüzde tutarlıdır.
- Login rate-limit katmanı mevcuttur; dağıtık WAF/rate-limit için Cloudflare/Supabase seviyesi ayrıca değerlendirilebilir.
- Müşteri teklif erişimi token tabanlı RPC'ler üzerinden korunur.
- `supabase/staff-portal-v2.sql` additive/uyumluluk migration'ıdır; mevcut tabloları veya yetki seçimlerini silmez.

### CI / Branch Protection

`.github/workflows/critical-ci.yml` kritik JavaScript ve Edge Function kontrollerini tanımlar. GitHub repository **main branch protection / required checks** ayarları repository yönetim ekranından ayrıca doğrulanmalıdır; bu ayar kod deposundan güvenilir şekilde garanti edilmez.

### Sonraki Adımlar — P1/P2

Aşağıdakiler bu sertleştirme turunda özellikle değiştirilmemiştir:

- Supabase Security Advisor bulgularının tamamının ayrı incelemesi
- Teklif entegrasyonu uçtan uca doğrulaması
- 5+ personel eşzamanlı/ardışık oluşturma ve yetki testi
- Main branch protection'ın GitHub ayarlarından zorunlu hale getirilmesi

---

## Lisans

MIT License – detaylar için `LICENSE` dosyasına bakın.

© 2026 Stagepulse – İbrahim Kavasoğlu
