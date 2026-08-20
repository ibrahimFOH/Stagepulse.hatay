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
