// Official-site importer (admin only): reads a brand product page through the "product-import" edge function,
// shows shades + images for review, then copies the approved images into storage and fills the shade rows.
// Nothing is written to the product until the admin presses the normal Save button.
import { sourceOf, matchShades } from "./tools/importer/parse.js";

const ST = { matched: ["مطابقة", "#1f9d55"], new: ["درجة جديدة", "#2563eb"], review: ["بدها مراجعة", "#d97706"], duplicate: ["مكررة", "#dc2626"] };
const TYPE = { main: "رئيسية", packaging: "علبة", swatch: "تستر", gallery: "معرض", lifestyle: "لايف ستايل" };
const h = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fn = async body => { const { data, error } = await db.functions.invoke("product-import", { body }); if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); } return data; };

const dlg = document.createElement("dialog"); dlg.className = "wide"; dlg.id = "impDlg";
dlg.innerHTML = `<button class="x" type="button" data-close aria-label="إغلاق">✕</button><div class="odb">
<h2 style="margin:0">🌐 استيراد صور ودرجات المنتج من الموقع الرسمي</h2>
<div class="hint">الصق رابط صفحة المنتج من موقع العلامة الرسمي. بنقرأ الصفحة بس إذا الموقع بيسمح، وما بنتخطى أي حماية. ما بينحفظ إشي على المنتج قبل ما تضغط «حفظ» بنموذج المنتج.</div>
<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="impUrl" type="url" dir="ltr" placeholder="https://www.rarebeauty.com/products/..." style="flex:1;min-width:240px"><button class="sm" type="button" id="impGo" style="background:var(--p,#e5007d);color:#fff">قراءة الصفحة</button></div>
<div id="impSrc" class="hint"></div><div id="impOut"></div></div>`;
document.body.append(dlg);

let data = null, rows = [], cancel = false, mainUrl = null;
const out = () => dlg.querySelector("#impOut");
dlg.querySelector("#impUrl").addEventListener("input", e => {
  let t = ""; try { const u = new URL(e.target.value.trim()); const s = sourceOf(u.hostname.toLowerCase());
    t = !s ? "❌ هاد مش موقع رسمي مدعوم" : s.kind === "blocked" ? `⛔ ${s.name}: الموقع بيمنع القراءة الآلية، استعمل الإضافة اليدوية` : `✓ المصدر: ${s.name}`; } catch {}
  dlg.querySelector("#impSrc").textContent = t;
});

const existing = () => [...$("#swList").children].map(d => ({ el: d, name: d.querySelector("[type=text]").value.trim(), sku: d._m?.sku, barcode: d._m?.barcode, code: d._m?.code }));

dlg.querySelector("#impGo").onclick = async () => {
  const url = dlg.querySelector("#impUrl").value.trim(); if (!url) return;
  out().innerHTML = `<p class="hint">⏳ عم نقرأ الصفحة…</p>`;
  try { const r = await fn({ action: "extract", url });
    if (!r.ok) { out().innerHTML = `<p style="color:var(--danger)">${h(r.error)}</p>${r.blocked ? `<button class="sm" type="button" id="impManual">🖼️ أضيف الدرجات يدوياً من صور</button>` : ""}`;
      const b = out().querySelector("#impManual"); if (b) b.onclick = () => { dlg.close(); $("#addSwImg").click(); }; return; }
    data = r.data; render();
  } catch (e) { out().innerHTML = `<p style="color:var(--danger)">${h(e.message)}</p>`; }
};

