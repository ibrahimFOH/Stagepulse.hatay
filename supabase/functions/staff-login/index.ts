import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({
  error: "LEGACY_ENDPOINT_RETIRED",
  message: "Bu giriş servisi kaldırıldı. Personel girişi Supabase Auth ve /portal/ RBAC akışı üzerinden yapılır."
}), {status:410, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"https://stagepulse.com.tr"}}));
