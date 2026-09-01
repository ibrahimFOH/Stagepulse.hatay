# Stagepulse Media Management

## Amaç
Admin panelindeki tek Medya ekranından fotoğraf ve video yönetilir.

### Otomatik klasörler

- Fotoğraf: `images/gallery/photo/`
- Video: `images/gallery/video/`
- Mevcut eski fotoğraflar: `images/gallery/` altında geriye dönük olarak desteklenir.

## İş akışı

1. Admin Medya ekranından JPG/JPEG/PNG/WebP/GIF/AVIF veya MP4/WEBM/MOV seçilir.
2. Dosya türüne göre hedef klasör otomatik seçilir.
3. Admin yetkisi doğrulanır.
4. Dosya geçici olarak Supabase Storage'a alınır.
5. Sunucu tarafındaki `media-github` Edge Function dosyayı GitHub ana branch'ine gönderir.
6. GitHub Actions medya işleme ve `media.json` indeks güncellemesini yapar.
7. GitHub Pages/Cloudflare dağıtımı tamamlandığında dosya sitede yayınlanır.

## Fotoğraf optimizasyonu

Yüklenen JPEG/PNG/GIF gibi raster fotoğraflar GitHub Actions üzerinde WebP'ye dönüştürülür. Boyutlar korunur; kalite 90 seviyesinde tutulur. Büyük görseller için 480/960/1600/2400 px genişliklerde responsive varyantlar üretilebilir. Orijinal kaynak dosyası, WebP doğrulandıktan sonra kaldırılabilir.

Amaç, dosya boyutunu düşürürken gözle görünür kalite kaybını sınırlamaktır.

## Büyük video

Git deposu sınırsız medya deposu olarak kullanılmaz. Büyük video dosyaları için Supabase Storage/Cloudflare R2 + CDN yolu korunur.

Medya merkezi küçük/orta boyutlu repo varlıklarını GitHub'a yayınlar; büyük dosyalar için boyut eşiği aşıldığında Storage/CDN yoluna düşer.

## GitHub yetkisi

GitHub erişim anahtarı tarayıcıya konulmaz. `media-github` Edge Function yalnızca sunucu tarafında saklanan `GITHUB_TOKEN` benzeri gizli değişkeni kullanır. Supabase Edge Functions gizli değişkenleri ortam değişkenlerinden okuyabilir ve bu bilgiler tarayıcıya konulmamalıdır.

Önerilen değişkenler:

- `GITHUB_TOKEN`
- `GITHUB_REPOSITORY=ibrahimFOH/Stagepulse.hatay`
- `GITHUB_BRANCH=main`

## Silme ve değiştirme

Medya ekranı GitHub'daki gerçek medya dosyasını ve `media.json` kaydını birlikte yönetir. Silme işlemi önce kullanım kontrolü yapar. Dosya aktif bir sayfada kullanılıyorsa kullanıcıya açık uyarı gösterilir.

## Mevcut yapı

Repo içinde `media.json` fotoğraf ve video listelerini tutuyor. Görseller `images/gallery/` altında, videolar ise medya işleme akışında yönetiliyor.
