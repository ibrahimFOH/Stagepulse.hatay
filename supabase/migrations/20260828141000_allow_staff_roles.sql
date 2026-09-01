-- Stagepulse personel rol modeli
-- Eski roller geriye dönük uyumluluk için korunur; yeni admin personel rolleri eklenir.
alter table public.staff_profiles drop constraint if exists staff_profiles_role_check;
alter table public.staff_profiles
  add constraint staff_profiles_role_check
  check (role in (
    'crew','tech','warehouse','lead',
    'personel','teknik_personel','depo_personeli',
    'operasyon_sorumlusu','departman_yoneticisi','ust_yonetici','ceo'
  ));

notify pgrst, 'reload schema';
