CREATE POLICY admin_permission_aliases_insert ON public.permission_aliases FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY admin_permission_aliases_update ON public.permission_aliases FOR UPDATE TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY admin_permission_aliases_delete ON public.permission_aliases FOR DELETE TO authenticated USING ((SELECT private.is_admin()));
CREATE POLICY admin_permission_catalog_insert ON public.permission_catalog FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY admin_permission_catalog_update ON public.permission_catalog FOR UPDATE TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY admin_permission_catalog_delete ON public.permission_catalog FOR DELETE TO authenticated USING ((SELECT private.is_admin()));