function render() {
  const ex = existing(); mainUrl = null;
  rows = matchShades(data.shades, ex).map(s => ({ ...s, img: s.swatch || s.pack, on: s.status === "matched", to: s.match ?? s.suggest ?? "new", ex }));
  const opts = ex.map((e, i) => `<option value="${i}">← ${h(e.name || "درجة بدون اسم")}</option>`).join("");
  const mains = data.images.filter(i => i.type === "main" || i.type === "packaging");
  out().innerHTML = `
<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b>${h(data.brand)} — ${h(data.name)}</b><a class="hint" href="${h(data.url)}" target="_blank" rel="noopener">الصفحة الأصلية</a></div>
<details><summary>الصور (${data.images.length})${data.skipped ? ` · ${data.skipped} صورة لدرجات مش موجودة بالصفحة انتركت` : ""}</summary>
<div class="hint">اختار صورة رئيسية للمنتج إذا بدك تغيّرها (اختياري):</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:6px">
<label style="font-size:11px;text-align:center"><input type="radio" name="impMain" value="" checked><br>بدون تغيير</label>
${data.images.map((im, i) => `<label style="font-size:11px;text-align:center;display:flex;flex-direction:column;gap:2px"><img src="${h(im.url)}" loading="lazy" alt="" style="width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:8px;border:1px solid var(--line)">
<span>${TYPE[im.type] || im.type}${im.shade ? " · " + h(im.shade) : ""}</span>${mains.includes(im) ? `<span><input type="radio" name="impMain" value="${i}"> رئيسية</span>` : ""}</label>`).join("")}</div></details>
<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><b>الدرجات (${rows.length})</b>
<button class="sm" type="button" data-all="1">تحديد الكل</button><button class="sm" type="button" data-all="0">إلغاء الكل</button><button class="sm" type="button" id="impRev">عرض اللي بدها مراجعة بس</button></div>
<div id="impGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px">
${rows.map((s, i) => `<div class="tk" data-i="${i}" data-st="${s.status}">
<div style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-on ${s.on ? "checked" : ""} aria-label="اختيار">
${s.img ? `<img src="${h(s.img)}" alt="" loading="lazy" style="width:56px;height:56px;object-fit:contain;background:#fff;border-radius:8px">` : `<span class="hint" style="width:56px">بدون صورة</span>`}
<div style="min-width:0"><b>${h(s.name)}</b><small class="hint" style="display:block" dir="ltr">${h([s.code, s.sku, s.barcode].filter(Boolean).join(" · "))}</small>
${s.hex ? `<span title="لون رسمي من الصفحة" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${h(s.hex)};vertical-align:middle"></span> <small dir="ltr">${h(s.hex)}</small>` : ""}</div></div>
<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="pill" style="color:${ST[s.status][1]};border-color:${ST[s.status][1]}">${ST[s.status][0]}${s.how ? ` (${s.how === "sku" ? "SKU/باركود" : s.how === "code" ? "رقم" : "اسم"})` : ""}</span>${s.missingImage ? `<span class="pill">ما في صورة</span>` : ""}</div>
<select data-to aria-label="وين تنحط"><option value="new">+ درجة جديدة</option>${opts}</select></div>`).join("")}</div>
<label class="hint"><input type="checkbox" id="impCut"> شيل الخلفية عن صور الدرجات (الأصلية بتضل محفوظة)</label>
<label class="hint"><input type="checkbox" id="impLic"> أأكد إنو مسموح إلي أستعمل صور هالعلامة بالمتجر (منتج أصلي ومحتوى رسمي)</label>
<div id="impSum" class="hint"></div>
<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="sm" type="button" id="impOk" style="background:var(--p,#e5007d);color:#fff">اعتماد ورفع جميع الصور والدرجات</button><button class="sm" type="button" id="impStop" hidden>إيقاف</button></div>
<progress id="impBar" value="0" max="1" hidden style="width:100%"></progress><div id="impRep"></div>`;
  out().querySelectorAll("#impGrid [data-i]").forEach(c => { const s = rows[c.dataset.i]; c.querySelector("[data-to]").value = String(s.to);
    c.querySelector("[data-on]").onchange = e => { s.on = e.target.checked; sum(); };
    c.querySelector("[data-to]").onchange = e => { s.to = e.target.value; sum(); }; });
  out().querySelectorAll("[data-all]").forEach(b => b.onclick = () => { rows.forEach(s => s.on = b.dataset.all === "1"); out().querySelectorAll("[data-on]").forEach(x => x.checked = b.dataset.all === "1"); sum(); });
  out().querySelector("#impRev").onclick = e => { const only = e.target.dataset.only !== "1"; e.target.dataset.only = only ? "1" : "0"; e.target.textContent = only ? "عرض الكل" : "عرض اللي بدها مراجعة بس";
    out().querySelectorAll("#impGrid [data-i]").forEach(c => c.hidden = only && c.dataset.st === "matched"); };
  out().querySelectorAll("[name=impMain]").forEach(r => r.onchange = () => { mainUrl = r.value === "" ? null : data.images[+r.value].url; sum(); });
  out().querySelector("#impOk").onclick = run;
  out().querySelector("#impStop").onclick = () => { cancel = true; };
  sum();
}

function sum() {
  const sel = rows.filter(s => s.on), upd = sel.filter(s => s.to !== "new").length;
  const dupTarget = sel.filter(s => s.to !== "new").map(s => s.to).some((t, i, a) => a.indexOf(t) !== i);
  out().querySelector("#impSum").innerHTML = `${sel.length} درجة مختارة: ${sel.length - upd} جديدة، ${upd} تحديث لدرجات موجودة · ${sel.filter(s => s.img).length + (mainUrl ? 1 : 0)} صورة للرفع${dupTarget ? ` · <b style="color:var(--danger)">في درجتين رايحين لنفس الدرجة الموجودة</b>` : ""}`;
  return !dupTarget;
}

