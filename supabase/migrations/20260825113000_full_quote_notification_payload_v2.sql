create or replace function public.notify_new_offer() returns trigger
language plpgsql security definer set search_path to '' as $$
declare
  v_body text;
begin
  v_body := concat_ws(E'\n',
    'Merhaba, Stagepulse üzerinden teklif almak istiyorum.',
    '',
    'Ad Soyad / Firma: ' || coalesce(new.name,''),
    case when nullif(new.company,'') is not null then 'Firma: ' || new.company end,
    case when nullif(new.email,'') is not null then 'E-posta: ' || new.email end,
    'Telefon: ' || coalesce(new.phone,''),
    'Etkinlik Türü: ' || coalesce(new.event_type,''),
    'Hizmet: ' || coalesce(new.type,''),
    'Lokasyon: ' || coalesce(new.location,''),
    'Katılımcı: ' || coalesce(new.people::text,''),
    'Etkinlik Tarihi: ' || coalesce(new.event_date::text,''),
    'Detay: ' || coalesce(new.message,'')
  );

  insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
  select r.user_id,
         'new_quote',
         'Yeni teklif talebi',
         left(v_body, 4000),
         new.id
  from (
    select ap.user_id
    from public.admin_profiles ap
    where ap.active=true and ap.user_id is not null
    union
    select sp.user_id
    from public.staff_profiles sp
    join public.staff_permissions perm
      on perm.user_id=sp.user_id
     and perm.permission_key='offers.view'
     and perm.enabled=true
    where sp.active=true and sp.user_id is not null
  ) r;
  return new;
exception when others then
  raise warning 'new offer notification failed: %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_new_offer_notification on public.teklifler;
create trigger trg_new_offer_notification
after insert on public.teklifler
for each row execute function public.notify_new_offer();
