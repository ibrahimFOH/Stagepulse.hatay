# DEPRECATED: Legacy staff-portal.sql

Bu dosya korunmaktadır ve silinmemiştir; ancak production için artık source-of-truth değildir.

## Production source-of-truth

- `supabase/functions/`
- `supabase/migrations/`
- `supabase/staff-portal-v2.sql`

`supabase/staff-portal.sql` eski kurulum geçmişi/compatibility referansı olarak tutulur. Production veritabanında tekrar çalıştırılması önerilmez; yeni permission katalogu ve `staff_permissions` yapısı migration'lar üzerinden yönetilir.

Personel portalındaki gerçek yetki kaynağı `public.staff_permissions` tablosudur. Eksik permission varsayılan olarak kapalıdır.

`my_jobs_staff` için güncel güvenli ilişki `staff.user_id = staff_profiles.user_id` ve oturum sahibi `auth.uid()` üzerinden kuruludur.
