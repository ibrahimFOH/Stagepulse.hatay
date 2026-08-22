import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Legacy endpoint kept deployed for backward compatibility. Authentication is handled
// by the canonical admin-login endpoint; this endpoint must never accept credentials.
Deno.serve(() => new Response(
  JSON.stringify({
    error: "LEGACY_ENDPOINT_RETIRED",
    message: "Bu giriş servisi artık kullanılmıyor. Supabase Auth kullanın."
  }),
  {
    status: 410,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "https://stagepulse.com.tr"
    }
  }
));
