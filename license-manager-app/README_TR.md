# Stagepulse Lisans Yönetimi Uygulamaları

Windows EXE ve Android APK kaynakları. Arayüz uygulama içine gömülüdür; lisans işlemleri merkezî `license-admin` API'sine bağlanır, bu nedenle internet gerekir.

- Yönetici kullanıcı adı: `stagepulseadmin`
- Yönetici parolası Supabase Auth hesabı değildir; özel kullanıcı adı/parola doğrulaması `license-admin` Edge Function üzerinde yapılır. Parola PBKDF2-SHA256 ile özetlenir ve uygulama paketine gömülmez.
- Yönetici parolasını uygulamadaki **Yönetici şifresini değiştir** bölümünden değiştirebilirsin. Şifre boş olamaz ve 1024 karakteri aşamaz. Parola sunucuda PBKDF2-SHA256 ile hash'lenir.
- Windows: `desktop/BUILD_WINDOWS.bat` çalıştır; EXE `desktop/dist/StagepulseLisansYonetimi.exe` konumuna çıkar.
- Android: `android` klasörünü Android Studio'da aç ve `assembleDebug` derle. APK `android/app/build/outputs/apk/debug/app-debug.apk` konumundadır.
- Debug APK test içindir; Play Store için imzalı release gerekir. EXE ve APK arayüzü yerel olarak paketlenir; ortak lisans veritabanı ve giriş doğrulaması için internet gerekir.
- Yönetici hesabını değiştirmeden, sunucuda 5 dakikayla sınırlı ve tek kullanımlık geçici giriş açılabilir. Bu girişle kalıcı yönetici parolası uygulamanın içinden değiştirilebilir; geçici oturum daha erken sona erer.
- Service-role anahtarı uygulama içinde bulunmaz. Parola sunucuda PBKDF2-SHA256 hash'iyle saklanır. Normal oturum 30 dakika geçerlidir.
- API, Windows'un yerel `file://` uygulama kökeni ve Android WebView için CORS yanıtında joker köken kullanır; yönetim işlemlerinin güvenliği yine sunucu tarafındaki imzalı oturumla sağlanır.
- GitHub Actions derlemesi: https://github.com/ibrahimFOH/Stagepulse.hatay/actions/workflows/build-license-manager.yml
