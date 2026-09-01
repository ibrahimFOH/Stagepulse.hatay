# Stagepulse APK Güncelleme Kilidi

Bu dosya, çalışan APK güncelleme mimarisinin sözleşmesidir.

## Değiştirilmeyecek akış

`APK -> Supabase app_versions -> GitHub Releases/latest fallback -> versionCode karşılaştırması -> SHA-256 doğrulama -> Android PackageInstaller`

## Kurallar

1. Admin APK yalnızca `platform=admin` kaydını ve Admin APK URL'sini kullanır.
2. Personel APK yalnızca `platform=staff` kaydını ve Personel APK URL'sini kullanır.
3. Supabase `app_versions` birincil kaynaktır.
4. Supabase erişilemez, boş veya geçersiz cevap verirse GitHub Releases/latest fallback kullanılır.
5. APK yalnızca daha yüksek `versionCode` gördüğünde güncelleme önerir.
6. İndirilen APK'nın SHA-256 değeri doğrulanmadan kurulum başlatılmaz.
7. Mevcut release keystore değiştirilmeyecek; aksi halde mevcut kurulu APK'lara güncelleme yüklenemez.
8. Sürüm zinciri sıralı ilerler: `2.0.0 -> 2.0.1 -> 2.0.2 ...`.
9. Release'e Admin ve Personel APK birlikte yayınlanır.
10. `latest.json` Release ile aynı sürümü ve doğru APK dosyalarını göstermelidir.

## Koruma

Bu mimariyi değiştiren bir işlem, `AppUpdater.kt`, `apk-release.yml`, `sync-apk-release-to-supabase.yml` veya `app_versions` sözleşmesini etkiliyorsa ayrıca doğrulanmadan kabul edilmemelidir.