async function run() {
  if (!editing?.id) return toast("احفظ المنتج أول مرة، بعدين استورد الصور");
  if (!out().querySelector("#impLic").checked) return toast("لازم تأكد إذن استعمال الصور");
  if (!sum()) return toast("صلّح التكرار أول");
  const sel = rows.filter(s => s.on); if (!sel.length && !mainUrl) return toast("ما اخترت إشي");
  const urls = [...new Set([...sel.map(s => s.img).filter(Boolean), mainUrl].filter(Boolean))];
  const bar = out().querySelector("#impBar"), stop = out().querySelector("#impStop"), ok = out().querySelector("#impOk");
  bar.hidden = false; bar.max = urls.length || 1; bar.value = 0; stop.hidden = false; ok.disabled = true; cancel = false;
  const got = {}, failed = [];
  for (let i = 0; i < urls.length && !cancel; i += 6) {
    const part = urls.slice(i, i + 6);
    try { const r = await fn({ action: "import", product_id: editing.id, urls: part });
      if (!r.ok) throw new Error(r.error); r.results.forEach(x => x.ok ? got[x.url] = x.stored : failed.push(x)); }
    catch (e) { part.forEach(u => failed.push({ url: u, error: e.message })); }
    bar.value = Math.min(urls.length, i + 6);
  }
  const cut = out().querySelector("#impCut").checked; let done = 0;
  const targets = sel.map(s => ({ s, el: s.to === "new" ? null : s.ex[+s.to].el }));
  for (const { s, el } of targets) {
    if (s.img && !got[s.img]) continue; // image failed: leave the row untouched
    let d = el; if (!d) { addSwRow({ name: s.name, hex: s.hex || null }); d = $("#swList").lastElementChild; }
    const m = d._m; Object.assign(m, Object.fromEntries(Object.entries({ sku: s.sku, barcode: s.barcode, code: s.code }).filter(([, v]) => v)));
    if (s.img) { m.orig = s.img; m.cut = got[s.img];
      if (cut) { try { const b = await (await fetch(got[s.img])).blob(); const keep = { hex: m.hex, src: m.src, conf: m.conf, nohex: d.dataset.nohex };
          await applyCut(d, new File([b], "x.png", { type: b.type })); // replaces cut with the transparent version
          Object.assign(m, { hex: keep.hex, src: keep.src, conf: keep.conf }); if (keep.hex) d.querySelector("[type=color]").value = keep.hex; if (keep.nohex) d.dataset.nohex = "1"; // never guess the colour from a photo here
        } catch (e) { failed.push({ url: s.img, error: "شيل الخلفية: " + e.message }); } }
      const im = d.querySelector(".swcut"); im.src = m.cut; im.hidden = false; }
    if (s.hex) { m.hex = s.hex.toLowerCase(); m.src = data.url; m.conf = "high"; d.querySelector("[type=color]").value = m.hex; delete d.dataset.nohex; } // official hex only
    done++; s.on = false; const cb = out().querySelector(`[data-i="${rows.indexOf(s)}"] [data-on]`); if (cb) cb.checked = false; // a second press only retries what is left
  }
  if (mainUrl && got[mainUrl]) { impMain = got[mainUrl]; $("#ePrev").src = impMain; }
  stop.hidden = true; ok.disabled = false; sum();
  out().querySelector("#impRep").innerHTML = `<p><b>✓ ${done} درجة جاهزة${impMain && got[mainUrl] ? " + الصورة الرئيسية" : ""}.</b> ${cancel ? "انوقف قبل ما يخلص. " : ""}سكّر النافذة وراجع الدرجات، بعدين اضغط «حفظ».</p>
${failed.length ? `<p style="color:var(--danger)">${failed.length} صورة ما انرفعت:</p><ul class="hint">${failed.map(f => `<li dir="ltr">${h(f.url.split("/").pop().split("?")[0])}: ${h(f.error)}</li>`).join("")}</ul><p class="hint">تقدر تضغط «اعتماد» مرة ثانية للمحاولة، الصور اللي انرفعت ما بتنرفع مرتين.</p>` : ""}`;
  toast(`${done} درجة جاهزة، اضغط حفظ`);
}

const btn = document.createElement("button"); btn.type = "button"; btn.className = "sm"; btn.textContent = "🌐 استيراد صور ودرجات المنتج من الموقع الرسمي";
btn.onclick = () => { data = null; out().innerHTML = ""; dlg.querySelector("#impSrc").textContent = ""; dlg.showModal(); };
$("#addSwImg").after(" ", btn);
