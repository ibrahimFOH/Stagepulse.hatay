GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.offer_claim_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.offer_evaluate(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.offer_update_event_date(uuid,date) TO authenticated;
