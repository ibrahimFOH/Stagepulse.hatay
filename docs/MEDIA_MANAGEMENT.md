# Stagepulse Media Management

## Amaç
Admin panelindeki tek Medya ekranından fotoğraf, video ve PDF yönetilir. Repo medya akışı tek kanoniktir: `admin-github-media` Edge Function + GitHub Media Index workflow.

### Otomatik klasörler

- Fotoğraf: `images/gallery/photo/`
- Video: `images/gallery/video/`
- Doküman: `documents/`
- Eski fotoğraflar: `images/gallery/` kökünde geriye dönük olarak desteklenir.

## İş akışı

1. Admin Medya ekranından fotoğraf, video veya PDF seçilir.
2. Admin oturumu ve yönetici yetkisi doğrulanır.
3. `admin-github-media` Edge Function GitHub yazma yetkisini sunucu tarafındaki `GITHUB_TOKEN` secret'ından alır.
4. Medya GitHub `main` dalındaki kanonik klasöre yazılır.
5. GitHub Actions medya işleme workflow'u çalışır.
6. Desteklenen raster fotoğraflar WebP'ye dönüştürülür ve `media.json` yeniden oluşturulur.
7. GitHub Pages/Cloudflare dağıtımı tamamlandığında medya sitede yayınlanır.

Repo'ya fotoğrafı doğrudan yüklemek de desteklenir; aynı medya workflow'u otomatik WebP dönüşümü ve indeks üretimini yapar.

## Desteklenen fotoğraflar

JPG/JPEG, PNG, WebP, GIF, AVIF, BMP, TIFF, HEIC ve HEIF desteklenir. WebP dışındaki desteklenen raster fotoğraflar WebP kalite 90 ile normalize edilir. HEIC/HEIF için `pillow-heif` kullanılır.

## Büyük video

Git deposu sınırsız video deposu değildir. Küçük/orta boyutlu MP4/WEBM/MOV dosyaları medya indeksinde tutulabilir; büyük video varlıkları için Supabase Storage veya CDN tabanlı çözüm kullanılmalıdır.

## GitHub yetkisi

GitHub erişim anahtarı tarayıcıya konulmaz. `admin-github-media` Edge Function yalnızca sunucu tarafındaki `GITHUB_TOKEN` secret'ını kullanır.

Gerekli production değişkenleri:

- `GITHUB_TOKEN`
- `GITHUB_MEDIA_OWNER=ibrahimFOH`
- `GITHUB_MEDIA_REPO=Stagepulse.hatay`
- `GITHUB_MEDIA_BRANCH=main`

`GITHUB_TOKEN` tanımlı değilse Medya ekranı güvenli biçimde salt-okunur çalışır; dosya yükleme yapmaz.

## Silme ve yeniden adlandırma

Medya ekranı gerçek GitHub medya dosyasını yönetir ve işlem sonrasında `media.json` indeksini yeniden üretir. Fotoğrafın WebP dönüşümü GitHub Actions tarafından yapılır.

## Mevcut yapı

`media.json` kanonik fotoğraf, video ve PDF indeksidir. Aynı mantıksal dosya adı birden fazla klasörde bulunsa bile indeks tekrarı engellenir. Medya bulunduğu halde indeksin boş üretilmesi workflow tarafından hata kabul edilir ve yayın durdurulur.
