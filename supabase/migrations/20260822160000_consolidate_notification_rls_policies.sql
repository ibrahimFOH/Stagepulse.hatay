-- Consolidate equivalent notification RLS branches to reduce repeated policy evaluation.
-- Authorization semantics are unchanged: admins retain full access; staff retain only
-- access to their own notification/device rows under the existing permission checks.

DROP POLICY IF EXISTS notification_devices_admin_delete ON public.notification_devices;
DROP POLICY IF EXISTS notification_devices_self_delete ON public.notification_devices;
DROP POLICY IF EXISTS notification_devices_admin_select ON public.notification_devices;
DROP POLICY IF EXISTS notification_devices_self_select ON public.notification_devices;

CREATE POLICY notification_devices_select_canonical
ON public.notification_devices
FOR SELECT TO authenticated
USING (private.is_admin() OR user_id = (SELECT auth.uid()));

CREATE POLICY notification_devices_delete_canonical
ON public.notification_devices
FOR DELETE TO authenticated
USING (private.is_admin() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS admin_full_notifications_delete ON public.notifications;
DROP POLICY IF EXISTS notifications_staff_delete ON public.notifications;
DROP POLICY IF EXISTS admin_full_notifications_update ON public.notifications;
DROP POLICY IF EXISTS notifications_staff_update ON public.notifications;

CREATE POLICY notifications_delete_canonical
ON public.notifications
FOR DELETE TO authenticated
USING (
  private.is_admin()
  OR (
    recipient_user_id = (SELECT auth.uid())
    AND public.staff_has_perm('notifications.view')
  )
);

CREATE POLICY notifications_update_canonical
ON public.notifications
FOR UPDATE TO authenticated
USING (
  private.is_admin()
  OR (
    recipient_user_id = (SELECT auth.uid())
    AND public.staff_has_perm('notifications.view')
  )
)
WITH CHECK (
  private.is_admin()
  OR (
    recipient_user_id = (SELECT auth.uid())
    AND public.staff_has_perm('notifications.view')
  )
);
