# FCM Üretim Hazırlık Durumu

Durum: FCM kuyruğu ve dakikalık yeniden deneme işi canlıda etkin; bildirim alıcı ilişkisi ve en az ayrıcalıklı erişim bu PR'daki migration ile onarılıyor. Gerçek cihaz teslimatı henüz kabul edilmedi.

## Canlıda doğrulanan altyapı

- `pg_net` 0.20.4 ve `pg_cron` 1.6.4 etkin.
- `stagepulse-notification-push-retry` cron işi her dakika çalışacak şekilde etkin.
- Bildirim dispatch ve dead-letter tetikleyicileri kurulu.
- `register-android-device` Edge Function v2 aktif ve JWT doğrulaması açık.
- `send-fcm-notification` Edge Function v2 aktif; manuel gönderim yönetici oturumu, iç dispatch tek kullanımlık token gerektiriyor.
- `production-os` Edge Function v2 aktif ve personel/yönetici rol kontrolleri içeriyor.
- Canlı tabloda henüz Android FCM cihaz kaydı ve bildirim satırı yok. Bu nedenle gerçek teslimat başarısı iddia edilmiyor.

## Bu PR ile düzeltilen bildirim akışı

- `notifications.recipient_user_id` alanı auth.users kaydına bağlı olacak.
- Yeni teklif bildirimleri aktif yöneticilere ve `offers.view` yetkili aktif organizasyon üyelerine ayrı satırlar halinde oluşturulacak.
- Kullanıcı yalnızca kendi bildirimini okuyabilecek ve silebilecek; yalnızca `read_at` alanını güncelleyebilecek.
- Authenticated istemciler bildirim oluşturamayacak, alıcıyı/payload'u veya FCM dispatch alanlarını değiştiremeyecek.
- Alıcısı bulunmayan sistem bildirimleri FCM kuyruğuna girmeyecek.
- Aktif FCM cihazı bulunmayan bildirimler gönderildi işaretlenmeyecek; sınırlı yeniden denemede kalacak ve altı deneme sonunda dead-letter tablosuna taşınacak.

## Hâlâ gerekli kabul testleri

1. Migration'ın canlıya uygulanması ve recipient foreign key, RLS, kolon yetkileri, cron ve trigger kontrollerinin tekrar çalıştırılması.
2. `FIREBASE_SERVICE_ACCOUNT_JSON` veya `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` sırlarının Supabase Dashboard üzerinden doğrulanması. Bağlı araç güvenli secret değerlerini listeleyemediğinden burada var oldukları iddia edilmiyor.
3. En az bir Admin ve bir Personel Android cihazının güncel APK ile kaydolması.
4. Admin hesabından Personel hesabına ve Admin hesabına gerçek FCM gönderimi yapılması.
5. Ön plan, arka plan, uygulama kapalı, eski token temizliği ve bildirime dokununca doğru ekrana açılma davranışlarının doğrulanması.

## Kabul sınırı

CI, SQL migration veya Edge Function'ın ACTIVE olması Firebase teslimatını kanıtlamaz. Token ve servis hesabı değerleri rapora kaydedilmemelidir. Fiziksel cihaz testleri kaydedilene kadar FCM üretim kabulü açık kalır.
