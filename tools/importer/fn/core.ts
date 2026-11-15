// Shared by the "product-import" edge function and its live test. Never bypasses bot protection:
// a challenge/403/429 ends the request with a clear "restricted" answer.
import { checkUrl, sourceOf, isBlockedPage, parseShopify, parseMaybelline, parseJsonLd, parseSfcc, IMAGE_HOSTS, SOURCES } from "./parse.js";
const PAGE_HOSTS = Object.keys(SOURCES);
const UA = "Mozilla/5.0 (compatible; TolayMakeupImporter/1.0; +https://tolaymakeup.store)";
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// manual redirects (each hop re-checked against the allowlist), timeout, retry with backoff on 5xx/network only. Never sends cookies.
export async function safeFetch(raw: string, hosts: string[], accept: string) {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const c = checkUrl(url, hosts); if (!c.ok) throw new Error(c.why);
    let res: Response | null = null, lastErr: unknown = null;
    for (let a = 0; a < 3; a++) {
      try { res = await fetch(c.url.toString(), { redirect: "manual", credentials: "omit", headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(15000) }); if (res.status < 500) break; }
      catch (e) { lastErr = e; res = null; }
      await sleep(500 * 2 ** a);
    }
    if (!res) throw new Error("ما قدرت أوصل للموقع: " + String(lastErr));
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location")!, c.url).toString(); continue; }
    return res;
  }
  throw new Error("تحويلات كثيرة");
}

const restricted = (name: string, why: string) => ({ ok: false, blocked: true, status: "restricted", source: name, error: `${name}: ${why}. ما رح نتخطى الحماية. استعمل «من المتصفح» أو «ملفات المورّد».` });
export async function extract(raw: string) {
  const c = checkUrl(raw); if (!c.ok) return { ok: false, status: "unsupported", error: c.why };
  const src = sourceOf(c.host)!;
  if (src.kind === "blocked") return restricted(src.name, src.why || "الموقع بيمنع القراءة الآلية");
  let res: Response;
  try { res = src.kind === "shopify"
      ? await (async () => { const m = c.url.pathname.match(/\/products\/([^/?#.]+)/); if (!m) throw new Error("حط رابط صفحة منتج (فيه /products/)"); return safeFetch(`${c.url.origin}/products/${m[1]}.json`, PAGE_HOSTS, "application/json"); })()
      : await safeFetch(c.url.toString(), PAGE_HOSTS, "text/html"); }
  catch (e) { const m = e instanceof Error ? e.message : String(e); return /مش من المواقع/.test(m) ? restricted(src.name, "الموقع حوّلنا لصفحة برّا الموقع الرسمي") : { ok: false, status: src.status, error: m }; }
  const body = await res.text();
  if (res.status === 401) return { ok: false, status: "auth", source: src.name, error: `${src.name} بيطلب تسجيل دخول أو مفتاح API. استعمل ملفات المورّد.` };
  if (isBlockedPage(res.status, body)) return restricted(src.name, `رفض الطلب (${res.status})`);
  if (!res.ok) return { ok: false, status: src.status, error: `الصفحة رجعت ${res.status}` };
  const u = c.url.toString();
  const data = src.kind === "shopify" ? parseShopify(JSON.parse(body), u) : src.kind === "maybelline" ? parseMaybelline(body, u) : src.kind === "sfcc" ? parseSfcc(body, u) : parseJsonLd(body, u);
  return { ok: true, status: "available", source: src.name, data };
}

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": b => b[0] === 0xff && b[1] === 0xd8, "image/png": b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
};
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 10 * 1024 * 1024;
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");

// bytes are stored exactly as the brand serves them (no re-encoding, so colours stay true); file name = SHA-1 of the bytes,
// so the same picture under two URLs is stored once and reported as a duplicate
// deno-lint-ignore no-explicit-any
export async function importImages(admin: any, dir: string, urls: string[]) {
  const results = [];
  for (const u of urls.slice(0, 24)) {
    try {
      const res = await safeFetch(u, IMAGE_HOSTS, "image/png,image/jpeg;q=0.9,*/*;q=0.1");
      if (isBlockedPage(res.status)) throw new Error(`الصورة محمية (${res.status})`);
      if (!res.ok) throw new Error(`الصورة رجعت ${res.status}`);
      const type = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (!EXT[type]) throw new Error("نوع ملف مش صورة مسموحة: " + type);
      if (+(res.headers.get("content-length") || 0) > MAX) throw new Error("الصورة أكبر من 10MB");
      const buf = new Uint8Array(await res.arrayBuffer()); if (buf.length > MAX) throw new Error("الصورة أكبر من 10MB");
      if (!MAGIC[type](buf)) throw new Error("محتوى الملف مش مطابق لنوعه");
      const hash = hex(await crypto.subtle.digest("SHA-1", buf)), path = `${dir}/${hash}.${EXT[type]}`;
      const up = await admin.storage.from("shades").upload(path, buf, { contentType: type, upsert: false });
      const dup = !!up.error && /exists|duplicate/i.test(up.error.message);
      if (up.error && !dup) throw new Error(up.error.message);
      results.push({ url: u, ok: true, stored: admin.storage.from("shades").getPublicUrl(path).data.publicUrl, hash, bytes: buf.length, type, dup });
      await sleep(250); // be gentle with the brand's CDN
    } catch (e) { results.push({ url: u, ok: false, error: e instanceof Error ? e.message : String(e) }); }
  }
  return results;
}
