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
- Windows: `desktop/BUILD_WINDOWS.bat` çalıştır. EXE `desktop/dist/StagepulseLisansYonetimi.exe` konumuna çıkar.
- Android: `android` klasörünü Android Studio'da aç ve `assembleDebug` görevini çalıştır.
- Web: `assets/index.html` ve `assets/app.js` dosyaları aynı ortak API'yi kullanır.

## Canlı altyapı
- Supabase proje: `itasctyjzyewcykozuex`
- Ortak Edge Function: `license-core`
- JWT doğrulaması zorunludur.
- Yönetici hesabı için Supabase Auth'ta kayıtlı e-posta ve şifre gerekir.
