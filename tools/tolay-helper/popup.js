import { isBlockedPage } from "./parse.js";
import { build } from "./build.js";
const $ = s => document.querySelector(s), msg = (t, err) => { $("#msg").textContent = t; $("#msg").className = err ? "err" : "hint"; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let found = null;

$("#go").onclick = async () => {
  msg("عم نقرأ…"); $("#list").innerHTML = ""; $("#save").hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/^https:/.test(tab?.url || "")) return msg("افتح صفحة منتج (https) أول.", true);
    const [{ result: g }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["grab.js"] });
    if (isBlockedPage(200, g.html) || /just a moment|access denied|attention required|captcha/i.test(g.title))
      return msg("الصفحة عم تعرض تحقق أو حماية. ما رح نكمل. خلّص التحقق بنفسك إذا بدك، أو استعمل ملفات المورّد بالأدمن.", true);
    found = build(g);
    if (!found.shades.length) return msg("ما لقيت درجات بهالصفحة. استعمل ملفات المورّد بالأدمن.", true);
    msg(`${found.brand} — ${found.name}: ${found.shades.length} درجة، ${found.images.length} صورة. شيل الإشارة عن أي إشي ما بدك ياه.`);
    $("#list").innerHTML = found.shades.map((s, i) => `<label class="row"><input type="checkbox" data-s="${i}" checked>${s.swatch || s.pack ? `<img src="${esc(s.swatch || s.pack)}" alt="">` : ""}<span>${esc(s.name)}</span>${s.hex ? `<span class="chip" style="background:${esc(s.hex)}"></span>` : ""}</label>`).join("")
      + `<p class="hint">صور المنتج:</p>` + found.images.filter(i => !i.shade).map((im, i) => `<label class="row"><input type="checkbox" data-i="${found.images.indexOf(im)}" ${im.type === "lifestyle" ? "" : "checked"}><img src="${esc(im.url)}" alt=""><span>${esc(im.type)}</span></label>`).join("");
    $("#save").hidden = false;
  } catch (e) { msg("ما زبطت القراءة: " + e.message, true); }
};

const b64 = buf => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
$("#save").onclick = async () => {
  const shades = found.shades.filter((_, i) => $(`[data-s="${i}"]`).checked), names = new Set(shades.map(s => s.name));
  const pick = found.images.filter((im, i) => im.shade ? names.has(im.shade) : $(`[data-i="${i}"]`)?.checked);
  const origins = [...new Set(pick.map(i => new URL(i.url).origin + "/*"))];
  // asked per click, only for the image hosts of this product
  if (origins.length && !await chrome.permissions.request({ origins })) return msg("بدون إذن ما بنقدر نجيب الصور. الملف رح ينزل بالروابط بس.", true);
  $("#save").disabled = true; let ok = 0;
  for (const [n, im] of pick.entries()) {
    msg(`عم نجيب الصور ${n + 1}/${pick.length}…`);
    try { const r = await fetch(im.url, { credentials: "omit", referrerPolicy: "no-referrer" }); // never sends the site's cookies
      const type = (r.headers.get("content-type") || "").split(";")[0];
      if (!r.ok || !/^image\/(png|jpeg|webp)$/.test(type)) throw new Error(r.status + " " + type);
      const buf = await r.arrayBuffer(); if (buf.byteLength > 10 * 1024 * 1024) throw new Error("أكبر من 10MB");
      im.data = b64(buf); im.mime = type; ok++;
    } catch (e) { im.error = String(e.message || e); }
  }
  const bundle = { ...found, shades, images: pick, saved: new Date().toISOString() };
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: "application/json" }));
  a.download = `tolay-${(found.brand + "-" + found.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}.json`; a.click();
  msg(`✓ نزل الملف: ${shades.length} درجة، ${ok}/${pick.length} صورة. ارفعه بالأدمن من «من المتصفح».${ok < pick.length ? " الصور اللي ما إجت رح تحاول من السيرفر، وإذا انمنعت بتطلع بالتقرير." : ""}`);
  $("#save").disabled = false;
};
