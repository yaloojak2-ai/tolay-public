// Runs once in the page the admin is looking at, only when they press the button. Reads the page; changes nothing, clicks nothing.
(() => {
  const abs = u => { try { return new URL(u, location.href).href; } catch { return null; } };
  const hexOf = el => { const st = el.getAttribute("style") || "";
    const v = el.getAttribute("data-swatch-color") || el.getAttribute("data-color-hexa") || el.getAttribute("data-color") || el.getAttribute("data-hex") || el.getAttribute("data-attr-hex")
      || (st.match(/--swatch-colou?r\s*:\s*([^;]+)/i) || [])[1] || (st.match(/background(?:-color)?\s*:\s*(#[0-9a-f]{6})\b/i) || [])[1] || "";
    const m = String(v).trim().match(/^#?([0-9a-f]{6})$/i); return m ? "#" + m[1].toLowerCase() : null; };
  const nameOf = el => (el.getAttribute("data-shade-name") || el.getAttribute("data-display-name") || el.getAttribute("data-name") || el.getAttribute("data-attr-display-value") || el.getAttribute("aria-label") || el.getAttribute("title") || el.querySelector("img")?.alt || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const shades = [], seen = new Set();
  for (const el of document.querySelectorAll("[data-shade-name],[data-swatch-color],[data-color-hexa],[data-attr-hex],[style*='--swatch-color'],[class*='swatch'] [aria-label],[class*='shade'] [aria-label],[role=radiogroup] [role=radio]")) {
    const name = nameOf(el); if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue;
    let hex = hexOf(el); if (!hex) for (const c of el.querySelectorAll("*")) { hex = hexOf(c); if (hex) break; }
    const img = el.querySelector("img"); seen.add(name.toLowerCase());
    shades.push({ name, hex, thumb: img ? abs(img.currentSrc || img.src) : null });
  }
  const images = [], seenI = new Set(), add = (u, alt) => { const a = abs(u); if (a && a.startsWith("https://") && !seenI.has(a)) { seenI.add(a); images.push({ url: a, alt: alt || "" }); } };
  add(document.querySelector("meta[property='og:image']")?.content, "og:image");
  for (const im of document.images) if ((im.naturalWidth || 0) >= 400) add(im.currentSrc || im.src, im.alt);
  return { url: location.href, title: document.title, html: document.documentElement.outerHTML, dom: { shades, images } };
})();
