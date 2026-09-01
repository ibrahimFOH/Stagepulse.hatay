-- Runtime indexes for the portal's most frequent list/filter queries.
CREATE INDEX IF NOT EXISTS jobs_event_at_active_idx ON public.jobs (event_at) WHERE status NOT IN ('cancelled','done');
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON public.notifications (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_devices_user_active_idx ON public.notification_devices (user_id, active);
CREATE INDEX IF NOT EXISTS job_staff_job_response_idx ON public.job_staff (job_id, response_status);
