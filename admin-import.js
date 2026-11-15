// Product importer (admin only), three ways in, one review screen:
//  1 direct: official page read by the "product-import" edge function (only sites that allow it)
//  2 supplier/brand files: CSV, Excel, JSON, ZIP or loose images, read here in the browser
//  3 browser helper: a file saved by the Tolay Chrome helper from a page the admin opened normally
// Approved images are stored byte-for-byte (colours untouched) and the shade rows are filled; nothing is written
// to the product until the admin presses the normal Save button.
import { SOURCES, STATUS, sourceOf, matchShades, parseCSV, fromRows, matchFiles, shadesFromFiles, parseBundle, mergeBundles } from "./tools/importer/parse.js";

const ST = { matched: ["مطابقة", "#1f9d55"], new: ["درجة جديدة", "#2563eb"], review: ["بدها مراجعة", "#d97706"], duplicate: ["مكررة", "#dc2626"] };
const TYPE = { main: "رئيسية", packaging: "علبة", swatch: "تستر", gallery: "معرض", lifestyle: "لايف ستايل" };
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const h = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const badge = k => `<span class="pill" style="color:${STATUS[k][1]};border-color:${STATUS[k][1]}">${STATUS[k][0]}</span>`;
const fn = async body => { const { data, error } = await db.functions.invoke("product-import", { body }); if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch {} throw new Error(m); } return data; };
const lib = (src, g) => window[g] ? Promise.resolve(window[g]) : new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = () => ok(window[g]); s.onerror = () => no(new Error("ما انفتحت مكتبة " + g)); document.head.append(s); });
const sha1 = async b => [...new Uint8Array(await crypto.subtle.digest("SHA-1", await b.arrayBuffer()))].map(x => x.toString(16).padStart(2, "0")).join("");
const mimeOf = n => /\.png$/i.test(n) ? "image/png" : /\.jpe?g$/i.test(n) ? "image/jpeg" : /\.webp$/i.test(n) ? "image/webp" : "";
const base = n => n.split("/").pop().toLowerCase();

const dlg = document.createElement("dialog"); dlg.className = "wide"; dlg.id = "impDlg";
dlg.innerHTML = `<button class="x" type="button" data-close aria-label="إغلاق">✕</button><div class="odb">
<h2 style="margin:0">🌐 استيراد صور ودرجات المنتج</h2>
<div style="display:flex;gap:6px;flex-wrap:wrap" role="tablist"><button class="sm" type="button" data-tab="1">١ رابط الموقع الرسمي</button><button class="sm" type="button" data-tab="2">٢ ملفات المورّد / العلامة</button><button class="sm" type="button" data-tab="3">٣ من المتصفح (إضافة Tolay)</button></div>
<div data-pane="1"><div class="hint">الصق رابط صفحة المنتج. بنقرأ الصفحة بس إذا الموقع بيسمح، وما بنتخطى أي حماية.</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><input id="impUrl" type="url" dir="ltr" placeholder="https://www.narscosmetics.com/USA/..." style="flex:1;min-width:240px"><button class="sm" type="button" id="impGo" style="background:var(--p,#e5007d);color:#fff">قراءة الصفحة</button></div>
<div id="impSrc" class="hint" style="margin-top:6px"></div>
<details class="hint" style="margin-top:6px"><summary>حالة المواقع</summary>${Object.values(SOURCES).map(s => `<div>${badge(s.status)} ${h(s.name)}${s.why ? " · " + h(s.why) : ""}</div>`).join("")}<div>${badge("auth")} أي موقع بيطلب دخول أو مفتاح API · استعمل ملفات المورّد</div><div>${badge("unsupported")} أي موقع ثاني</div></details></div>
<div data-pane="2" hidden><div class="hint">اختار ملفات من المورّد أو من العلامة: جدول (CSV أو Excel أو JSON) و/أو صور، أو ملف ZIP فيه الاثنين. الأعمدة المفهومة: Shade، SKU، Barcode/EAN، Code، Hex، Swatch، Packshot، Gallery. بدون جدول، اسم كل صورة لازم يحتوي اسم الدرجة أو رقمها أو الـ SKU.</div>
<input id="impFiles" type="file" multiple accept=".csv,.xlsx,.xls,.json,.zip,image/png,image/jpeg,image/webp" style="margin-top:6px"></div>
<div data-pane="3" hidden><div class="hint">للمواقع المقيّدة (NYX وSephora ومواقع ثانية): افتح صفحة المنتج بمتصفحك عادي، اضغط إضافة Tolay، راجع الدرجات، ونزّل الملف. بعدها اختاره هون. الإضافة ما بتبعث كوكيز ولا كلمات سر، وما بتحل CAPTCHA، وإذا الصفحة محمية بتوقف وبتقلك تستعمل ملفات المورّد.</div>
<p class="hint"><a href="tools/tolay-helper.zip" download>⬇️ تنزيل إضافة Tolay</a> · فك الضغط، افتح chrome://extensions، شغّل Developer mode، اضغط Load unpacked واختار المجلد.</p>
<p class="hint">بدك صور الموديل لكل درجة؟ اكبس الدرجة بصفحة الشركة، افتح الإضافة واختار اسم الدرجة، ونزّل ملف. كرّر لكل درجة، وبعدين اختار كل الملفات هون مع بعض.</p>
<input id="impBundle" type="file" multiple accept=".json,application/json"></div>
<div id="impOut"></div></div>`;
document.body.append(dlg);

