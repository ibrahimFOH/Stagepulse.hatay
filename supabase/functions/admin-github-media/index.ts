import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const OWNER = Deno.env.get("GITHUB_MEDIA_OWNER") || "ibrahimFOH";
const REPO = Deno.env.get("GITHUB_MEDIA_REPO") || "Stagepulse.hatay";
const BRANCH = Deno.env.get("GITHUB_MEDIA_BRANCH") || "main";
const ALLOWED = new Set(["https://stagepulse.com.tr", "https://www.stagepulse.com.tr"]);
const IMAGE_EXTS = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_EXTS = /\.(mp4|webm|mov)$/i;
const PDF_EXT = /\.pdf$/i;

const headers = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://stagepulse.com.tr",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
};

const out = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headers(req) });

const text = (value: unknown, max = 240) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function mediaPath(area: string, fileName: string) {
  const name = fileName.split(/[\\/]/).pop()?.trim() || "";
  if (!name || name === "." || name === ".." || name.includes("\0")) throw new Error("Dosya adı geçersiz.");
  if (!IMAGE_EXTS.test(name) && !VIDEO_EXTS.test(name) && !PDF_EXT.test(name)) {
    throw new Error("Desteklenmeyen medya türü.");
  }
  if (area === "documents" && !PDF_EXT.test(name)) throw new Error("Documents klasörü yalnızca PDF kabul eder.");
  if (area === "gallery" && PDF_EXT.test(name)) throw new Error("Gallery klasörüne PDF yüklenemez.");
  return area === "documents" ? `documents/${name}` : `images/gallery/${name}`;
}

async function github(path = "", init: RequestInit = {}) {
  const [rawPath, query = ""] = path.split("?", 2);
  const apiPath = rawPath.startsWith("git/") ? rawPath : `contents/${rawPath}`;
  const url = `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/${apiPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Stagepulse-Media-Manager",
      ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[admin-github-media] GitHub API request failed", response.status, body?.message || "");
    throw Object.assign(new Error("GitHub işlemi başarısız."), { status: response.status >= 400 && response.status < 500 ? 400 : 502 });
  }
  return body;
}

function isMedia(path: string) {
  return (path.startsWith("images/gallery/") || path.startsWith("documents/")) &&
    (IMAGE_EXTS.test(path) || VIDEO_EXTS.test(path) || PDF_EXT.test(path));
}

function item(path: string, size = 0, sha = "") {
  return {
    type: "file",
    path,
    name: path.split("/").pop(),
    size,
    sha,
    download_url: `https://stagepulse.com.tr/${path}`,
    html_url: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${path}`,
    source: "repository",
  };
}

async function requireAdmin(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw Object.assign(new Error("Yönetici oturumu gerekli."), { status: 401 });
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.auth.getUser(authorization.slice(7).trim());
  if (error || !data.user) throw Object.assign(new Error("Oturum geçersiz."), { status: 401 });
  const { data: membership, error: membershipError } = await db
    .from("org_memberships")
    .select("active,role:role_id(code,is_admin_role)")
    .eq("user_id", data.user.id)
    .eq("active", true)
    .maybeSingle();
  if (membershipError) throw Object.assign(new Error("Yönetici yetkisi doğrulanamadı."), { status: 503 });
  const role = Array.isArray((membership as any)?.role) ? (membership as any).role[0] : (membership as any)?.role;
  if (!membership || role?.is_admin_role !== true) {
    throw Object.assign(new Error("Yönetici yetkisi gerekli."), { status: 403 });
  }
  return { db, userId: data.user.id };
}

async function listMedia() {
  const tree = await github(`git/trees/${encodeURIComponent(BRANCH)}?recursive=1`);
  return (tree.tree || [])
    .filter((entry: any) => entry.type === "blob" && isMedia(entry.path))
    .map((entry: any) => item(entry.path, entry.size || 0, entry.sha || ""));
}

function requireWriteAccess() {
  if (!GITHUB_TOKEN) {
    throw Object.assign(new Error("GitHub medya yazma bağlantısı yapılandırılmamış. Listeleme salt okunur olarak kullanılabilir."), { status: 503 });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return out(req, { error: "Method Not Allowed" }, 405);

  try {
    const { userId } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 40);

    if (action === "list") {
      return out(req, { items: await listMedia(), write_enabled: Boolean(GITHUB_TOKEN) });
    }

    requireWriteAccess();

    if (action === "upload") {
      const requestedArea = text(body.area, 30);
      const fileName = text(body.file_name, 180);
      const area = requestedArea === "documents" || (requestedArea === "auto" && PDF_EXT.test(fileName))
        ? "documents"
        : "gallery";
      const path = mediaPath(area, fileName);
      const content = text(body.base64, 50_000_000);
      if (!content || content.length > 50_000_000) throw new Error("Dosya içeriği geçersiz veya çok büyük.");
      const saved = await github(path, {
        method: "PUT",
        body: JSON.stringify({
          message: `chore(media): upload ${path}`,
          content,
          branch: BRANCH,
        }),
      });
      return out(req, { ok: true, item: item(path, saved.content?.size || 0, saved.content?.sha || "") });
    }

    if (action === "delete") {
      const path = text(body.path, 240);
      if (!isMedia(path)) throw new Error("Medya yolu geçersiz.");
      const current = await github(path);
      await github(path, {
        method: "DELETE",
        body: JSON.stringify({ message: `chore(media): delete ${path}`, sha: current.sha, branch: BRANCH }),
      });
      return out(req, { ok: true, deleted: path });
    }

    if (action === "rename") {
      const oldPath = text(body.old_path, 240);
      if (!isMedia(oldPath)) throw new Error("Eski medya yolu geçersiz.");
      const current = await github(oldPath);
      const area = oldPath.startsWith("documents/") ? "documents" : "gallery";
      const newPath = mediaPath(area, text(body.new_name, 180));
      const created = await github(newPath, {
        method: "PUT",
        body: JSON.stringify({
          message: `chore(media): rename ${oldPath}`,
          content: String(current.content || "").replace(/\s/g, ""),
          branch: BRANCH,
        }),
      });
      await github(oldPath, {
        method: "DELETE",
        body: JSON.stringify({ message: `chore(media): remove old name ${oldPath}`, sha: current.sha, branch: BRANCH }),
      });
      return out(req, { ok: true, item: item(newPath, created.content?.size || 0, created.content?.sha || "") });
    }

    if (action === "optimize") {
      return out(req, { error: "Edge Function ortamında otomatik optimizasyon desteklenmiyor; media-processor workflow'u kullanılmalı." }, 501);
    }

    return out(req, { error: "Geçersiz işlem." }, 400);
  } catch (error) {
    console.error("[admin-github-media]", error);
    return out(req, { error: error instanceof Error ? error.message : "İşlem başarısız." }, (error as any)?.status || 400);
  }
});