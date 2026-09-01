import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getClientIp, isDistributedRateLimited } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED = new Set(["https://stagepulse.com.tr", "https://www.stagepulse.com.tr"]);
const PUBLIC_ERRORS = new Set([
  "Teklif bağlantısı eksik.",
  "Teklif bulunamadı veya bağlantı geçersiz.",
  "Teklif bağlantısının süresi dolmuş.",
  "Bu teklif artık kullanılamıyor.",
  "PDF bağlantısı oluşturulamadı.",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://stagepulse.com.tr",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function response(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function identifierDigest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function publicOffer(row: any, pdf: any = null) {
  const expires = row.validity_until ?? row.valid_until ?? null;
  const visible = row.pdf_customer_visible !== false && pdf?.customer_visible !== false;
  return {
    id: row.id,
    quote_number: row.quote_number,
    name: row.name,
    company: row.company,
    type: row.type,
    event_type: row.event_type,
    location: row.location,
    people: row.people,
    event_date: row.event_date,
    duration_hours: row.duration_hours,
    message: row.message,
    services: row.services,
    total: row.total,
    currency: row.currency,
    valid_until: expires,
    validity_until: expires,
    status: row.status,
    public_code: row.public_code,
    pdf: visible && pdf?.storage_path
      ? { available: true, file_name: pdf.file_name || null, updated_at: pdf.updated_at }
      : { available: false },
  };
}

async function findOffer(db: any, body: any) {
  const code = text(body?.code, 120);
  const token = text(body?.token, 240);
  if (!code && !token) throw new Error("Teklif bağlantısı eksik.");
  const field = code ? "public_code" : "public_token";
  const value = code || token;
  const { data, error } = await db.from("teklifler").select("*").eq(field, value).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Teklif bulunamadı veya bağlantı geçersiz.");
  const expires = data.validity_until ?? data.valid_until;
  if (expires && new Date(expires).getTime() < Date.now()) throw new Error("Teklif bağlantısının süresi dolmuş.");
  if (["cancelled", "archived", "expired"].includes(data.status)) {
    throw new Error("Bu teklif artık kullanılamıyor.");
  }
  return data;
}

async function currentPdf(db: any, offer: any) {
  const { data, error } = await db
    .from("offer_pdf_assets")
    .select("storage_path,file_name,customer_visible,created_at,mime_type")
    .eq("offer_id", offer.id)
    .eq("is_current", true)
    .eq("mime_type", "application/pdf")
    .maybeSingle();
  if (error) throw error;
  if (data?.storage_path) return { ...data, updated_at: data.created_at };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response(req, { error: "Method Not Allowed" }, 405);

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    if (await isDistributedRateLimited(db, `public-offer:${getClientIp(req)}`, 30)) {
      return response(req, { error: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." }, 429);
    }
    const body = await req.json().catch(() => ({}));
    const action = text(body?.action, 40);
    const identifier = text(body?.code, 120) || text(body?.token, 240);
    if (identifier) {
      const digest = await identifierDigest(identifier);
      if (await isDistributedRateLimited(db, `public-offer-id:${digest}:${getClientIp(req)}`, 10)) {
        return response(req, { error: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." }, 429);
      }
    }
    const offer = await findOffer(db, body);

    if (action === "customer_quote") {
      const pdf = await currentPdf(db, offer);
      return response(req, { quote: publicOffer(offer, pdf) });
    }

    if (action === "customer_url") {
      const pdf = await currentPdf(db, offer);
      if (!pdf?.storage_path || offer.pdf_customer_visible === false || pdf.customer_visible === false) {
        return response(req, { error: "Müşteriye açık bir PDF bulunamadı." }, 404);
      }
      const { data, error } = await db.storage.from("offer-pdfs").createSignedUrl(pdf.storage_path, 900);
      if (error || !data?.signedUrl) throw error || new Error("PDF bağlantısı oluşturulamadı.");
      return response(req, { url: data.signedUrl, file_name: pdf.file_name || null });
    }

    if (action === "customer_respond") {
      const status = text(body?.response, 20);
      if (!["accepted", "rejected"].includes(status)) return response(req, { error: "Geçersiz teklif yanıtı." }, 400);
      if (!["new", "reviewing", "preparing", "sent"].includes(offer.status)) {
        return response(req, { error: "Teklif artık yanıtlanamaz." }, 409);
      }
      const patch = {
        status,
        accepted_at: status === "accepted" ? new Date().toISOString() : offer.accepted_at,
        rejected_at: status === "rejected" ? new Date().toISOString() : offer.rejected_at,
        updated_at: new Date().toISOString(),
      };
      const { data: updated, error } = await db
        .from("teklifler")
        .update(patch)
        .eq("id", offer.id)
        .in("status", ["new", "reviewing", "preparing", "sent"])
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return response(req, { error: "Teklif artık yanıtlanamaz." }, 409);
      await db.from("notifications").insert({
        kind: "quote_response",
        title: "Teklif yanıtı",
        body: `${offer.quote_number || "Teklif"} müşteriden ${status} yanıtı aldı.`,
        offer_id: offer.id,
      });
      return response(req, { ok: true, status });
    }

    return response(req, { error: "Geçersiz işlem." }, 400);
  } catch (error) {
    console.error("[offer-pdf-v3]", error);
    const message = error instanceof Error ? error.message : "";
    return PUBLIC_ERRORS.has(message)
      ? response(req, { error: message }, 400)
      : response(req, { error: "İşlem başarısız." }, 500);
  }
});