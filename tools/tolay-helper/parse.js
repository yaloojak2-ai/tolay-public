// Tolay product importer: pure parsing + matching (no network). Shared by the edge function and the node tests.
// Every value comes from the page; nothing is invented. Missing data stays missing.

// Official sources. Key = hostname suffix. kind picks the adapter.
// status: available = tested end to end from our server; restricted = the site blocks automated reading (use browser mode or supplier files)
export const SOURCES = {
  "rarebeauty.com": { name: "Rare Beauty", kind: "shopify", status: "available" },
  "tartecosmetics.com": { name: "Tarte Cosmetics", kind: "shopify", status: "available" },
  "maccosmetics.com": { name: "MAC Cosmetics", kind: "shopify", status: "available" },
  "maybelline.com": { name: "Maybelline", kind: "maybelline", status: "available" },
  "narscosmetics.com": { name: "NARS Cosmetics", kind: "sfcc", status: "available" },
  "lorealparis.com": { name: "L'Oréal Paris", kind: "jsonld", status: "restricted", why: "الموقع بيحوّل سيرفرنا لموقع بلد ثاني" },
  "nyxcosmetics.com": { name: "NYX Professional Makeup", kind: "sfcc", status: "restricted", why: "حماية Cloudflare ضد القراءة الآلية" },
  "sephora.com": { name: "Sephora", kind: "blocked", status: "restricted", why: "حماية Akamai ضد القراءة الآلية" },
};
export const STATUS = { available: ["متاح", "#1f9d55"], restricted: ["مقيّد", "#d97706"], auth: ["يحتاج تفويض", "#7c3aed"], unsupported: ["غير مدعوم", "#6b7280"] };
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

