// Tolay product importer: pure parsing + matching (no network). Shared by the edge function and the node tests.
// Every value comes from the page; nothing is invented. Missing data stays missing.

// Official sources. Key = hostname suffix. kind picks the adapter.
export const SOURCES = {
  "rarebeauty.com": { name: "Rare Beauty", kind: "shopify" },
  "tartecosmetics.com": { name: "Tarte Cosmetics", kind: "shopify" },
  "maccosmetics.com": { name: "MAC Cosmetics", kind: "shopify" },
  "maybelline.com": { name: "Maybelline", kind: "maybelline" },
  "narscosmetics.com": { name: "NARS Cosmetics", kind: "jsonld" },
  "lorealparis.com": { name: "L'Oréal Paris", kind: "jsonld" },
  "nyxcosmetics.com": { name: "NYX Professional Makeup", kind: "jsonld" },
  "sephora.com": { name: "Sephora", kind: "blocked" },
};
// image hosts we may download from (official brand sites and their CDNs)
export const IMAGE_HOSTS = ["cdn.shopify.com", "rarebeauty.com", "tartecosmetics.com", "maccosmetics.com", "maybelline.com", "narscosmetics.com", "lorealparis.com", "nyxcosmetics.com"];

const hostOk = (h, list) => list.some(d => h === d || h.endsWith("." + d));

// URL check: https only, no credentials/ports, host must be a known official source (this allowlist is the SSRF guard)
export function checkUrl(raw, hosts = Object.keys(SOURCES)) {
  let u; try { u = new URL(String(raw).trim()); } catch { return { ok: false, why: "رابط غير صالح" }; }
  if (u.protocol !== "https:") return { ok: false, why: "لازم الرابط يبدأ بـ https" };
  if (u.username || u.password || u.port) return { ok: false, why: "رابط غير مسموح" };
  const h = u.hostname.toLowerCase();
  if (!hostOk(h, hosts)) return { ok: false, why: "هالموقع مش من المواقع الرسمية المدعومة" };
  return { ok: true, url: u, host: h };
}
export const sourceOf = host => { const k = Object.keys(SOURCES).find(d => host === d || host.endsWith("." + d)); return k ? { domain: k, ...SOURCES[k] } : null; };

// bot walls / challenges: we stop, never try to get around them
export function isBlockedPage(status, body = "") {
  if (status === 403 || status === 429 || status === 503) return true;
  return /<title>\s*(Just a moment|Attention Required|Access Denied)/i.test(body) || /challenges\.cloudflare\.com|_Incapsula_Resource|px-captcha/i.test(body);
}

