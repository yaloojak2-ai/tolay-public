// Edge function "product-import": admin-only. Reads an official product page and copies approved images into storage.
// Never bypasses bot protection: a challenge/403/429 ends the request with a clear "blocked" answer.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { checkUrl, sourceOf, isBlockedPage, parseShopify, parseMaybelline, parseJsonLd, IMAGE_HOSTS, SOURCES } from "./parse.js";
const PAGE_HOSTS = Object.keys(SOURCES);

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const UA = "Mozilla/5.0 (compatible; TolayMakeupImporter/1.0; +https://tolaymakeup.store)";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// fetch with manual redirects (each hop re-checked against the allowlist), timeout and retry with backoff on 5xx/network only
async function safeFetch(raw: string, hosts: string[], accept: string) {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const c = checkUrl(url, hosts); if (!c.ok) throw new Error(c.why);
    let res: Response | null = null, lastErr: unknown = null;
    for (let a = 0; a < 3; a++) {
      try {
        res = await fetch(c.url.toString(), { redirect: "manual", headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(15000) });
        if (res.status < 500) break;
      } catch (e) { lastErr = e; res = null; }
      await sleep(500 * 2 ** a);
    }
    if (!res) throw new Error("ما قدرت أوصل للموقع: " + String(lastErr));
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location")!, c.url).toString(); continue; }
    return res;
  }
  throw new Error("تحويلات كثيرة");
}

async function extract(raw: string) {
  const c = checkUrl(raw); if (!c.ok) return { ok: false, error: c.why };
  const src = sourceOf(c.host)!;
  if (src.kind === "blocked") return { ok: false, blocked: true, source: src.name, error: `${src.name} بيمنع القراءة الآلية. استعمل زر «درجة من صورة» يدوياً.` };
  if (src.kind === "shopify") {
    const m = c.url.pathname.match(/\/products\/([^/?#.]+)/); if (!m) return { ok: false, error: "حط رابط صفحة منتج (فيه /products/)" };
    const res = await safeFetch(`${c.url.origin}/products/${m[1]}.json`, PAGE_HOSTS, "application/json");
    const body = await res.text();
    if (isBlockedPage(res.status, body)) return { ok: false, blocked: true, source: src.name, error: `${src.name} رفض الطلب (${res.status}). ما رح نتخطى الحماية، استعمل الإضافة اليدوية.` };
    if (!res.ok) return { ok: false, error: `الصفحة رجعت ${res.status}` };
    return { ok: true, source: src.name, data: parseShopify(JSON.parse(body), c.url.toString()) };
  }
  const res = await safeFetch(c.url.toString(), PAGE_HOSTS, "text/html");
  const html = await res.text();
  if (isBlockedPage(res.status, html)) return { ok: false, blocked: true, source: src.name, error: `${src.name} عامل حماية ضد القراءة الآلية (${res.status}). ما رح نتخطاها، استعمل زر «درجة من صورة» يدوياً.` };
  if (!res.ok) return { ok: false, error: `الصفحة رجعت ${res.status}` };
  const data = src.kind === "maybelline" ? parseMaybelline(html, c.url.toString()) : parseJsonLd(html, c.url.toString());
  return { ok: true, source: src.name, data };
}

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": b => b[0] === 0xff && b[1] === 0xd8, "image/png": b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
};
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 10 * 1024 * 1024;

async function importImages(admin: ReturnType<typeof createClient>, pid: number, urls: string[]) {
  const results = [];
  for (const u of urls.slice(0, 24)) {
    try {
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(u)))).map(b => b.toString(16).padStart(2, "0")).join("");
      const dir = `import/${pid}`;
      const { data: ex } = await admin.storage.from("shades").list(dir, { search: hash });
      if (ex?.length) { results.push({ url: u, ok: true, stored: admin.storage.from("shades").getPublicUrl(`${dir}/${ex[0].name}`).data.publicUrl, reused: true }); continue; }
      const res = await safeFetch(u, IMAGE_HOSTS, "image/avif,image/webp,image/png,image/jpeg,*/*");
      if (!res.ok) throw new Error(`الصورة رجعت ${res.status}`);
      const type = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (!EXT[type]) throw new Error("نوع ملف مش صورة مسموحة: " + type);
      const len = +(res.headers.get("content-length") || 0); if (len > MAX) throw new Error("الصورة أكبر من 10MB");
      const buf = new Uint8Array(await res.arrayBuffer()); if (buf.length > MAX) throw new Error("الصورة أكبر من 10MB");
      if (!MAGIC[type](buf)) throw new Error("محتوى الملف مش مطابق لنوعه");
      const path = `${dir}/${hash}.${EXT[type]}`;
      const up = await admin.storage.from("shades").upload(path, buf, { contentType: type, upsert: false });
      if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message);
      results.push({ url: u, ok: true, stored: admin.storage.from("shades").getPublicUrl(path).data.publicUrl });
      await sleep(250); // be gentle with the brand's CDN
    } catch (e) { results.push({ url: u, ok: false, error: e instanceof Error ? e.message : String(e) }); }
  }
  return results;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ error: "POST only" }, 405);
  const auth = req.headers.get("Authorization") || "";
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: aerr } = await user.rpc("am_admin");
  if (aerr || isAdmin !== true) return out({ error: "للأدمن فقط" }, 403);
  let body: any; try { body = await req.json(); } catch { return out({ error: "طلب غير صالح" }, 400); }
  try {
    if (body.action === "extract") return out(await extract(String(body.url || "")));
    if (body.action === "import") {
      const pid = Number(body.product_id); if (!Number.isInteger(pid) || pid <= 0) return out({ error: "رقم المنتج غلط" }, 400);
      const urls = [...new Set((body.urls || []).map(String))] as string[];
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      return out({ ok: true, results: await importImages(admin, pid, urls) });
    }
    return out({ error: "action غير معروف" }, 400);
  } catch (e) { return out({ ok: false, error: e instanceof Error ? e.message : String(e) }, 200); }
});
