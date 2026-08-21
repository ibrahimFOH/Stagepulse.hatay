# Stagepulse

**FOH Engineer • Ses Sistemi Kiralama • Teknik Mühendislik**

Profesyonel canlı etkinlik, konser, festival ve kurumsal organizasyonlar için  
Front of House (FOH) mühendisliği, ses/ışık kiralama, Stage Plot, SPL hesaplama ve 3D sahne çizimi hizmetleri.

**Canlı site:** https://stagepulse.com.tr  
**Geliştirici:** İbrahim Kavasoğlu

---

## Özellikler

- Tam responsive (mobil öncelikli) tasarım
- Türkçe / İngilizce i18n (dil tercihi kaydedilir)
- Otomatik medya yükleme sistemi (klasöre dosya at → kod değişmeden gallery / video / dokümanlar güncellenir)
- KVKK uyumlu teklif formu + çerez onayı
- Formspree entegrasyonu (kayıt + e-posta) + WhatsApp yedek
- Schema.org (ProfessionalService + LocalBusiness)
- PWA desteği (manifest + service worker)
- Üst düzey güvenlik header’ları (Cloudflare üzerinden)
- Google Analytics 4 + conversion event’leri
- Accessibility iyileştirmeleri (ARIA, focus-visible, klavye navigasyonu)

---

## Medya Ekleme (Kod Değiştirmeden)

1. Fotoğraf → `images/gallery/` klasörüne at (JPG, PNG, WEBP, GIF)
2. Video → `videos/` klasörüne at (MP4, WEBM, MOV)
3. PDF doküman → `documents/` klasörüne at

GitHub Actions veya `python generate_media_json.py` çalışınca `media.json` otomatik güncellenir.  
Site bir sonraki yüklemede yeni dosyaları gösterir.

---

## Formspree Kurulumu

1. https://formspree.io adresinden ücretsiz hesap aç
2. Yeni form oluştur → endpoint’i kopyala (`https://formspree.io/f/xxxxxx`)
3. `script.js` içinde `FORMSPREE_ENDPOINT` sabitini kendi endpoint’inle değiştir
4. Formspree ayarlarından e-posta bildirimini aç

Form hem Formspree’ye kaydeder hem de WhatsApp’a yönlendirir.

---

## Yerel Geliştirme

```bash
# Basit static server
python -m http.server 8080
# veya
npx serve .
```

Medya JSON’u güncellemek için:

```bash
python generate_media_json.py
```

---

## Deploy

Push to `main` = GitHub Pages + Cloudflare üzerinden otomatik yayın.

CNAME dosyası `stagepulse.com.tr` olarak ayarlıdır.

---

## Lisans

MIT License – detaylar için `LICENSE` dosyasına bakın.

---

© 2026 Stagepulse – İbrahim Kavasoğlu

---

## Temiz Kurulum / Zip Yükleme Notları (2026-08)

Bu paket, önceki sorunlar giderilmiş temiz sürümdür:

- **Service Worker (sw.js v3)**: Network-first stratejisi → site çökmesi / eski cache / sürekli history silme sorunu çözüldü.
- **Teklif formu**: Tüm alanlar (isim, telefon, paket, lokasyon/şehir, katılımcı sayısı, etkinlik tarihi, mesaj, KVKK) zorunlu. Boş gönderilemez. Kırmızı * işaretleri + JS + HTML5 required.
- **Google Analytics**: Consent Mode v2 uyumlu (teklif sayfasında tam, diğerlerinde banner ile güncellenir).
- **Cookie banner**: localStorage ile yönetilir, gereksiz çerez birikimi azaltıldı.
- **PWA**: manifest.webmanifest + SW eklendi.
- **CNAME**: stagepulse.com.tr hazır.
- Eski placeholder dosyalar (hakkimizda.html, iletisim.html, auto-gallery.js) temizlendi.

### Yükleme adımları

