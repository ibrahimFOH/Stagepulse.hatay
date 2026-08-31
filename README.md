# Stagepulse

**FOH Engineer • Ses Sistemi Kiralama • Teknik Mühendislik**

Profesyonel canlı etkinlik, konser, festival ve kurumsal organizasyonlar için Front of House (FOH) mühendisliği, ses/ışık kiralama, Stage Plot, SPL hesaplama ve 3D sahne çizimi hizmetleri.

**Canlı site:** https://stagepulse.com.tr  
**Geliştirici:** İbrahim Kavasoğlu

---

## Özellikler

- Tam responsive (mobil öncelikli) tasarım
- Türkçe / İngilizce i18n
- Otomatik medya yükleme sistemi
- KVKK uyumlu teklif formu + çerez onayı
- Formspree + WhatsApp yedek akışı
- Schema.org işaretlemeleri
- PWA desteği
- Güvenlik header'ları
- Google Analytics 4 + conversion event'leri
- Accessibility iyileştirmeleri

---

## Medya Ekleme

1. Fotoğraf → `images/gallery/` (JPG, PNG, WEBP, GIF)
2. Video → `videos/` (MP4, WEBM, MOV)
3. PDF → `documents/`

GitHub Actions veya `python generate_media_json.py` çalışınca `media.json` güncellenir.

---

## Yerel Geliştirme

```bash
python -m http.server 8080
# veya
npx serve .
```

Medya JSON'u:

```bash
python generate_media_json.py
```

---

## Deploy

Push to `main` = GitHub Pages + Cloudflare üzerinden otomatik yayın.

---

## CRM / Admin / Personel

- `/admin/` — yönetim paneli
- `/portal/` — personel portalı
- `/teklif-view.html?token=...` — müşteri teklif görüntüleme/yanıtlama
- `supabase/migrations/` — canlı veritabanının migration kaynağı
- `supabase/functions/` — production Edge Function kaynak kodunun tek gerçek kaynağı

### Veritabanı kaynağı

Production şemasının gerçek kaynağı sıralı `supabase/migrations/*.sql` zinciridir. Yeni veritabanı değişiklikleri migration olarak eklenmeli ve canlı Supabase ile birlikte ilerlemelidir.

### Admin / Portal RBAC kaynağı

Admin ve personel erişim sistemi tek canonical yapı kullanır:

- `org_memberships`
- `org_roles`
- `org_positions`
- `org_departments`
- `org_regions`
- `admin_capabilities`
- `admin_capability_grants`
- `org_panel_rules`

`permission_catalog`, `staff_permissions` ve legacy permission alias katmanı admin/portal yetkilendirmesinde kullanılmaz.

### Edge Function Source-of-Truth

Production Edge Function kaynak kodunun tek gerçek kaynağı `supabase/functions/` klasörüdür. Authentication, authorization veya business logic yeni olarak başka bir koda kopyalanmamalıdır.

### Güvenlik

- Admin/personel Edge Function girişlerinde güçlü parola politikası uygulanır.
- Login tarafında rate-limit bulunur.
- Admin ve portal erişimi Supabase Auth + organization/RBAC kontrolü üzerinden doğrulanır.
- Kritik işlemlerde yetki kontrolü server tarafında yapılır.
- Public müşteri teklif akışı admin/portal RBAC sisteminden bağımsızdır.

### CI

`.github/workflows/stagepulse-ci.yml` aktif CI kaynağıdır. JavaScript syntax, Edge Function type-check, güvenlik kontrolleri, migration bütünlüğü ve endpoint smoke testleri çalıştırır.

GitHub branch protection / required checks ayarı repository Settings üzerinden ayrıca zorunlu tutulabilir.

---

## Lisans

MIT License — detaylar için `LICENSE` dosyasına bakın.

© 2026 Stagepulse – İbrahim Kavasoğlu
