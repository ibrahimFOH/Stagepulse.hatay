# Stagepulse Lisans Yönetimi Uygulamaları

Windows EXE ve Android APK kaynakları. Arayüz uygulama içine gömülüdür; lisans işlemleri merkezî `license-admin` API'sine bağlanır, bu nedenle internet gerekir.

- Yönetici kullanıcı adı: `stagepulseadmin`
- İlk şifre bu konuşmada ayrıca iletilmiştir. İlk girişten sonra uygulamadaki **Yönetici şifresini değiştir** bölümünden değiştir.
- Windows: `desktop/BUILD_WINDOWS.bat` çalıştır; EXE `desktop/dist/StagepulseLisansYonetimi.exe` konumuna çıkar.
- Android: `android` klasörünü Android Studio'da aç ve `assembleDebug` derle. APK `android/app/build/outputs/apk/debug/app-debug.apk` konumundadır.
- Debug APK test içindir; Play Store için imzalı release gerekir. Windows EXE derlemesi ve gerçek cihaz testleri ayrıca doğrulanmalıdır.
- Service-role anahtarı uygulama içinde bulunmaz. Parola sunucuda PBKDF2-SHA256 hash'iyle saklanır. Oturum 30 dakika geçerlidir.
