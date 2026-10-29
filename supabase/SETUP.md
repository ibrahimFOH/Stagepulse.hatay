# Stagepulse Supabase Kurulum

## Lisans yönetimi (bağımsız yönetici girişi)

Lisans paneli `https://stagepulse.com.tr/lisans/` adresinde yayınlanır. Bu panelin kullanıcı adı/şifresi Supabase Auth kullanıcı hesabı değildir. Lisans servisi veritabanı olarak Supabase'i kullanır; istemciye service-role anahtarı verilmez.

### 1. Veritabanı

Supabase Dashboard → SQL Editor üzerinden şu dosyayı çalıştırın:

`supabase/migrations/20261029090000_stagepulse_licenses.sql`

Lisans tablosu RLS ile korunur ve `anon` / `authenticated` rollerine doğrudan erişim verilmez.

### 2. Lisans yöneticisi sırları

Supabase Dashboard → Edge Functions → Secrets (veya CLI) içinde şu sırları tanımlayın:

- `LICENSE_ADMIN_USERNAME`: panel için ayrı kullanıcı adı; ör. `stagepulseadmin`
- `LICENSE_ADMIN_PASSWORD_HASH`: aşağıdaki biçimde PBKDF2-SHA256 parola özeti
- `LICENSE_ADMIN_TOKEN_SECRET`: en az 32 karakterlik rastgele gizli anahtar
- Mevcut `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` sırları

Parola özeti üretmek için yerel bilgisayarda Python 3 ile:

```python
import base64, hashlib, getpass, secrets
password = getpass.getpass("Yeni lisans yöneticisi şifresi: ")
if len(password) < 14:
    raise SystemExit("Şifre en az 14 karakter olmalı.")
salt = secrets.token_bytes(16)
iterations = 310000
digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations, dklen=32)
enc = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
print(f"pbkdf2-sha256${iterations}${enc(salt)}${enc(digest)}")
```

Çıktıyı yalnızca `LICENSE_ADMIN_PASSWORD_HASH` secret alanına girin. Gerçek şifreyi kaynak koda, GitHub'a veya HTML dosyasına yazmayın. `LICENSE_ADMIN_TOKEN_SECRET` için en az 32 rastgele karakter kullanın; parola ile aynı olmasın.

### 3. Deploy

```bash
supabase link --project-ref mtjcqqrogjqaxkagwkti
supabase db push
supabase functions deploy license-admin --no-verify-jwt
```

Bu fonksiyon Supabase Auth ile yönetici girişi yapmaz. Kullanıcı adı/şifre doğrulamasından sonra 30 dakikalık HMAC imzalı yönetici oturumu verir. Giriş denemeleri IP başına sınırlandırılır. Lisans anahtarları veritabanında düz metin değil SHA-256 özeti olarak saklanır ve anahtar yalnızca oluşturulduğu yanıtta gösterilir.

### 4. Lisans paneli

`lisans/index.html` statik panelidir. GitHub Pages/Cloudflare dağıtımı tamamlandıktan sonra `https://stagepulse.com.tr/lisans/` adresini açın.

Panelde:
- ayrı yönetici kullanıcı adı/şifresiyle giriş,
- lisans oluşturma,
- ürün kodu, cihaz limiti, son kullanma tarihi ve not,
- lisansları listeleme,
- lisansı iptal etme.

### 5. Önemli yayın kontrolü

Kodun GitHub'a yazılması, Supabase migration'ının veya Edge Function'ın canlıya dağıtıldığı anlamına gelmez. Canlıya geçmeden önce SQL migration'ını ve function deploy işlemini çalıştırın; ardından geçerli/geçersiz giriş, lisans oluşturma, cihaz sınırı, iptal ve süresi dolmuş lisans testlerini yapın. Bu testler geçmeden sistemi üretimde hazır kabul etmeyin.

## Mevcut admin ve personel girişleri

Mevcut Stagepulse admin/personel giriş akışları değişmeden kalır. Bu lisans yöneticisi ayrı bir giriş alanıdır ve mevcut Supabase Auth hesaplarının şifresini değiştirmez.