1. GitHub repo’sunu tamamen sil veya boşalt.
2. Bu zip’i aç → tüm dosyaları repo root’una yükle (File upload veya git push).
3. Cloudflare / GitHub Pages’in deploy olmasını bekle.
4. **Önemli**: Tarayıcıda bir kere **Hard Refresh** (Ctrl+Shift+R) veya site verilerini temizle (Application → Clear storage). Eski SW cache’i temizlensin.
5. Test: teklif formunda lokasyon / kişi / tarih boş bırakıp gönder → engellenmeli.
6. Supabase tablosu `teklifler` mevcut ve anon key doğru olmalı (script.js içinde).

Medya için: images/gallery/, documents/, videos/ klasörlerini kendi dosyalarınla doldur, sonra `python generate_media_json.py` çalıştır.



## Stagepulse CRM / Admin Sistemi

Yönetim sistemi:
- `/admin/` — tek yetkili admin paneli
- `/portal/` — personel portalı (mali alanlar görünmez, yetki bazlı menü)
- `/teklif-view.html?token=...` — müşteriye özel teklif görüntüleme/onay
- `supabase/schema.sql`, `supabase/staff-portal.sql`, `supabase/finance-settlements.sql` — CRM, fiyatlandırma, ekipman, finans, işler, bildirim ve aktivite şeması
- `supabase/functions/admin-login` — username + password ile güvenli admin girişi
- `supabase/functions/staff-login` — personel girişi
- `supabase/functions/staff-manage` — admin tarafından personel oluşturma/güncelleme/silme
- `supabase/functions/admin-password-reset` — yalnızca yetkili admin için hesap güncelleme

### Edge Function Source-of-Truth

**Production Edge Function kaynak kodunun tek gerçek kaynağı `supabase/functions/` klasörüdür.**

Kök dizindeki `functions/` klasörü **silinmemiştir**. Geriye dönük uyumluluk, inceleme ve rollback amacıyla korunur ve `functions/DEPRECATED.md` ile işaretlenmiştir. Mevcut alt klasörlerdeki `DEPRECATED.md` dosyaları da aynı kurala işaret eder. Yeni Edge Function, authentication, authorization veya business logic bu eski ağaca eklenmemelidir.

> **Not (2026-08 güvenlik güncellemesi):** Edge Function kaynak kodları production için yalnızca `supabase/functions/` altında tutulur. Kök `/functions/` ağacı bilerek korunur; silinmemiştir.

### Güvenlik sertleştirmeleri

- **CORS**: Edge Function'lar yalnızca production origin'leri ve geliştirme origin'lerinden gelen isteklere izin verir.
- **Şifre politikası**: Personel ve admin şifreleri en az **10 karakter** olmalı ve en az bir harf + bir rakam içermelidir.
- **Rate limit**: Login Edge Function'larında temel bellek-içi rate limit mevcuttur. Kalıcı/dağıtık koruma için Cloudflare veya Supabase seviyesinde ek rate-limit/WAF kuralı ayrıca değerlendirilebilir.
- **RLS / view**: `public_quotes` view'ına anon/authenticated doğrudan SELECT erişimi kaldırılmıştır; müşteri teklif görüntüleme/yanıtlama token kontrollü RPC'ler üzerinden yapılır.
- **Personel yetkileri**: `public.permission_catalog` + `public.staff_permissions` canlı yetki kaynağıdır. Portal tarafında client-side varsayılan yetki verilmez; eksik permission erişimi reddedilir.
- **Additive migration**: `supabase/staff-portal-v2.sql` mevcut yapıyı bozmadan canonical permission tablolarını ve eksik permission anahtarlarını tamamlamak için hazırlanmıştır.

### CI / Branch Protection

`.github/workflows/critical-ci.yml` kritik JavaScript sözdizimi, Edge Function ve permission source kontrollerini içerir. **GitHub main branch protection / required checks ayarı ayrıca repository Settings üzerinden manuel doğrulanmalıdır.** Bu ayar kod dosyalarından tek başına garanti edilemez.

### Sonraki Adımlar — P1/P2

Bu turda özellikle ayrı bırakılan kontroller:

- Supabase Security Advisor bulgularının tam incelemesi
- Teklif entegrasyonunun uçtan uca doğrulanması
- 5+ personel oluşturma / düzenleme / yetki değişikliği testi
- GitHub main branch protection'ın required CI check olarak zorunlu hale getirilmesi
