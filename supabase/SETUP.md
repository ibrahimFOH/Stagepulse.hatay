# Stagepulse Supabase Kurulum

## 1. SQL (sırayla)

Supabase Dashboard → **SQL Editor**:

1. `schema.sql` çalıştır
2. `finance-settlements.sql` çalıştır (varsa)
3. `staff-portal.sql` çalıştır  ← personel paneli + yetkiler

## 2. Admin hesabı

Authentication → Users → Create user (gerçek e-posta + güçlü şifre).

SQL Editor:

```sql
insert into public.admin_profiles(user_id, username, display_name)
values ('AUTH-USER-UUID', 'stagepulseadmin', 'Stagepulse Admin');
```

## 3. Edge Functions deploy

Fonksiyonlar `supabase/functions/` altında hazır.

```bash
supabase link --project-ref mtjcqqrogjqaxkagwkti

supabase functions deploy staff-login
supabase functions deploy staff-manage
supabase functions deploy admin-login
supabase functions deploy admin-password-reset
```

`config.toml` içinde `verify_jwt = false` ayarlı (CORS / preflight sorunu olmasın diye).
Yetki kontrolü fonksiyon kodunun içinde yapılıyor.

## 4. Personel yetkileri

Admin panel → Personel → **+ Personel ekle**

Oluştururken / düzenlerken işaretleyebilirsin:

| Yetki | Ne görür |
|-------|----------|
| İşler | İş listesi + detay + malzeme adetleri |
| Ekipman | Stok / rezerv / müsait |
| Teklifler | Anlaşılan tutar (maliyet/kâr yok) |
| İş durumu güncelle | Devama al / Bitir butonları |

İşaretlenmeyen menü personel portalında **görünmez**.

## 5. Adresler

- Admin: `https://stagepulse.com.tr/admin/`
- Personel: `https://stagepulse.com.tr/portal/`

## Güvenlik

- Service role key asla frontend'e konmaz.
- Personel mali alanları (gider, kâr, maliyet) hiçbir şekilde görmez (`equipment_staff` /
  `offers_staff` view'ları bu alanları hiç seçmez).
- `anon` / publishable key frontend'de olabilir.
- **CORS**: `admin-login`, `staff-login`, `staff-manage`, `admin-password-reset`
  fonksiyonları yalnızca `https://stagepulse.com.tr`, `https://www.stagepulse.com.tr`
  ve (geliştirme amaçlı) `http://localhost:5173` / `http://127.0.0.1:5173`
  origin'lerinden gelen isteklere `Access-Control-Allow-Origin` döner. Farklı bir
  origin'den (örn. başka bir site veya `curl` ile `Origin` header'ı olmadan yapılan
  istekler) tarayıcı bu isteği engeller; not: bu yalnızca tarayıcı tarafında
  uygulanan bir korumadır, sunucu tarafı yetki kontrolü (Authorization header +
  `is_admin()`/`is_staff()`) esas güvenlik katmanıdır.
- **Şifre politikası**: Admin ve personel şifreleri en az 10 karakter + en az bir
  harf + bir rakam içermelidir. Bu kural hem `supabase/functions/staff-manage` ve
  `admin-password-reset` fonksiyonlarında hem de admin panel formlarında uygulanır.
- **Rate limit**: `admin-login` ve `staff-login` fonksiyonları aynı IP'den dakikada
  10'dan fazla deneme geldiğinde `429` döner (bellek-içi, best-effort). Ciddi bir
  brute-force koruması için Cloudflare Rate Limiting Rules veya benzeri bir
  edge/WAF kuralı eklemeniz önerilir.
- **Public teklif erişimi**: `public_quotes` view'ı `anon`/`authenticated`
  rollerinden `revoke all` edilmiştir; müşteri teklif görüntüleme/onay/red işlemleri
  yalnızca `get_public_quote(token)` ve `respond_to_quote(token, action)`
  security-definer RPC'leri üzerinden, doğru `public_token` ile mümkündür.
- Kök dizindeki eski `/functions/` klasörü ve `.github/workflows/admin/` içindeki
  güncel olmayan admin paneli kopyası kaldırılmıştır — tek kaynak `supabase/functions/`
  ve `/admin/`'dir.

## Rol ve finans V2

Bu sürümde iki ayrı alan vardır:

- **Admin:** tüm gelir/gider, ciro, gider, net kâr ve gelir sahipliği bilgilerini görür.
- **Personel:** operasyon ekranlarını kullanır; kendisine atanmış işi kabul/red edebilir ve yetkisi varsa durumunu güncelleyebilir. Mali rakamlar varsayılan olarak kapalıdır.

Kurulum sırası:

1. `schema.sql`
2. `finance-settlements.sql`
3. `staff-portal.sql`

`finance-settlements.sql` içindeki `revenue_owner_type` ve `owner_pct` ile işin finans modeli belirlenir. `owner` = doğrudan admin hanesi ve %100; `shared` = ortak iş, gider önce toplam cirodan düşer ve kalan net `owner_pct` oranında paylaşılır (varsayılan %33); `partner` = admin hanesine yazılmaz ve gider uygulanmaz. FOH, Rider ve 3D hazırlama gibi doğrudan sana ait işlerde `owner` kullanılır; ortak kiralama gibi işlerde `shared` kullanılır.

Personel yetkileri `staff_profiles.permissions` içinde tutulur. Özellikle `accept_job`, `reject_job` ve `update_job_status` operasyon yetkileridir; `finance`, `pricing` ve `financials` mali/hassas yetkilerdir ve varsayılan olarak kapalıdır.

---

## Lisans yönetimi (bağımsız yönetici girişi)

