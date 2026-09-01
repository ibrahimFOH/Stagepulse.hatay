create or replace function public.notify_new_offer() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
  select r.user_id,
         'new_quote',
         'Yeni teklif talebi',
         coalesce(new.quote_number,'Yeni teklif') || ' - ' || coalesce(new.name,'Yeni müşteri'),
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
