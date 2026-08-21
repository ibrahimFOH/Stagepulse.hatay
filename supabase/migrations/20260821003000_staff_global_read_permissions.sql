begin;
create or replace view public.customers_staff as
select id,name,company,phone,email,last_contact_at,created_at from public.customers
where public.staff_has_perm('customers');
create or replace view public.equipment_staff as
select id,category,brand,model,quantity,active,notes,created_at,updated_at from public.equipment
where active=true and public.staff_has_perm('equipment');
create or replace view public.offers_staff as
select id,quote_number,name,company,location,people,event_date,event_type,type,total as agreed_amount,currency,status,public_token,created_at,updated_at from public.teklifler
where public.staff_has_perm('offers');
create or replace view public.pricing_staff as
select id,name,description,base_price,sort_order from public.services where active=true and public.staff_has_perm('pricing');
drop policy if exists jobs_staff_select on public.jobs;
create policy jobs_staff_select on public.jobs for select to authenticated using (public.staff_has_perm('jobs'));
grant select on public.customers_staff,public.equipment_staff,public.offers_staff,public.pricing_staff to authenticated;
notify pgrst,'reload schema';
commit;
