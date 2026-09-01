REVOKE USAGE ON SCHEMA private FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION private.offer_claim_for_review(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION private.offer_evaluate(uuid,text,text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION private.offer_update_event_date(uuid,date) FROM anon, authenticated, PUBLIC;