let data = null, rows = [], cancel = false, mainKey = null, IMG = {}, galOn = new Set();
const out = () => dlg.querySelector("#impOut");
const tab = n => { dlg.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== n); dlg.querySelectorAll("[data-tab]").forEach(b => b.style.background = b.dataset.tab === n ? "var(--ink-2)" : ""); };
dlg.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => tab(b.dataset.tab));
dlg.querySelector("#impUrl").addEventListener("input", e => {
  let t = ""; try { const s = sourceOf(new URL(e.target.value.trim()).hostname.toLowerCase());
    t = !s ? `${badge("unsupported")} هاد مش موقع رسمي مدعوم. جرّب «ملفات المورّد»` : s.status === "restricted" ? `${badge("restricted")} ${h(s.name)}: ${h(s.why)}. استعمل «من المتصفح» أو «ملفات المورّد»` : `${badge(s.status)} ${h(s.name)}`; } catch {}
  dlg.querySelector("#impSrc").innerHTML = t;
});
const fail = (msg, status) => { out().innerHTML = `<p style="color:var(--danger)">${status ? badge(status) + " " : ""}${h(msg)}</p>${status === "restricted" || status === "auth" ? `<button class="sm" type="button" data-go="3">جرّب «من المتصفح»</button> <button class="sm" type="button" data-go="2">«ملفات المورّد»</button> <button class="sm" type="button" id="impManual">🖼️ يدوي من صور</button>` : ""}`;
  out().querySelectorAll("[data-go]").forEach(b => b.onclick = () => tab(b.dataset.go)); const m = out().querySelector("#impManual"); if (m) m.onclick = () => { dlg.close(); $("#addSwImg").click(); }; };

// every mode ends here: data = { brand, name, url, shades:[{name,code,sku,barcode,hex,swatch,pack}], images:[{key,src,file?,remote?,type,shade}] }
const load = async (d, how) => { data = d; IMG = Object.fromEntries(d.images.map(i => [i.key, i]));
  for (const i of d.images) if (i.file) i.hash = await sha1(i.file); // identical bytes = duplicate picture
  render(how); };

dlg.querySelector("#impGo").onclick = async () => {
  const url = dlg.querySelector("#impUrl").value.trim(); if (!url) return;
  out().innerHTML = `<p class="hint">⏳ عم نقرأ الصفحة…</p>`;
  try { const r = await fn({ action: "extract", url });
    if (!r.ok) return fail(r.error, r.status || (r.blocked ? "restricted" : null));
    await load({ ...r.data, images: r.data.images.map(i => ({ ...i, key: i.url, src: i.url, remote: i.url })) }, `${r.source} · قراءة مباشرة`);
  } catch (e) { fail(e.message); }
};

