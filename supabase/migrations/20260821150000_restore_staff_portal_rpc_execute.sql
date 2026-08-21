begin;

-- Stagepulse personel portali PostgREST uzerinden SECURITY DEFINER RPC'lerini
-- authenticated oturumla cagirir. Fonksiyonlar kendi yetki kontrollerini yapar;
-- bu nedenle authenticated EXECUTE acik, anon EXECUTE kapali tutulur.
grant execute on function public.staff_capability(text) to authenticated;
grant execute on function public.staff_capabilities(uuid) to authenticated;
grant execute on function public.staff_assigned_jobs() to authenticated;
grant execute on function public.staff_offer_response_safe(uuid,text,text) to authenticated;
grant execute on function public.staff_respond_job(uuid,text,text) to authenticated;

revoke execute on function public.staff_capability(text) from anon;
revoke execute on function public.staff_capabilities(uuid) from anon;
revoke execute on function public.staff_assigned_jobs() from anon;
revoke execute on function public.staff_offer_response_safe(uuid,text,text) from anon;
revoke execute on function public.staff_respond_job(uuid,text,text) from anon;

commit;