const decode = s => String(s ?? "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[®™]/g, "").replace(/\s+/g, " ").trim();
const stripTags = s => decode(String(s || "").replace(/<[^>]+>/g, " "));
export const cleanImg = u => { try { const x = new URL(u); x.hash = ""; for (const k of ["rev", "width", "height", "w", "h", "crop", "sw", "sh"]) x.searchParams.delete(k); return x.toString(); } catch { return u; } };
export const norm = s => decode(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
const keyOf = s => norm(s).replace(/\s+/g, "");

// ---------- image classification ----------
const LIFE = /shade[-_ ]?grid|applied on|model|collage|lifestyle|arm[-_ ]?swatch|forearm|hands?\b|comparison|before[-_ ]?after|video[-_ ]?still|editorial/i;
const SWATCH = /swatch|texture|smear|\bsw\b/i;
export function classify({ src = "", alt = "" }, shadeNamed) {
  const t = src.split("/").pop() + " " + alt;
  if (LIFE.test(t)) return "lifestyle";
  if (SWATCH.test(t)) return shadeNamed ? "swatch" : "lifestyle";
  return shadeNamed ? "packaging" : "main";
}

// which shade an image belongs to: alt "Hope| ..." or alt === shade, or the shade as a whole word in the file name
function shadeOfImage(img, shades) {
  const alt = decode(img.alt || ""), pre = alt.includes("|") ? alt.split("|")[0] : alt;
  let s = shades.find(x => keyOf(x.name) === keyOf(pre));
  if (s) return s;
  const file = norm((img.src || "").split("/").pop().split("?")[0].replace(/\.[a-z]+$/i, "").replace(/_[0-9a-f-]{20,}$/i, ""));
  const hits = shades.filter(x => keyOf(x.name).length > 2 && new RegExp(`(^| )${norm(x.name).replace(/ /g, " ")}( |$)`).test(file));
  return hits.length === 1 ? hits[0] : null;
}

// ---------- adapters ----------
export function parseShopify(json, pageUrl) {
  const p = json?.product; if (!p) throw new Error("ما لقيت بيانات المنتج");
  const shadeOpt = (p.options || []).findIndex(o => /shade|colou?r|درجة|لون/i.test(o.name));
  const oi = shadeOpt >= 0 ? shadeOpt : (p.variants?.length > 1 ? 0 : -1);
  const shades = oi < 0 ? [] : (p.variants || []).map(v => ({ name: decode(v[`option${oi + 1}`] || v.title), code: null, sku: v.sku || null, barcode: v.barcode || null, hex: null, vid: v.id, swatch: null, pack: v.featured_image?.src ? cleanImg(v.featured_image.src) : null }));
  const images = [], seen = new Set(), unknownShade = [];
  for (const im of (p.images || []).sort((a, b) => (a.position || 0) - (b.position || 0))) {
    const src = cleanImg(im.src); if (!src || seen.has(src)) continue; seen.add(src);
    let s = (im.variant_ids || []).length ? shades.find(x => im.variant_ids.includes(x.vid)) : null;
    if (!s) s = shadeOfImage(im, shades);
    const altPre = decode(im.alt || "").split("|")[0];
    const looksShadeOnly = !s && altPre && !/ /.test(altPre.trim()) && altPre.length < 25; // e.g. alt "Resilience" for a shade not on this page
    const type = classify(im, !!s || looksShadeOnly);
    if (!s && looksShadeOnly && type !== "lifestyle") { unknownShade.push(src); continue; }
    images.push({ url: src, type, shade: s?.name || null, w: im.width || null, h: im.height || null, alt: decode(im.alt || "") });
    if (s && type === "swatch" && !s.swatch) s.swatch = src;
    if (s && type === "packaging" && !s.pack) s.pack = src;
  }
  return { brand: decode(p.vendor || ""), name: decode(p.title || ""), description: stripTags(p.body_html || "").slice(0, 2000), sku: null, url: pageUrl, shades: shades.map(({ vid, ...s }) => s), images, skipped: unknownShade.length };
}

export function parseMaybelline(html, pageUrl) {
  const name = stripTags((html.match(/class="product__header-name"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  const attr = (tag, a) => { const m = tag.match(new RegExp(`\\s${a}="([^"]*)"`)); return m ? decode(m[1]) : null; };
  const shades = [], seenS = new Set();
  for (const m of html.matchAll(/<input[^>]*shade-selector__input[^>]*>/g)) {
    const t = m[0], n = attr(t, "data-display-name") || attr(t, "data-name"); if (!n || seenS.has(n)) continue; seenS.add(n);
    const c = attr(t, "data-color");
    shades.push({ name: n, code: attr(t, "data-code"), sku: null, barcode: attr(t, "data-variant-ean"), hex: c && /^[0-9a-f]{6}$/i.test(c) ? "#" + c.toLowerCase() : null, swatch: null, pack: null });
  }
  // product images live under the product's own media folder; per-shade files carry the shade's UPC/EAN
  const slug = new URL(pageUrl).pathname.split("/").filter(Boolean).pop() || "";
  const images = [], seen = new Set();
  for (const m of html.matchAll(/https:\/\/www\.maybelline\.com\/-\/media\/[^"' )]+?\.(?:jpe?g|png|webp)(?:\?[^"' )]*)?/gi)) {
    const src = cleanImg(decode(m[0])); if (seen.has(src) || !slug || !src.includes("/" + slug + "/")) continue; seen.add(src);
    const s = shades.find(x => x.barcode && src.includes(x.barcode.replace(/^0+/, "")));
    const type = classify({ src }, !!s);
    images.push({ url: src, type, shade: s?.name || null, w: null, h: null, alt: "" });
    if (s && type === "packaging" && !s.pack) s.pack = src;
  }
  return { brand: "Maybelline", name, description: "", sku: null, url: pageUrl, shades, images, skipped: 0 };
}

export function parseJsonLd(html, pageUrl) {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
  const flat = blocks.flatMap(b => Array.isArray(b) ? b : b["@graph"] || [b]);
  const p = flat.find(b => /^(Product|ProductGroup)$/.test([].concat(b["@type"])[0]));
  if (!p) throw new Error("الصفحة ما فيها بيانات منتج منظمة (JSON-LD)");
  const imgs = v => [].concat(v || []).map(x => typeof x === "string" ? x : x?.url || x?.contentUrl).filter(Boolean);
  const vars = [].concat(p.hasVariant || []);
  const shades = vars.map(v => ({ name: decode(v.color || (v.name || "").replace(decode(p.name), "").replace(/^[\s\-–|:]+/, "")), code: null, sku: v.sku || null, barcode: v.gtin13 || v.gtin12 || v.gtin || null, hex: null, swatch: null, pack: imgs(v.image)[0] ? cleanImg(imgs(v.image)[0]) : null })).filter(s => s.name);
  const images = [], seen = new Set();
  for (const u of imgs(p.image)) { const src = cleanImg(u); if (!seen.has(src)) { seen.add(src); images.push({ url: src, type: classify({ src }, false), shade: null, w: null, h: null, alt: "" }); } }
  for (const s of shades) if (s.pack && !seen.has(s.pack)) { seen.add(s.pack); images.push({ url: s.pack, type: "packaging", shade: s.name, w: null, h: null, alt: "" }); }
  const brand = typeof p.brand === "string" ? p.brand : p.brand?.name || "";
  return { brand: decode(brand), name: decode(p.name || ""), description: decode(p.description || "").slice(0, 2000), sku: p.sku || p.productGroupID || null, url: pageUrl, shades, images, skipped: 0 };
}

// ---------- shade matching against the shades already on the product ----------
// exact SKU/barcode -> exact code -> normalized name -> careful fuzzy (only suggests, never auto-applies)
export function matchShades(extracted, existing) {
  const ex = existing.map((e, i) => ({ ...e, i, k: keyOf(e.name) }));
  const counts = {}; extracted.forEach(s => { const k = keyOf(s.name); counts[k] = (counts[k] || 0) + 1; });
  return extracted.map(s => {
    const k = keyOf(s.name);
    let hit = (s.sku && ex.find(e => e.sku && e.sku === s.sku)) || (s.barcode && ex.find(e => e.barcode && e.barcode === s.barcode));
    let how = hit ? "sku" : null;
    if (!hit && s.code) { hit = ex.find(e => e.code && String(e.code) === String(s.code)); how = hit ? "code" : null; }
    if (!hit) { hit = ex.find(e => e.k === k); how = hit ? "name" : null; }
    let status = hit ? "matched" : "new", suggest = null;
    if (!hit) { // fuzzy: same leading number ("102" vs "102 Fair Ivory") or one name contains the other; admin must confirm
      const num = (s.name.match(/^\s*(\d{2,4})\b/) || [])[1];
      const f = ex.filter(e => (num && new RegExp(`^\\s*0*${num}\\b`).test(e.name)) || (k.length > 3 && e.k.length > 3 && (e.k.includes(k) || k.includes(e.k))));
      if (f.length === 1) { status = "review"; suggest = f[0].i; }
    }
    if (counts[k] > 1) status = "duplicate";
    const missingImage = !s.swatch && !s.pack;
    return { ...s, status, match: hit ? hit.i : null, how, suggest, missingImage };
  });
}
