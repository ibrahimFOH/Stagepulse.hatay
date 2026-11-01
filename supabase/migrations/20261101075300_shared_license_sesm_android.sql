-- Ses Merkezi Android istemcisi de aynı ürün lisans ailesini kullanır.
insert into public.license_products(app_id,product_code,display_name,platform)
values('ses-merkezi-android','ses-merkezi','Stagepulse Ses Merkezi Android','android')
on conflict(app_id) do update set product_code=excluded.product_code,
 display_name=excluded.display_name,platform=excluded.platform,is_active=true;

insert into public.license_product_entitlements(app_id,capability,enabled,limits)
select 'ses-merkezi-android',capability,enabled,limits
from public.license_product_entitlements
where app_id='ses-merkezi'
on conflict(app_id,capability) do nothing;
