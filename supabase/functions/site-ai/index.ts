import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeadersFor, getClientIp, isRateLimited } from "../_shared/security.ts";

const MAX_MESSAGE = 700;
const SITE_ORIGIN = "https://stagepulse.com.tr";
const PUBLIC_PAGES = [
  "/", "/hizmetler.html", "/ekipman.html", "/muhendislik.html",
  "/ses-sistemi-kiralama.html", "/konser-sahnesi.html", "/nasil-calisiyoruz.html",
  "/bolgeler.html", "/hatay/index.html", "/adana/index.html", "/gaziantep/index.html",
  "/sanliurfa/index.html", "/mersin/index.html", "/teklif.html", "/sss.html",
  "/hakkimizda.html", "/galeri.html", "/referanslar.html",
];

type Page = { path: string; title: string; text: string };
let knowledgePromise: Promise<Page[]> | null = null;

const SYSTEM = `Sen Stagepulse'in müşteri tarafındaki teknik satış ve etkinlik danışmanısın.

MARKA: Stagepulse — Hatay/Antakya merkezli FOH Engineer ve profesyonel etkinlik teknik hizmetleri.
AKTİF HİZMET BÖLGELERİ: Hatay, Adana, Gaziantep, Şanlıurfa ve Mersin.
ANTALYA: Aktif hizmet bölgesi değildir. Antalya geçmiş çalışma deneyimidir; müşteriye Antalya'da aktif hizmet verildiğini söyleme ve Antalya'yı hizmet bölgesi olarak listeleme.

HİZMETLER: Ses sistemi kiralama, Line Array ve Point Source sistemleri, subwoofer/monitor çözümleri, FOH mühendisliği ve canlı miks, soundcheck/line check, Stage Plot ve teknik rider, SPL ve sistem tasarımı, 3D sahne çizimi, sahne ışıkları, Network Audio/Dante, kurulum-söküm ve saha koordinasyonu.

KURALLAR:
- Türkçe öncelikli; profesyonel, net ve anlaşılır cevap ver.
- Aktif hizmet bölgeleri konusunda yalnızca Hatay, Adana, Gaziantep, Şanlıurfa ve Mersin'i hizmet bölgesi olarak kabul et.
- Site içeriğinde olmayan fiyat, ekipman, adet, teknik değer veya müsaitlik uydurma.
- Fiyat için teklif sürecine yönlendir.
- Teknik öneride gerekli etkinlik, tarih, şehir, mekan, seyirci ve kapsam bilgilerini sor.
- Admin, personel, portal, şifre veya iç operasyon bilgilerini açıklama.
- Kullanıcı site bilgilerini sorarsa canlı SITE KNOWLEDGE içeriğini esas al.`;

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function htmlToText(html: string) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
  return { title, text };
}

async function fetchPage(path: string): Promise<Page | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`${SITE_ORIGIN}${path}`, {
        headers: { "User-Agent": "Stagepulse-Site-AI/1.0" }, signal: controller.signal,
      });
      if (!response.ok) return null;
      const parsed = htmlToText(await response.text());
      return parsed.text ? { path, title: parsed.title || path, text: parsed.text.slice(0, 9000) } : null;
    } finally { clearTimeout(timer); }
  } catch { return null; }
}

async function loadKnowledge() {
  if (!knowledgePromise) knowledgePromise = Promise.all(PUBLIC_PAGES.map(fetchPage)).then(p => p.filter(Boolean) as Page[]);
  return knowledgePromise;
}

function selectKnowledge(pages: Page[], query: string, currentPage: string) {
  const terms = query.toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(x => x.length >= 3).slice(0, 24);
  return pages.map(p => {
    const hay = `${p.path} ${p.title} ${p.text}`.toLocaleLowerCase("tr-TR");
    let score = p.path === currentPage ? 12 : 0;
    for (const term of terms) if (hay.includes(term)) score += term.length >= 6 ? 3 : 1;
    if (p.path === "/teklif.html" && /teklif|fiyat|ücret|bütçe|rezervasyon/.test(query.toLocaleLowerCase("tr-TR"))) score += 8;
    return { p, score };
  }).sort((a, b) => b.score - a.score).slice(0, 6)
    .map(({ p }) => `\n### ${p.title} — ${p.path}\n${p.text.slice(0, 4200)}`).join("\n");
}

serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  if (isRateLimited(`site-ai:${getClientIp(req)}`)) return json({ error: "Çok fazla istek. Lütfen bir dakika sonra tekrar deneyin." }, 429, cors);

  try {
    const body = await req.json();
    const message = String(body.message || "").trim().slice(0, MAX_MESSAGE);
    const page = String(body.page || "/").slice(0, 120);
    const history = Array.isArray(body.history) ? body.history.slice(-10).map((x: any) => ({
      role: x?.role === "assistant" ? "assistant" : "user", content: String(x?.content || "").slice(0, 1200),
    })) : [];
    if (!message) return json({ reply: "Bir soru yazın." }, 200, cors);

    const xai = Deno.env.get("XAI_API_KEY");
    const oai = Deno.env.get("OPENAI_API_KEY");
    const key = xai || oai;
    const base = xai ? "https://api.x.ai/v1" : "https://api.openai.com/v1";
    const model = Deno.env.get("AI_MODEL") || (xai ? "grok-2-latest" : "gpt-4o-mini");
    if (!key) return json({ reply: "Şu an temel Stagepulse bilgi modu aktif. Teklif için /teklif.html veya WhatsApp: https://wa.me/905320683012", mode: "fallback" }, 200, cors);

    const pages = await loadKnowledge();
    const context = `Kullanıcının bulunduğu sayfa: ${page}\n\nSITE KNOWLEDGE:${selectKnowledge(pages, message, page)}`;
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "system", content: context },
      ...history,
      { role: "user", content: message },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.2, messages, max_tokens: 750 }), signal: controller.signal,
      });
      if (!response.ok) return json({ reply: "Şu an teknik asistan yanıt veremiyor. Teklif için /teklif.html veya WhatsApp: https://wa.me/905320683012", mode: "fallback" }, 200, cors);
      const data = await response.json();
      const reply = String(data?.choices?.[0]?.message?.content || "").trim();
      if (!reply) return json({ reply: "Yanıt alınamadı. Teklif için /teklif.html sayfasını kullanabilirsiniz.", mode: "fallback" }, 200, cors);
      return json({ reply, mode: "llm", model, knowledge_pages: pages.length }, 200, cors);
    } finally { clearTimeout(timer); }
  } catch (e) {
    console.error("site-ai error", e);
    return json({ reply: "Şu an teknik asistan yanıt veremiyor. WhatsApp: https://wa.me/905320683012", mode: "fallback" }, 200, cors);
  }
});
