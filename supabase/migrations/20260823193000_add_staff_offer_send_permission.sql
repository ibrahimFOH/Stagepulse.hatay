-- Staff offer sending is a separate catalog permission.
-- Existing offer managers inherit it so the current behavior remains unchanged.
insert into public.permission_catalog(key,category,label,description,sort_order,active)
values('offers.send','offers','Teklif gönderme','Personelin oluşturulmuş/düzenlenmiş teklifi gönderilmiş durumuna alabilmesi.',35,true)
on conflict (key) do update set
  category=excluded.category,
  label=excluded.label,
  description=excluded.description,
  active=true,
  updated_at=now();

insert into public.staff_permissions(user_id,permission_key,enabled,updated_at)
select sp.user_id,'offers.send',true,now()
from public.staff_permissions sp
where sp.permission_key='offers.manage'
  and sp.enabled=true
on conflict (user_id,permission_key) do update
set enabled=greatest(public.staff_permissions.enabled, excluded.enabled),
    updated_at=now();

notify pgrst,'reload schema';