// Salesforce Commerce Cloud shade lists (NARS; also NYX pages saved by the browser helper):
// <li data-shade-name="777 Orgasm"> <a class="swatchanchor" href="...dwvar_X_color=ID" data-lgimg='{"url":...}'> <div class="swatch-block" style="background-color:#faa7a6">
export function parseSfcc(html, pageUrl) {
  const shades = [], images = [], seen = new Set();
  const og = (html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) || [])[1];
  const title = (html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) || [])[1] || (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  for (const m of html.matchAll(/<li[^>]*data-shade-name="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)) {
    const name = decode(m[1]), body = m[2];
    if (shades.some(s => s.name === name)) continue;
    const hex = (decode(body).match(/swatch-block"[^>]*background-color:\s*#?([0-9a-f]{6})/i) || [])[1];
    const id = (body.match(/dwvar_[^=]+_color=([\w-]+)/) || [])[1] || null;
    const lg = (body.match(/data-lgimg='([^']+)'/) || [])[1]; // the live attribute is not always valid JSON, so read the url field directly
    const lu = lg && (decode(lg).match(/"url"\s*:\s*"(https:[^"]+)"/) || [])[1], img = lu ? cleanImg(lu) : null;
    // NARS names each shade photo by the shade's UPC (0194251171746_1.jpg)
    const s = { name, code: (name.match(/^\s*(\d{2,4})\b/) || [])[1] || null, sku: id, barcode: (img?.match(/\/0*(\d{12,13})_\d+\.(?:jpe?g|png|webp)/i) || [])[1] || null, hex: hex ? "#" + hex.toLowerCase() : null, swatch: null, pack: null };
    if (img && !seen.has(img)) { seen.add(img); const type = classify({ src: img }, true) === "swatch" && !/pdpcrop|soldier|packshot|compact/i.test(img) ? "swatch" : "packaging";
      images.push({ url: img, type, shade: name, w: null, h: null, alt: "" }); s[type === "swatch" ? "swatch" : "pack"] = img; }
    shades.push(s);
  }
  if (og) { const src = cleanImg(decode(og)); if (!seen.has(src)) images.unshift({ url: src, type: "main", shade: null, w: null, h: null, alt: "" }); }
  let brand = "", name = decode(title).replace(/\s*\|.*$/, "");
  try { const ld = parseJsonLd(html, pageUrl); brand = ld.brand; name = ld.name || name; } catch {}
  return { brand, name, description: "", sku: null, url: pageUrl, shades, images, skipped: 0 };
}

// ---------- mode 2: supplier / brand files ----------
// CSV with quotes; delimiter guessed from the header line (, ; or tab)
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, ""); const first = text.split(/\r?\n/)[0] || "";
  const d = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const out = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === d) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c; }
  if (cell || row.length) { row.push(cell); out.push(row); }
  const [head, ...rest] = out.filter(r => r.some(x => x.trim()));
  return head ? rest.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()]))) : [];
}
const COLS = { // header aliases (lower-case, spaces/underscores ignored)
  shade: ["shade", "shadename", "name", "color", "colour", "colorname", "variant", "variantname", "درجة", "اسمالدرجة", "اللون"],
  sku: ["sku", "itemnumber", "itemno", "article", "reference"], barcode: ["barcode", "ean", "upc", "gtin", "ean13", "باركود"],
  code: ["code", "shadecode", "shadenumber", "number", "no", "رقم", "رقمالدرجة"], hex: ["hex", "colorhex", "colourhex", "swatchcolor", "swatchhex"],
  swatch: ["swatch", "swatchimage", "swatchfile", "texture", "صورةالدرجة"], pack: ["packaging", "pack", "packshot", "productimage", "image", "imagefile", "صورة"],
  gallery: ["gallery", "images", "galleryimages", "lifestyle"], main: ["main", "mainimage", "hero"], brand: ["brand", "العلامة"], product: ["product", "productname", "المنتج"],
};
const col = (row, k) => { const keys = Object.keys(row); const hit = keys.find(h => COLS[k].includes(h.toLowerCase().replace(/[\s_\-]+/g, ""))); return hit ? String(row[hit] ?? "").trim() : ""; };
const refs = v => String(v || "").split(/[|;\n]+/).map(x => x.trim()).filter(Boolean);
const HEX = v => { const m = String(v || "").trim().match(/^#?([0-9a-f]{6})$/i); return m ? "#" + m[1].toLowerCase() : null; };
// rows (from CSV / Excel / JSON array) -> the same shape the page adapters return. Image values are file names or https URLs.
export function fromRows(rows) {
  const shades = [], images = [], add = (ref, type, shade) => { if (!images.some(i => i.ref === ref && i.shade === shade)) images.push({ ref, type, shade, alt: "" }); };
  let brand = "", name = "";
  for (const r of rows) {
    brand ||= col(r, "brand"); name ||= col(r, "product");
    refs(col(r, "main")).forEach(x => add(x, "main", null)); refs(col(r, "gallery")).forEach(x => add(x, "gallery", null));
    const n = col(r, "shade"); if (!n) continue;
    const s = { name: n, code: col(r, "code") || null, sku: col(r, "sku") || null, barcode: col(r, "barcode") || null, hex: HEX(col(r, "hex")), swatch: refs(col(r, "swatch"))[0] || null, pack: refs(col(r, "pack"))[0] || null };
    if (s.swatch) add(s.swatch, "swatch", n); if (s.pack) add(s.pack, "packaging", n);
    shades.push(s);
  }
  return { brand, name, description: "", sku: null, url: null, shades, images, skipped: 0 };
}
// loose image files (from a ZIP or picked by hand) -> which shade each belongs to, by SKU/barcode/code/name as a whole word in the file name.
// A file that fits no shade (or more than one) is never given to a shade; it stays as a product image for the admin to look at.
export function matchFiles(names, shades) {
  const key = f => norm(f.split("/").pop().replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " "));
  const word = (hay, w) => w && new RegExp(`(^| )${norm(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(hay);
  return names.map(f => { const k = key(f);
    let hit = shades.filter(s => [s.sku, s.barcode].some(v => v && word(k, v)));
    if (hit.length !== 1) hit = shades.filter(s => s.code && word(k, s.code));
    if (hit.length !== 1) { hit = shades.filter(s => keyOf(s.name).length > 1 && word(k, s.name));
      if (hit.length > 1) hit = hit.filter(s => !hit.some(o => o !== s && word(norm(o.name), s.name))); } // "Orgasm Edge" file: Orgasm Edge wins over Orgasm
    const s = hit.length === 1 ? hit[0] : null;
    return { file: f, shade: s?.name || null, type: classify({ src: f.split("/").pop() }, !!s) };
  });
}
// ZIP / folder without a sheet: shades come from the file names themselves ("102 Fair Ivory - swatch.png")
export function shadesFromFiles(names) {
  const tidy = f => decode(f.split("/").pop().replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").replace(/\s*[-–]?\s*\b(swatch|texture|smear|pack(aging|shot)?|box|product|main|front|back|\d{3,4}x\d{3,4})\b.*$/i, "")).trim();
  const seen = new Set(), out = [];
  for (const f of names) { if (classify({ src: f.split("/").pop() }, true) === "lifestyle") continue; const n = tidy(f); const k = keyOf(n);
    if (n && !seen.has(k) && !/^(main|hero|gallery|cover|front|back|img|image|dsc)\s*\d*$/i.test(n)) { seen.add(k); out.push({ name: n, code: (n.match(/^\s*(\d{2,4})\b/) || [])[1] || null, sku: null, barcode: null, hex: null, swatch: null, pack: null }); } }
  return out;
}
// file bundle saved by the Tolay browser helper (mode 3): already parsed on the admin's own screen, images inline as base64
export function parseBundle(j) {
  if (!j || j.tolay !== 1 || !Array.isArray(j.shades)) throw new Error("مش ملف من إضافة Tolay");
  const shades = j.shades.map(s => ({ name: String(s.name || "").trim(), code: s.code || null, sku: s.sku || null, barcode: s.barcode || null, hex: HEX(s.hex), conf: s.conf === "sampled" ? "sampled" : null, swatch: s.swatch || null, pack: s.pack || null })).filter(s => s.name);
  const images = (j.images || []).filter(i => i && i.url).map(i => ({ url: String(i.url), type: i.type || "gallery", shade: i.shade || null, alt: i.alt || "", data: i.data || null, mime: i.mime || null }));
  return { brand: String(j.brand || ""), name: String(j.name || ""), description: "", sku: null, url: j.url || null, shades, images, skipped: 0 };
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
