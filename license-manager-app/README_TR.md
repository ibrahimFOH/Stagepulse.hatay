# Stagepulse Ortak Lisans Yönetimi

Windows EXE, Android APK ve web yönetim arayüzü aynı Supabase Auth hesabını ve ortak `license-core` API'sini kullanır.

## Desteklenen uygulamalar
- Stagepulse
- Stagepulse Ses Merkezi (Windows)
- Stagepulse Ses Merkezi (Android)
- Stagepulse JARVIS (Windows)
- Stagepulse JARVIS (Android)

## Kimlik ve güvenlik
- Yönetici girişi Supabase Auth e-posta/şifre oturumudur.
- Yönetim yetkisi `org_memberships` ve `org_roles` üzerinden sunucuda kontrol edilir.
- Service-role anahtarı hiçbir istemciye veya EXE/APK içine konulmaz.
- Lisans anahtarları veritabanında yalnızca SHA-256 özetiyle tutulur.
- Lisans tabloları istemcilerden doğrudan okunamaz; tüm işlemler JWT doğrulayan Edge Function üzerinden yürür.
- Cihaz sınırı ortak lisans çekirdeğinde uygulanır. Aynı fiziksel cihaz farklı platform kimliğiyle tekrar sayılmaz.
- Stagepulse ve Ses Merkezi eski lisans kayıtları silinmez; veritabanı tetikleyicileri ortak sicile eşitler.
- JARVIS için lisans aktivasyonu isteğe bağlıdır. Lisans eklenmemiş kurulumlarda temel uygulama işlevleri kilitlenmez.

## Derleme
- Windows: GitHub Actions `Stagepulse Lisans Yönetimi Uygulamaları` iş akışı EXE üretir. Masaüstü arayüzü `127.0.0.1:5173` üzerinden sunulur; Supabase CORS izin listesiyle eşleşir.
- Android: GitHub Actions aynı iş akışında debug APK üretir. WebView yerel dosya (`file://`) yerine `https://appassets.androidplatform.net` kullanır; bu origin Supabase CORS listesinde tanımlıdır.
- Web: `assets/index.html` ve `assets/app.js` dosyaları aynı ortak API'yi kullanır.

## Canlı altyapı
- Supabase proje: `itasctyjzyewcykozuex`
- Ortak Edge Function: `license-core`
- JWT doğrulaması zorunludur.
- Yönetici hesabı için Supabase Auth'ta kayıtlı e-posta ve şifre gerekir.