Lisans paneli `https://stagepulse.com.tr/lisans/` adresinde yayınlanır. Bu giriş Supabase Auth hesabı değildir. Lisans verileri Supabase'de tutulur; istemciye service-role anahtarı verilmez.

### 1. Veritabanı

Aşağıdaki migration dosyaları lisans tablosunu ve ayrı yönetici yapılandırma tablosunu oluşturur:

- `supabase/migrations/20261029164810_stagepulse_independent_license_management.sql`
- `supabase/migrations/20261029164909_stagepulse_license_admin_config.sql`

Lisans tablosu ve yönetici yapılandırması RLS ile korunur. `anon` ve `authenticated` rollerine doğrudan erişim verilmez. Yalnızca sunucu tarafındaki service-role erişebilir.

### 2. Ayrı yönetici hesabını ilk kez oluşturma

Yönetici adı `stagepulseadmin` olabilir. Gerçek parola veya oturum imza sırrı GitHub deposuna konulmamalıdır.

Bilgisayarda Python 3 çalıştırıp aşağıdaki kodu kullanın. Kod, parola sormak yerine parolayı güvenli biçimde sizden alır ve SQL Editor'a yapıştırılacak yapılandırma komutunu üretir:

```python
import base64, hashlib, getpass, secrets

username = "stagepulseadmin"
password = getpass.getpass("Yeni lisans yöneticisi şifresi (en az 14 karakter): ")
if len(password) < 14:
    raise SystemExit("Şifre en az 14 karakter olmalı.")

enc = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
salt = secrets.token_bytes(16)
iterations = 310000
digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations, dklen=32)
password_hash = f"pbkdf2-sha256${iterations}${enc(salt)}${enc(digest)}"
token_secret = secrets.token_urlsafe(48)

print("\nSupabase Dashboard > SQL Editor içinde çalıştırılacak SQL:\n")
print(
    "insert into public.stagepulse_license_admin_config "
    "(singleton, username, password_hash, token_secret, updated_at) values "
    f"(true, '{username}', '{password_hash}', '{token_secret}', now()) "
    "on conflict (singleton) do update set username = excluded.username, "
    "password_hash = excluded.password_hash, token_secret = excluded.token_secret, "
    "updated_at = now();"
)
```

Üretilen SQL'i Supabase Dashboard → SQL Editor içinde çalıştırın. Parola düz metin olarak veritabanına kaydedilmez; yalnızca PBKDF2-SHA256 özeti tutulur. SQL çıktısını veya parolanızı GitHub'a eklemeyin. Parolayı güvenli bir parola yöneticisinde saklayın.

### 3. Edge Function

`license-admin` Edge Function canlı projeye dağıtılmıştır. `verify_jwt=false` ayarı kullanılır; çünkü yönetici girişi fonksiyon içinde bağımsız HMAC imzalı oturumla doğrulanır. Fonksiyon, yönetici yapılandırmasını yalnızca service-role erişimli tablodan okur. Yönetici oturumu 30 dakika geçerlidir.

Kod değişikliklerinden sonra yeniden dağıtmak için:

```bash
supabase link --project-ref mtjcqqrogjqaxkagwkti
supabase functions deploy license-admin --no-verify-jwt
```

### 4. Lisans paneli

`lisans/index.html` statik panelidir. GitHub Pages/Cloudflare dağıtımı tamamlandıktan sonra `https://stagepulse.com.tr/lisans/` adresinden açılır.

Panel özellikleri:
- Supabase Auth'tan bağımsız kullanıcı adı/şifreyle giriş,
- lisans oluşturma, listeleme ve iptal,
- ürün kodu, cihaz sınırı ve isteğe bağlı bitiş tarihi,
- cihaz etkinleştirme/doğrulama API'si.

Lisans anahtarları veritabanında düz metin değil SHA-256 özeti olarak tutulur; anahtar yalnızca oluşturulduğu yanıtta gösterilir.

### 5. Masaüstü EXE ve Android APK

- Windows masaüstü paketi: `desktop-license/` içinde Electron tabanlı, ayrı pencerede açılan uygulama. Uygulama lisans panelini güvenli HTTPS üzerinden açar; internet bağlantısı gerekir.
- Android paketi: `android/license-app/` içinde bağımsız lisans yönetimi uygulaması. Mevcut Stagepulse personel/admin uygulamalarından ayrı paket kimliği kullanır ve lisans panelini açar.
- PR doğrulama iş akışı `Stagepulse Lisans Uygulamaları`, Windows kurulum dosyasını ve debug APK'yı ayrı GitHub Actions artifact'ları olarak üretir. Artifacts 14 gün saklanır; bu dosyalar imzalı mağaza sürümü değildir.

### 6. Canlı test kontrol listesi

İlk yönetici yapılandırması SQL Editor'da çalıştırıldıktan sonra şu testleri tamamlayın:

1. Doğru kullanıcı adı/şifre ile giriş ve hatalı parola denemesi.
2. Lisans oluşturma ve oluşturulan anahtarla ilk cihazı etkinleştirme.
3. Aynı cihazda tekrar etkinleştirme ve cihaz sınırını aşma denemesi.
4. Lisansı iptal edip yeniden doğrulamayı deneme.
5. Süresi dolmuş lisans ve farklı ürün kodu denemesi.
6. Mobil tarayıcıdan panel görünümü.

Bu testler ve EXE/APK istemci entegrasyonu tamamlanmadan bütün lisans sistemi üretimde hazır kabul edilmemelidir.

## Mevcut admin ve personel girişleri

Mevcut Stagepulse admin/personel giriş akışları değişmeden kalır. Bu lisans yöneticisi ayrı bir giriş alanıdır ve mevcut Supabase Auth hesaplarının şifresini değiştirmez.
