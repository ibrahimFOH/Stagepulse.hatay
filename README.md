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

> **Not (2026-08 güvenlik güncellemesi):** Edge Function kaynak kodları artık **sadece**
> `supabase/functions/` altında tutulur; kök dizindeki eski/çakışan `/functions/` klasörü
> ve `.github/workflows/admin/` içindeki güncel olmayan admin panel kopyası silindi.
> Aşağıdaki güvenlik sertleştirmeleri uygulandı:
>
> - **CORS**: Edge Function'lar artık yalnızca `https://stagepulse.com.tr`,
>   `https://www.stagepulse.com.tr` (ve geliştirme için `localhost:5173` /
>   `127.0.0.1:5173`) origin'lerinden gelen isteklere izin verir.
> - **Şifre politikası**: Personel ve admin şifreleri en az **10 karakter** olmalı ve
>   en az bir harf + bir rakam içermelidir (admin/staff panel formları ve backend
>   Edge Function'ları aynı kuralı uygular).
> - **Rate limit**: Login Edge Function'larında basit bellek-içi rate limit (aynı IP'den
>   dakikada 10 denemeden fazlasını engeller). Kalıcı/dağıtık bir çözüm için Cloudflare
>   veya Supabase seviyesinde ek bir rate-limit/WAF kuralı önerilir.
> - **RLS / view**: `public_quotes` view'ına anon/authenticated doğrudan SELECT
>   erişimi kaldırıldı; müşteri teklif görüntüleme/yanıtlama yalnızca
>   `get_public_quote` ve `respond_to_quote` RPC'leri üzerinden, doğru token ile
>   mümkündür. `respond_to_quote` artık süresi geçmiş veya zaten yanıtlanmış
>   teklifleri de reddeder.

Kurulum ayrıntıları: `supabase/SETUP.md`
