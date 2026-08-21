import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED = new Set(["https://stagepulse.com.tr", "https://www.stagepulse.com.tr"]);
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://stagepulse.com.tr",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function out(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function token(v: unknown) {
  return typeof v === "string" ? v.trim().slice(0, 256) : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return out(req, { error: "Method Not Allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const pToken = token(body.token);
    const action = token(body.action);
    if (!pToken) return out(req, { error: "Geçersiz teklif bağlantısı." }, 400);

    if (!action || action === "load") {
      const { data, error } = await supabase
        .from("public_quotes")
        .select("*")
        .eq("public_token", pToken)
        .maybeSingle();
      if (error) throw error;
      if (!data) return out(req, { error: "Teklif bulunamadı veya bağlantının süresi dolmuş." }, 404);
      return out(req, { quote: data });
    }

    if (action !== "accepted" && action !== "rejected") {
      return out(req, { error: "Geçersiz işlem." }, 400);
    }

    const { data: quote, error: findError } = await supabase
      .from("teklifler")
      .select("*")
      .eq("public_token", pToken)
      .gte("valid_until", new Date().toISOString().slice(0, 10))
      .not("status", "in", "(accepted,rejected,cancelled,archived,expired)")
      .maybeSingle();

    if (findError) throw findError;
    if (!quote) return out(req, { error: "Teklif bulunamadı, süresi dolmuş veya zaten yanıtlanmış." }, 409);

    const now = new Date().toISOString();
    const patch = {
      status: action,
      accepted_at: action === "accepted" ? now : quote.accepted_at,
      rejected_at: action === "rejected" ? now : quote.rejected_at,
      updated_at: now,
    };

    const { error: updateError } = await supabase.from("teklifler").update(patch).eq("id", quote.id);
    if (updateError) throw updateError;

    const { error: notificationError } = await supabase.from("notifications").insert({
      kind: "quote_response",
      title: "Teklif yanıtı",
      body: `${quote.quote_number || "Teklif"} müşteriden ${action} yanıtı aldı.`,
      offer_id: quote.id,
    });
    if (notificationError) console.error("notification insert failed", notificationError);

    return out(req, { ok: true, status: action, quote_number: quote.quote_number });
  } catch (error) {
    console.error(error);
    return out(req, { error: "İşlem gerçekleştirilemedi." }, 500);
  }
});
