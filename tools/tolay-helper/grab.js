// Runs once in the page the admin is looking at, only when they press the button. Reads the page; changes nothing, clicks nothing.
(async () => {
  const abs = u => { try { return new URL(u, location.href).href; } catch { return null; } };
  const hexOf = el => { const st = el.getAttribute("style") || "";
    const v = el.getAttribute("data-swatch-color") || el.getAttribute("data-color-hexa") || el.getAttribute("data-color") || el.getAttribute("data-hex") || el.getAttribute("data-attr-hex")
      || (st.match(/--swatch-colou?r\s*:\s*([^;]+)/i) || [])[1] || (st.match(/background(?:-color)?\s*:\s*(#[0-9a-f]{6})\b/i) || [])[1] || "";
    const m = String(v).trim().match(/^#?([0-9a-f]{6})$/i); return m ? "#" + m[1].toLowerCase() : null; };
  const nameOf = el => (el.getAttribute("data-shade-name") || el.getAttribute("data-display-name") || el.getAttribute("data-name") || el.getAttribute("data-attr-display-value") || el.getAttribute("aria-label") || el.getAttribute("title") || el.querySelector("img")?.alt || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
  // carousel/container labels, not shade names (seen live on NYX: "Slide 2 of 24", "Color swatches for …")
  const junk = /^(slide|item|image|page)\s*\d+\s*(of|\/)\s*\d+$|^colou?r swatch(es)? for\b|^(select|choose) (a )?(shade|colou?r)/i;
  const shades = [], seen = new Set();
  for (const el of document.querySelectorAll("[data-shade-name],[data-swatch-color],[data-color-hexa],[data-attr-hex],[style*='--swatch-color'],[class*='swatch'] [aria-label],[class*='shade'] [aria-label],[role=radiogroup] [role=radio]")) {
    const name = nameOf(el); if (!name || name.length < 2 || junk.test(name) || seen.has(name.toLowerCase())) continue;
    let hex = hexOf(el); if (!hex) for (const c of el.querySelectorAll("*")) { hex = hexOf(c); if (hex) break; }
    const img = el.querySelector("img"); seen.add(name.toLowerCase());
    shades.push({ name, hex, thumb: img ? abs(img.currentSrc || img.src) : null });
  }
  // shades as links (?Color=Light%2FMedium, e.l.f.) or as a real <select>: name from the link / option text
  const push = (name, el) => { name = (name || "").replace(/\s+/g, " ").trim(); if (!name || name.length < 2 || junk.test(name) || seen.has(name.toLowerCase())) return; seen.add(name.toLowerCase());
    let hex = el && hexOf(el); if (!hex && el) for (const c of el.querySelectorAll("*")) { hex = hexOf(c); if (hex) break; }
    const img = el?.querySelector?.("img"); let thumb = img ? abs(img.currentSrc || img.src) : null;
    if (!thumb && el) for (const c of [el, ...el.querySelectorAll("*")]) { const m = (getComputedStyle(c).backgroundImage || "").match(/url\(["']?([^"')]+)/); if (m) { thumb = abs(m[1]); break; } }
    shades.push({ name, hex, thumb }); };
  for (const a of document.querySelectorAll("a[href*='olor='],a[href*='hade=']")) { try { const u = new URL(a.href, location.href); if (u.pathname !== location.pathname) continue;
    const nm = (u.searchParams.get("Color") || u.searchParams.get("color") || u.searchParams.get("Colour") || u.searchParams.get("Shade") || u.searchParams.get("shade") || "").replace(/\s+/g, " ").trim();
    // the same shade is often already found as a swatch button: give it the link instead of skipping it
    const had = shades.find(s => s.name.toLowerCase() === nm.toLowerCase()); if (had) { had.href ||= u.href; const ti = a.querySelector("img"); if (!had.thumb && ti) had.thumb = abs(ti.currentSrc || ti.src); continue; }
    const n = shades.length; push(nm, a); if (shades.length > n) shades[n].href = u.href; } catch {} }
  // each shade link is its own page on the official site: its og:image is that shade's packshot (seen on e.l.f.), photos whose alt names the shade go with it
  const linked = shades.filter(s => s.href).slice(0, 40);
  if (linked.length > 1) { for (const s of linked) try { const r = await fetch(s.href, { credentials: "omit" }); if (!r.ok) continue;
      const d = new DOMParser().parseFromString(await r.text(), "text/html"), k = s.name.toLowerCase();
      s.pack = abs(d.querySelector("meta[property='og:image']")?.content || "");
      s.imgs = [...new Set([...d.images].filter(i => (i.alt || "").toLowerCase().includes(k)).map(i => abs(i.getAttribute("src") || "")).filter(u => u && u.startsWith("https://") && u !== s.pack))].slice(0, 6);
    } catch {}
    // a photo two shade pages share is the generic product shot, not that variant's own photo: drop it, keep the rest
    const n = {}; linked.forEach(s => { if (s.pack) n[s.pack] = (n[s.pack] || 0) + 1; }); linked.forEach(s => { if (n[s.pack] > 1) { s.pack = null; s.imgs = []; } }); } // same picture for every shade = the site does not change it per shade
  for (const sel of document.querySelectorAll("select")) if (/shade|colou?r/i.test([sel.name, sel.id, sel.getAttribute("aria-label")].join(" "))) for (const o of sel.options) if (o.value) push(o.text, null);
  const images = [], seenI = new Set(), add = (u, alt) => { const a = abs(u); if (a && a.startsWith("https://") && !seenI.has(a)) { seenI.add(a); images.push({ url: a, alt: alt || "" }); } };
  add(document.querySelector("meta[property='og:image']")?.content, "og:image");
  for (const im of document.images) if ((im.naturalWidth || 0) >= 400) add(im.currentSrc || im.src, im.alt);
  // Shopify stores keep shades in a dropdown: read the store's own public product data (same site, no cookies)
  let shopify = null; const h = location.pathname.match(/\/products\/([^\/?#]+)/);
  if (h) try { const r = await fetch(`${location.origin}/products/${h[1]}.json`, { credentials: "omit" }); if (r.ok) shopify = await r.json(); } catch {}
  return { url: location.href, title: document.title, html: document.documentElement.outerHTML, dom: { shades, images }, shopify };
})();