// mode 2: files (ZIPs are opened here, nothing leaves the browser until approval)
dlg.querySelector("#impFiles").onchange = async e => {
  const picked = [...e.target.files]; if (!picked.length) return; out().innerHTML = `<p class="hint">⏳ عم نقرأ الملفات…</p>`;
  try {
    const files = [];
    for (const f of picked) {
      if (/\.zip$/i.test(f.name)) { const Z = await lib("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js", "JSZip"); const z = await Z.loadAsync(f);
        for (const en of Object.values(z.files)) if (!en.dir && !/(^|\/)(__MACOSX|\.)/.test(en.name)) files.push({ name: en.name, blob: await en.async("blob") }); }
      else files.push({ name: f.name, blob: f });
    }
    const sheets = files.filter(f => /\.(csv|xlsx|xls|json)$/i.test(f.name)), pics = files.filter(f => mimeOf(f.name));
    let d = null; const rowsIn = [];
    for (const s of sheets) {
      if (/\.json$/i.test(s.name)) { const j = JSON.parse(await s.blob.text()); if (j?.tolay === 1) { d = parseBundle(j); break; } rowsIn.push(...(Array.isArray(j) ? j : j.shades || j.rows || [])); }
      else if (/\.csv$/i.test(s.name)) rowsIn.push(...parseCSV(await s.blob.text()));
      else { const X = await lib("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", "XLSX"); const wb = X.read(await s.blob.arrayBuffer());
        for (const n of wb.SheetNames) rowsIn.push(...X.utils.sheet_to_json(wb.Sheets[n], { defval: "", raw: false })); }
    }
    if (d) return loadBundle(d);
    d = rowsIn.length ? fromRows(rowsIn) : { brand: "", name: "", url: null, shades: shadesFromFiles(pics.map(p => p.name)), images: [] };
    if (!d.shades.length) return fail("ما لقيت درجات: لا بالجدول ولا بأسماء الصور");
    const byName = Object.fromEntries(pics.map(p => [base(p.name), p])), images = [], used = new Set();
    const fileImg = (p, type, shade) => ({ key: "file:" + p.name, src: URL.createObjectURL(p.blob), file: new File([p.blob], base(p.name), { type: mimeOf(p.name) }), type, shade });
    const ref = (r, type, shade) => { // a sheet cell: file name inside the upload, or an https link (downloaded later by the server, official hosts only)
      if (/^https:\/\//i.test(r)) { if (!images.some(i => i.key === r)) images.push({ key: r, src: r, remote: r, type, shade }); return r; }
      const p = byName[base(r)]; if (!p) return null; used.add(p);
      if (!images.some(i => i.key === "file:" + p.name)) images.push(fileImg(p, type, shade));
      return "file:" + p.name; };
    for (const i of d.images) ref(i.ref, i.type, i.shade);
    for (const s of d.shades) { s.swatch = s.swatch ? ref(s.swatch, "swatch", s.name) : null; s.pack = s.pack ? ref(s.pack, "packaging", s.name) : null; }
    // pictures the sheet does not mention: matched by file name; a picture that fits no single shade is never given to one
    const rest = pics.filter(p => !used.has(p));
    matchFiles(rest.map(p => p.name), d.shades).forEach((m, i) => { const im = fileImg(rest[i], m.type, m.shade); images.push(im);
      const s = m.shade && d.shades.find(x => x.name === m.shade);
      if (s && m.type === "swatch" && !s.swatch) s.swatch = im.key; else if (s && m.type === "packaging" && !s.pack) s.pack = im.key; });
    await load({ ...d, images }, `ملفات المورّد · ${files.length} ملف`);
  } catch (err) { fail(err.message); }
};
// mode 3: bundle from the browser helper (images arrive inline, fetched by the admin's own browser)
const loadBundle = d => load({ ...d, images: d.images.map(i => { const file = i.data ? new File([Uint8Array.from(atob(i.data), c => c.charCodeAt(0))], base(new URL(i.url).pathname) || "img", { type: i.mime }) : null;
  return { ...i, key: i.url, src: file ? URL.createObjectURL(file) : i.url, file, remote: file ? null : i.url }; }) }, `إضافة المتصفح · ${d.url ? new URL(d.url).hostname : ""}`);
dlg.querySelector("#impBundle").onchange = async e => { const fs = [...e.target.files]; if (!fs.length) return; try { await loadBundle(mergeBundles(await Promise.all(fs.map(async f => parseBundle(JSON.parse(await f.text())))))); } catch (err) { fail(err.message); } };

const existing = () => [...$("#swList").children].map(d => ({ el: d, name: d.querySelector("[type=text]").value.trim(), sku: d._m?.sku, barcode: d._m?.barcode, code: d._m?.code }));

function render(how) {
  const ex = existing(); mainKey = null;
  rows = matchShades(data.shades, ex).map(s => ({ ...s, img: s.swatch || s.pack || null, on: s.status === "matched", to: s.match ?? s.suggest ?? "new", ex }));
  // the same picture (same bytes) on two different shades means one mapping is wrong: flag both, never use it
  const seen = {}; rows.forEach(s => { const k = s.img && (IMG[s.img]?.hash || s.img); if (k) (seen[k] ||= []).push(s); });
  Object.values(seen).filter(a => a.length > 1).flat().forEach(s => { s.dupImg = true; });
  const opts = ex.map((e, i) => `<option value="${i}">← ${h(e.name || "درجة بدون اسم")}</option>`).join("");
  const imgs = data.images, can = i => i.type === "main" || i.type === "packaging" || i.type === "gallery";
  const shadeImg = new Set(rows.map(s => s.img).filter(Boolean)), forGal = im => !shadeImg.has(im.key) && !im.shade;
  galOn = new Set(imgs.filter(forGal).map(im => im.key));
  out().innerHTML = `
<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b>${h(data.brand)}${data.brand && data.name ? " — " : ""}${h(data.name)}</b><span class="hint">${h(how)}</span>${data.url ? `<a class="hint" href="${h(data.url)}" target="_blank" rel="noopener">الصفحة الأصلية</a>` : ""}</div>
<details><summary>الصور (${imgs.length}): صور المعرض مأشّر عليها، شيل الإشارة عن اللي ما بدك ياه${data.skipped ? ` · ${data.skipped} صورة لدرجات مش موجودة بالصفحة انتركت` : ""}</summary>
<div class="hint">اختار صورة رئيسية للمنتج إذا بدك تغيّرها (اختياري):</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:6px">
<label style="font-size:11px;text-align:center"><input type="radio" name="impMain" value="" checked><br>بدون تغيير</label>
${imgs.map((im, i) => `<label style="font-size:11px;text-align:center;display:flex;flex-direction:column;gap:2px"><img src="${h(im.src)}" loading="lazy" alt="" style="width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:8px;border:1px solid var(--line)">
<span>${TYPE[im.type] || h(im.type)}${im.shade ? " · " + h(im.shade) : ""}</span>${can(im) ? `<span><input type="radio" name="impMain" value="${i}"> رئيسية</span>` : ""}${forGal(im) ? `<span><input type="checkbox" data-gal="${i}" checked> للمعرض</span>` : im.shade && !shadeImg.has(im.key) ? `<span class="hint">مع درجة ${h(im.shade)}</span>` : ""}</label>`).join("")}</div></details>
<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><b>الدرجات (${rows.length})</b>
<button class="sm" type="button" data-all="1">تحديد الكل</button><button class="sm" type="button" data-all="0">إلغاء الكل</button><button class="sm" type="button" id="impRev">عرض اللي بدها مراجعة بس</button></div>
<div id="impGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px">
${rows.map((s, i) => `<div class="tk" data-i="${i}" data-st="${s.dupImg ? "dup" : s.status}">
<div style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-on ${s.on ? "checked" : ""} aria-label="اختيار">
${s.img ? `<img src="${h(IMG[s.img]?.src || s.img)}" alt="" loading="lazy" style="width:56px;height:56px;object-fit:contain;background:#fff;border-radius:8px">` : `<span class="hint" style="width:56px">بدون صورة</span>`}
<div style="min-width:0"><b dir="auto">${h(s.name)}</b><small class="hint" style="display:block" dir="ltr">${h([s.code, s.sku, s.barcode].filter(Boolean).join(" · "))}</small>
${s.hex ? `<span title="${s.conf === "sampled" ? "مأخوذ من الصورة الرسمية (مش كود رسمي)" : "لون رسمي من المصدر"}" style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${h(s.hex)};vertical-align:middle"></span> <small dir="ltr">${h(s.hex)}</small>` : ""}</div></div>
<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="pill" style="color:${ST[s.status][1]};border-color:${ST[s.status][1]}">${ST[s.status][0]}${s.how ? ` (${s.how === "sku" ? "SKU/باركود" : s.how === "code" ? "رقم" : "اسم"})` : ""}</span>${!s.img ? `<span class="pill">ما في صورة</span>` : ""}${s.dupImg ? `<span class="pill" style="color:#dc2626;border-color:#dc2626">صورة مكررة لدرجة ثانية، ما رح تنحط</span>` : ""}</div>
<select data-to aria-label="وين تنحط"><option value="new">+ درجة جديدة</option>${opts}</select></div>`).join("")}</div>
<label class="hint"><input type="checkbox" id="impCut"> شيل الخلفية عن صور الدرجات (الأصلية بتضل محفوظة)</label>
<label class="hint"><input type="checkbox" id="impLic"> أأكد إنو مسموح إلي أستعمل هالصور بالمتجر (منتج أصلي ومحتوى رسمي من العلامة أو المورّد)</label>
<div id="impSum" class="hint"></div>
<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="sm" type="button" id="impOk" style="background:var(--p,#e5007d);color:#fff">اعتماد ورفع جميع الصور والدرجات</button><button class="sm" type="button" id="impStop" hidden>إيقاف</button></div>
<progress id="impBar" value="0" max="1" hidden style="width:100%"></progress><div id="impRep"></div>`;
  out().querySelectorAll("#impGrid [data-i]").forEach(c => { const s = rows[c.dataset.i]; c.querySelector("[data-to]").value = String(s.to);
    c.querySelector("[data-on]").onchange = e => { s.on = e.target.checked; sum(); };
    c.querySelector("[data-to]").onchange = e => { s.to = e.target.value; sum(); }; });
  out().querySelectorAll("[data-all]").forEach(b => b.onclick = () => { rows.forEach(s => s.on = b.dataset.all === "1"); out().querySelectorAll("[data-on]").forEach(x => x.checked = b.dataset.all === "1"); sum(); });
  out().querySelector("#impRev").onclick = e => { const only = e.target.dataset.only !== "1"; e.target.dataset.only = only ? "1" : "0"; e.target.textContent = only ? "عرض الكل" : "عرض اللي بدها مراجعة بس";
    out().querySelectorAll("#impGrid [data-i]").forEach(c => c.hidden = only && c.dataset.st === "matched"); };
  out().querySelectorAll("[name=impMain]").forEach(r => r.onchange = () => { mainKey = r.value === "" ? null : imgs[+r.value].key; sum(); });
  out().querySelectorAll("[data-gal]").forEach(c => c.onchange = () => { const k = imgs[+c.dataset.gal].key; c.checked ? galOn.add(k) : galOn.delete(k); sum(); });
  out().querySelector("#impOk").onclick = run;
  out().querySelector("#impStop").onclick = () => { cancel = true; };
  sum();
}

function sum() {
  const sel = rows.filter(s => s.on), upd = sel.filter(s => s.to !== "new").length;
  const dupTarget = sel.filter(s => s.to !== "new").map(s => s.to).some((t, i, a) => a.indexOf(t) !== i);
  out().querySelector("#impSum").innerHTML = `${sel.length} درجة مختارة: ${sel.length - upd} جديدة، ${upd} تحديث لدرجات موجودة · ${sel.filter(s => s.img && !s.dupImg).length + (mainKey ? 1 : 0) + galOn.size + sel.reduce((n, s) => n + extrasOf(s).length, 0)} صورة للرفع${dupTarget ? ` · <b style="color:var(--danger)">في درجتين رايحين لنفس الدرجة الموجودة</b>` : ""}`;
  return !dupTarget;
}

const extrasOf = s => data.images.filter(im => im.shade === s.name && im.key !== s.img).map(im => im.key);

// local file -> storage, untouched bytes, name = SHA-1 so a second upload of the same picture is reused
async function putFile(i, pid) {
  const f = i.file; if (!EXT[f.type]) throw new Error("نوع ملف مش صورة مسموحة: " + (f.type || f.name));
  if (f.size > 10 * 1024 * 1024) throw new Error("الصورة أكبر من 10MB");
  const b = new Uint8Array(await f.slice(0, 12).arrayBuffer());
  const okMagic = f.type === "image/png" ? b[0] === 0x89 && b[1] === 0x50 : f.type === "image/jpeg" ? b[0] === 0xff && b[1] === 0xd8 : b[0] === 0x52 && b[8] === 0x57;
  if (!okMagic) throw new Error("محتوى الملف مش مطابق لنوعه");
  const path = `import/${pid}/${i.hash || await sha1(f)}.${EXT[f.type]}`;
  const up = await db.storage.from("shades").upload(path, f, { contentType: f.type, upsert: false });
  if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error(up.error.message);
  return db.storage.from("shades").getPublicUrl(path).data.publicUrl;
}

async function run() {
  if (!editing?.id) return toast("احفظ المنتج أول مرة، بعدين استورد الصور");
  if (!out().querySelector("#impLic").checked) return toast("لازم تأكد إذن استعمال الصور");
  if (!sum()) return toast("صلّح التكرار أول");
  const sel = rows.filter(s => s.on); if (!sel.length && !mainKey && !galOn.size) return toast("ما اخترت إشي");
  const keys = [...new Set([...sel.filter(s => !s.dupImg).map(s => s.img), ...sel.flatMap(extrasOf), mainKey, ...galOn].filter(Boolean))];
  const bar = out().querySelector("#impBar"), stop = out().querySelector("#impStop"), ok = out().querySelector("#impOk");
  bar.hidden = false; bar.max = keys.length || 1; bar.value = 0; stop.hidden = false; ok.disabled = true; cancel = false;
  const got = {}, failed = [], files = keys.filter(k => IMG[k]?.file), remote = keys.filter(k => !IMG[k]?.file);
  for (const k of files) { if (cancel) break; try { got[k] = await putFile(IMG[k], editing.id); } catch (e) { failed.push({ url: k, error: e.message }); } bar.value++; }
  for (let i = 0; i < remote.length && !cancel; i += 6) {
    const part = remote.slice(i, i + 6);
    try { const r = await fn({ action: "import", product_id: editing.id, urls: part });
      if (!r.ok) throw new Error(r.error); r.results.forEach(x => x.ok ? got[x.url] = x.stored : failed.push(x)); }
    catch (e) { part.forEach(u => failed.push({ url: u, error: e.message })); }
    bar.value += part.length;
  }
  // two different shades that ended up with the same stored picture (same bytes under two links): neither gets it
  const owners = {}; sel.forEach(s => { const g = !s.dupImg && s.img && got[s.img]; if (g) (owners[g] ||= []).push(s); });
  Object.values(owners).filter(a => a.length > 1).forEach(a => a.forEach(s => { s.dupImg = true; failed.push({ url: s.img, error: `نفس الصورة طلعت لأكثر من درجة (${a.map(x => x.name).join("، ")})، ما انحطت` }); }));
  const cut = out().querySelector("#impCut").checked; let done = 0;
  for (const s of sel) {
    if (s.img && !s.dupImg && !got[s.img]) continue; // its picture failed: leave the row as it was, retry later
    let d = s.to === "new" ? null : s.ex[+s.to].el; if (!d) { addSwRow({ name: s.name, hex: s.hex || null }); d = $("#swList").lastElementChild; }
    const m = d._m; Object.assign(m, Object.fromEntries(Object.entries({ sku: s.sku, barcode: s.barcode, code: s.code }).filter(([, v]) => v)));
    if (s.img && !s.dupImg) { m.orig = IMG[s.img]?.remote || got[s.img]; m.cut = got[s.img];
      if (cut) { try { const b = await (await fetch(got[s.img])).blob(); const keep = { hex: m.hex, src: m.src, conf: m.conf, nohex: d.dataset.nohex };
          await applyCut(d, new File([b], "x.png", { type: b.type })); // replaces cut with the transparent version; original stays in m.orig
          Object.assign(m, { hex: keep.hex, src: keep.src, conf: keep.conf }); if (keep.hex) d.querySelector("[type=color]").value = keep.hex; if (keep.nohex) d.dataset.nohex = "1"; // never guess the colour from a photo here
        } catch (e) { failed.push({ url: s.img, error: "شيل الخلفية: " + e.message }); } }
      const im = d.querySelector(".swcut"); im.src = m.cut; im.hidden = false; }
    const ex = extrasOf(s).map(k => got[k]).filter(Boolean); if (ex.length) m.imgs = [...new Set([...(m.imgs || []), ...ex])];
    if (s.hex) { m.hex = s.hex.toLowerCase(); m.src = data.url || "ملف المورّد"; m.conf = s.conf || "high"; d.querySelector("[type=color]").value = m.hex; delete d.dataset.nohex; } // official hex, or one sampled from the official photo (marked conf:"sampled")
    done++; s.on = false; const cb = out().querySelector(`[data-i="${rows.indexOf(s)}"] [data-on]`); if (cb) cb.checked = false; // a second press only retries what is left
  }
  if (mainKey && got[mainKey]) { impMain = got[mainKey]; $("#ePrev").src = impMain; }
  const gNew = [...galOn].filter(k => got[k]).map(k => ({ url: got[k], type: IMG[k]?.type || "gallery", alt: IMG[k]?.alt || "" }));
  addGallery(gNew); galOn = new Set([...galOn].filter(k => !got[k])); // a second press retries only the failed ones
  stop.hidden = true; ok.disabled = false; sum();
  const nm = k => (IMG[k]?.file?.name || String(k).split("/").pop().split("?")[0]);
  const noPic = sel.filter(s => !s.img || s.dupImg).map(s => s.name);
  out().querySelector("#impRep").innerHTML = `<p><b>✓ ${done} درجة جاهزة${mainKey && got[mainKey] ? " + الصورة الرئيسية" : ""}${gNew.length ? ` + ${gNew.length} صورة للمعرض` : ""}.</b> ${noPic.length ? `منها ${noPic.length} بدون صورة (ما في صورة إلها أو صورتها مكررة): ${h(noPic.join("، "))}. ` : ""}${cancel ? "انوقف قبل ما يخلص. " : ""}سكّر النافذة وراجع الدرجات، بعدين اضغط «حفظ».</p>
${failed.length ? `<p style="color:var(--danger)">${failed.length} صورة ما انحطت:</p><ul class="hint">${failed.map(f => `<li><span dir="ltr">${h(nm(f.url))}</span>: ${h(f.error)}</li>`).join("")}</ul><p class="hint">تقدر تضغط «اعتماد» مرة ثانية للمحاولة، الصور اللي انرفعت ما بتنرفع مرتين.</p>` : ""}`;
  toast(`${done} درجة جاهزة، اضغط حفظ`);
}

const btn = document.createElement("button"); btn.type = "button"; btn.className = "sm"; btn.textContent = "🌐 استيراد صور ودرجات المنتج من الموقع الرسمي";
btn.onclick = () => { data = null; out().innerHTML = ""; dlg.querySelector("#impSrc").textContent = ""; ["#impFiles", "#impBundle"].forEach(s => dlg.querySelector(s).value = ""); tab("1"); dlg.showModal(); };
$("#addSwImg").after(" ", btn);
