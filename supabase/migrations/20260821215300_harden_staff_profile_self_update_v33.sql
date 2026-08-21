CREATE OR REPLACE FUNCTION private.log_staff_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.activity_logs(actor_id,action,entity_type,entity_id,metadata)
    VALUES(auth.uid(),'staff_profile_update','staff_profiles',NEW.id,jsonb_build_object('fields',jsonb_build_array('display_name','phone'),'old',jsonb_build_object('display_name',OLD.display_name,'phone',OLD.phone),'new',jsonb_build_object('display_name',NEW.display_name,'phone',NEW.phone)));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.log_staff_profile_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_staff_profile_self_audit ON public.staff_profiles;
CREATE TRIGGER trg_staff_profile_self_audit AFTER UPDATE OF display_name, phone ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION private.log_staff_profile_change();
REVOKE UPDATE ON public.staff_profiles FROM authenticated;
GRANT UPDATE(display_name,phone) ON public.staff_profiles TO authenticated;
DROP POLICY IF EXISTS staff_profiles_self_update ON public.staff_profiles;
CREATE POLICY staff_profiles_self_update ON public.staff_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() AND active = true) WITH CHECK (user_id = auth.uid() AND active = true);
ALTER FUNCTION public.staff_update_profile(text,text) SECURITY INVOKER;
ALTER FUNCTION public.staff_update_profile(text,text) SET search_path = '';
REVOKE ALL ON FUNCTION public.staff_update_profile(text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_update_profile(text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_update_profile(text,text) TO authenticated;
