import { parseShopify, sourceOf, parseSfcc, parseJsonLd, parseMaybelline, classify, cleanImg } from "./parse.js";
// page -> product: the same parsers the admin uses; the generic reading of the page fills only what they miss
export function build(g) {
  const host = new URL(g.url).hostname.toLowerCase(), src = sourceOf(host);
  const tries = [];
  for (const f of src?.kind === "maybelline" ? [parseMaybelline] : [parseSfcc, parseJsonLd]) { try { tries.push(f(g.html, g.url)); } catch {} }
  if (g.shopify) try { tries.push(parseShopify(g.shopify, g.url)); } catch {}
  const best = tries.sort((a, b) => b.shades.length - a.shades.length)[0] || { brand: "", name: g.title.replace(/\s*[|–-].*$/, ""), shades: [], images: [] };
  const key = n => n.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "");
  if (!best.shades.length) best.shades = g.dom.shades.map(s => ({ name: s.name, code: (s.name.match(/^\s*(\d{2,4})\b/) || [])[1] || null, sku: null, barcode: null, hex: s.hex, swatch: s.thumb, pack: null }));
  else for (const s of best.shades) { const d = g.dom.shades.find(x => key(x.name) === key(s.name)); if (d && !s.hex && d.hex) s.hex = d.hex; }
  // NYX-style file names carry the shade number: …-BWMBT24-JAVA-0800897234539-… ; use it only when the name part is this shade
  for (const s of best.shades) if (!s.code && s.pack) { const m = s.pack.match(/[A-Z](\d{1,3})-([A-Z0-9-]+?)-0?\d{12,13}/); if (m && key(m[2]) === key(s.name)) s.code = m[1]; }
  const images = [...best.images], seen = new Set(images.map(i => i.url));
  for (const s of best.shades) if (s.swatch && !seen.has(s.swatch)) { seen.add(s.swatch); images.push({ url: s.swatch, type: "swatch", shade: s.name, alt: "" }); }
  for (const i of g.dom.images) { const u = cleanImg(i.url); if (!seen.has(u)) { seen.add(u); images.push({ url: u, type: classify({ src: u, alt: i.alt }, false) === "main" ? "gallery" : "lifestyle", shade: null, alt: i.alt }); } }
  // site chrome (seen live on NYX: service badges, chat icon, vendor logo) is never a product photo
  const chrome = /\.svg(\?|$)|logo|icon|services?-|badge|payment|-\d{2,3}x\d{2,3}\.(png|webp|jpe?g)/i;
  return { tolay: 1, source: "browser", brand: best.brand || src?.name || "", name: best.name, url: g.url, shades: best.shades, images: images.filter(i => i.shade || !chrome.test(i.url)) };
}

