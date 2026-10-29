# Stagepulse Lisans Yönetimi Uygulamaları

Windows EXE ve Android APK kaynakları. Arayüz uygulama içine gömülüdür; lisans işlemleri merkezî `license-admin` API'sine bağlanır, bu nedenle internet gerekir.

- Yönetici kullanıcı adı: `stagepulseadmin`
- Yönetici parolası Supabase Auth hesabı değildir; özel kullanıcı adı/parola doğrulaması `license-admin` Edge Function üzerinde yapılır. Parola PBKDF2-SHA256 ile özetlenir ve uygulama paketine gömülmez.
- İlk girişten sonra uygulamadaki **Yönetici şifresini değiştir** bölümünden en az 14 karakterli bir parola belirle. Parola değişikliği sunucu tarafında yapılır.
- Windows: `desktop/BUILD_WINDOWS.bat` çalıştır; EXE `desktop/dist/StagepulseLisansYonetimi.exe` konumuna çıkar.
- Android: `android` klasörünü Android Studio'da aç ve `assembleDebug` derle. APK `android/app/build/outputs/apk/debug/app-debug.apk` konumundadır.
- Debug APK test içindir; Play Store için imzalı release gerekir. EXE ve APK arayüzü yerel olarak paketlenir; ortak lisans veritabanı ve giriş doğrulaması için internet gerekir.
- GitHub Actions derlemesi: https://github.com/ibrahimFOH/Stagepulse.hatay/actions/workflows/build-license-manager.yml
- Service-role anahtarı uygulama içinde bulunmaz. Parola sunucuda PBKDF2-SHA256 hash'iyle saklanır. Oturum 30 dakika geçerlidir.
