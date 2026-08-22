// Ortak güvenlik yardımcıları: CORS, basit rate-limit ve şifre politikası.
// Tüm edge function'lar bu modülü kullanır.

const ALLOWED_ORIGINS = new Set<string>([
  "https://stagepulse.com.tr",
  "https://www.stagepulse.com.tr",
  // Sadece geliştirme ortamı için (production'da zararsız, origin eşleşmezse kullanılmaz):
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://stagepulse.com.tr";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  return null;
}

// Basit bellek-içi (in-memory) rate limit. Not: Edge Function instance'ları
// birden fazla olabileceğinden ve soğuk başlatmalarda sıfırlanacağından bu
// kesin bir koruma değildir; ek olarak Supabase/Cloudflare seviyesinde
// gerçek bir rate-limit / WAF kuralı uygulanması önerilir.
// TODO: Kalıcı/dağıtık rate-limit için Supabase tablosu veya KV store kullanılabilir.
const rateBuckets = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

export function getClientIp(req: Request): string {
  // Cloudflare's cf-connecting-ip is the trusted client-IP signal at the edge.
  // Do not prefer x-forwarded-for because clients can supply that header themselves.
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  rateBuckets.set(key, arr);
  // Bellek büyümesini sınırla
  if (rateBuckets.size > 5000) {
    const firstKey = rateBuckets.keys().next().value;
    if (firstKey !== undefined) rateBuckets.delete(firstKey);
  }
  return arr.length > RATE_LIMIT_MAX;
}

export function isStrongPassword(password: string): boolean {
  if (typeof password !== "string" || password.length < 10) return false;
  const hasLetter = /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return hasLetter && hasDigit;
}

export const GENERIC_LOGIN_ERROR = "Geçersiz kullanıcı adı veya şifre.";

export function jsonError(
  message: string,
  status: number,
  headers: Record<string, string>
): Response {
  return Response.json({ error: message }, { status, headers });
}
