// Smart Wholesale Ordering: per-shade quantity table, quick presets, order-by-total, one-tap add to cart,
// the #/quick page for many products, and saved orders. Only approved traders ever see it (isTrader()).
const WQ = {}, WT = {};                       // product id -> {shade: qty} / wanted total (0 = no target)
const wsList = p => swatchesOf(p).length ? swatchesOf(p) : [{ name: "" }];
const wsCap = (p, sh) => stockOf(p, sh) ?? 999;   // null stock = not tracked, effectively unlimited
const wsPresets = p => { const mq = minQty(p), v = String(p.w?.presets || "5,6,10,12").split(/[,\s]+/).map(Number).filter(n => n > 0 && n <= 999);
  return [...new Set(v.map(n => Math.max(n, mq)))].slice(0, 6); };
const wsTotal = pid => Object.values(WQ[pid] || {}).reduce((a, n) => a + n, 0);
const wsShown = p => isTrader() && has(p.w?.price) && wsList(p).length > 1;
// every line must be 0, or between the product's minimum and what is left
const wsOk = (p, sh, q) => q === 0 || (q >= minQty(p) && q <= wsCap(p, sh));
function wsSet(pid, sh, q) { const p = byId[pid]; q = Math.min(Math.max(0, Math.floor(+q) || 0), wsCap(p, sh)); (WQ[pid] ||= {})[sh] = q; return q; }

function wsWidget(p) {
  const mq = minQty(p), t = WT[p.id] || "", av = wsList(p).reduce((a, s) => a + (stockOf(p, s.name) ?? 0), 0);
  return `<div class="wsx" data-wsp="${p.id}">
    <div class="shade-name">طلب سريع بالجملة${mq > 1 ? ` · أقل كمية للدرجة ${mq}` : ""}</div>
    <div class="wsq">${wsPresets(p).map(n => `<button type="button" class="chip" data-ws-preset="${n}">${n} من كل درجة</button>`).join("")}
      ${av ? `<button type="button" class="chip" data-ws-all>كل المتوفر (${av})</button>` : ""}<button type="button" class="chip" data-ws-clear>توزيع يدوي</button></div>
    <label class="wst">أريد طلب إجمالي <input type="number" inputmode="numeric" min="0" dir="ltr" value="${t}" data-ws-target placeholder="مثلاً 100"> قطعة</label>
    <div class="wsr">${wsList(p).map(s => { const n = stockOf(p, s.name), q = WQ[p.id]?.[s.name] || "", out = n === 0;
      return `<label class="wsrow${out ? " oos" : ""}"><span class="wsd" style="--c:${esc(s.hex || "#eee")}"></span><b class="latin">${esc(s.name || p.n)}</b>
        <small>${out ? "Out of Stock" : n === null ? "" : `متوفر ${n}`}</small>
        <input type="number" inputmode="numeric" min="0" ${n === null ? "" : `max="${n}"`} dir="ltr" placeholder="0" value="${q}" data-ws-q="${esc(s.name)}" ${out ? "disabled" : ""} aria-label="${esc(s.name)}"></label>`; }).join("")}</div>
    <div class="wsum" data-ws-sum="${p.id}">${wsSumHTML(p.id)}</div>
  </div>`;
}
function wsSumHTML(pid) {
  const p = byId[pid], q = WQ[pid] || {}, rows = Object.entries(q).filter(([, n]) => n > 0), n = rows.reduce((a, [, v]) => a + v, 0), t = WT[pid] || 0;
  const bad = rows.some(([sh, v]) => !wsOk(p, sh, v)), off = t && n !== t;
  const u = unit(p);
  return `<div><span>${rows.length} درجة · <b>${n}</b>${t ? ` / ${t}` : ""} قطعة</span><span>${money(u)} للقطعة</span><b>${money(Math.round(u * n * 100) / 100)}</b></div>
    ${bad ? `<small class="wsw">كل درجة لازم تكون ${minQty(p)} قطعة أو أكثر وما تزيد عن المتوفر</small>` : off ? `<small class="wsw">لسا ${n < t ? `باقي ${t - n}` : `زيادة ${n - t}`} لتوصلي ${t}</small>` : ""}
    <button type="button" class="btn" data-ws-add="${pid}" ${n && !bad && !off ? "" : "disabled"}>إضافة الطلب للسلة</button>`;
}
function wsSync(pid) {
  document.querySelectorAll(`[data-ws-sum="${pid}"]`).forEach(e => e.innerHTML = wsSumHTML(pid));
  document.querySelectorAll(`.wsx[data-wsp="${pid}"] [data-ws-q]`).forEach(i => { if (document.activeElement !== i) i.value = WQ[pid]?.[i.dataset.wsQ] || ""; });
  wsBar(); document.querySelectorAll("[data-ws-b]").forEach(b => b.textContent = wsTotal(+b.dataset.wsB) || "");
}
function wsFill(pid, fn) {
  const p = byId[pid]; WQ[pid] = {};
  wsList(p).forEach(s => { const q = Math.min(fn(s.name), wsCap(p, s.name)); if (q >= minQty(p) && stockOf(p, s.name) !== 0) wsSet(pid, s.name, q); });
  if (WT[pid]) WT[pid] = 0, document.querySelectorAll(`.wsx[data-wsp="${pid}"] [data-ws-target]`).forEach(i => i.value = "");
  wsSync(pid);
}
function wsAdd(pids) {
  let n = 0, cut = 0;
  pids.forEach(pid => { const p = byId[pid]; Object.entries(WQ[pid] || {}).forEach(([sh, q]) => {
    if (!q) return; const l = cart.find(l => l.id === pid && l.shade === sh), have = l?.qty || 0, ok = Math.min(q, wsCap(p, sh) - have);
    if (ok < q) cut++; if (ok <= 0) return; l ? l.qty += ok : cart.push({ id: pid, shade: sh, qty: ok }); n += ok; });
    WQ[pid] = {}; WT[pid] = 0; });
  save(); drawCart(); wsRefresh();
  toast(n ? `انضافت ${n} قطعة للسلة ✓${cut ? " (قصّينا الزيادة عن المتوفر)" : ""}` : "ما انضاف شي، الكمية فوق المتوفر");
}
// re-draw every open widget and the quick page after a change in bulk
function wsRefresh() { document.querySelectorAll(".wsx").forEach(w => { const p = byId[w.dataset.wsp]; if (p) w.outerHTML = wsWidget(p); }); wsBar(); }

document.addEventListener("input", e => {
  const w = e.target.closest(".wsx"); if (!w) return; const pid = +w.dataset.wsp, i = e.target;
  if (i.matches("[data-ws-q]")) { const v = wsSet(pid, i.dataset.wsQ, i.value); if (+i.value > v) i.value = v; }
  else if (i.matches("[data-ws-target]")) WT[pid] = Math.max(0, Math.floor(+i.value) || 0);
  else return;
  wsSync(pid);
});
document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return; const w = t.closest(".wsx"), d = t.dataset, pid = +w?.dataset.wsp;
  if (d.wsPreset) wsFill(pid, () => +d.wsPreset);
  else if (d.wsAll !== undefined) { wsFill(pid, sh => stockOf(byId[pid], sh) ?? 0); toast("انحطت كل الكميات المتوفرة، عدّلي اللي بدك ياه"); }
  else if (d.wsClear !== undefined) { wsFill(pid, () => 0); w.querySelector("[data-ws-q]:not(:disabled)")?.focus(); }
  else if (d.wsAdd) wsAdd([+d.wsAdd]);
  else if (d.wsAddAll !== undefined) wsAdd(Object.keys(WQ).map(Number).filter(id => wsTotal(id) > 0 && wsDone(id)));
  else if (d.wsSave !== undefined) wsSave();
  else if (d.wsLoad) wsLoad(+d.wsLoad);
  else if (d.wsDel) wsDel(+d.wsDel);
});
const wsDone = pid => { const p = byId[pid], t = WT[pid] || 0, n = wsTotal(pid); return (!t || t === n) && Object.entries(WQ[pid] || {}).every(([sh, q]) => wsOk(p, sh, q)); };

// ---- #/quick: many products at once -------------------------------------------------
let wsQ = "", wsCat = "";
function wsBar() {
  const el = document.getElementById("wsBar2"); if (!el) return;
  const ids = Object.keys(WQ).map(Number).filter(id => wsTotal(id) > 0), n = ids.reduce((a, id) => a + wsTotal(id), 0), ok = ids.length && ids.every(wsDone);
  const sum = ids.reduce((a, id) => a + (unit(byId[id]) || 0) * wsTotal(id), 0);
  el.innerHTML = `<div><span>${ids.length} منتج · <b>${n}</b> قطعة</span><b>${money(Math.round(sum * 100) / 100)}</b></div>
    <button type="button" class="btn" data-ws-add-all ${ok ? "" : "disabled"}>إضافة الكل للسلة</button>`;
  el.hidden = !ids.length;
}
function quickView() {
  const pg = $("#pg-quick");
  if (!isTrader()) { pg.innerHTML = `<div class="wrap"><div class="pghead"><h2>طلب الجملة السريع</h2></div><p class="meta">هالصفحة لحسابات التجار الموافق عليها. <a href="#/account">سجّلي دخول</a></p></div>`; return; }
  const list = ALL.filter(p => wsShown(p) && !soldOut(p) && (!wsCat || p.cat === wsCat) && (!wsQ || TS.norm(`${p.b} ${p.n}`).includes(TS.norm(wsQ))));
  const open = new Set([...pg.querySelectorAll("details[open]")].map(d => d.dataset.wsd));
  pg.innerHTML = `<div class="wrap"><div class="pghead"><h2>طلب الجملة السريع</h2><small>${list.length} منتج</small></div>
    <div class="wsf"><input id="wsQ" type="search" placeholder="دوّري بين المنتجات" value="${esc(wsQ)}"><select id="wsCat"><option value="">كل الأقسام</option>${CATS.map(c => `<option${c.s === wsCat ? " selected" : ""}>${esc(c.s)}</option>`).join("")}</select></div>
    <div id="wsSaved"></div>
    ${list.map(p => { const n = wsTotal(p.id); return `<details class="wsp" data-wsd="${p.id}"${open.has(String(p.id)) || n ? " open" : ""}><summary><img src="${esc(p.img)}" alt=""><span><small class="latin">${esc(p.b)}</small>${esc(p.n)}<em>${wsList(p).length} درجة · ${money(unit(p))}</em></span><b class="wsbadge" data-ws-b="${p.id}">${n || ""}</b></summary>${wsWidget(p)}</details>`; }).join("") || `<p class="meta">ما في منتجات بهالفلتر.</p>`}
    </div><div class="wsbar" id="wsBar2" hidden></div>`;
  wsBar(); wsSaved();
}
document.addEventListener("input", e => { if (e.target.id === "wsQ") { wsQ = e.target.value; clearTimeout(wsT); wsT = setTimeout(() => { quickView(); $("#wsQ")?.focus(); }, 250); } });
document.addEventListener("change", e => { if (e.target.id === "wsCat") { wsCat = e.target.value; quickView(); } });
let wsT;

// ---- saved orders (a trader's own cart, kept on the server) ----------------------------
async function wsSaved() {
  const el = $("#wsSaved"); if (!el) return;
  const { data } = await db.from("saved_orders").select("id,name,items,created_at").order("created_at", { ascending: false }).limit(20);
  el.innerHTML = `<div class="wssv"><button type="button" class="btn ghost" data-ws-save>💾 احفظي السلة الحالية (${cart.reduce((a, l) => a + l.qty, 0)} قطعة)</button>
    ${(data || []).map(o => `<div class="wsrow2"><span><b>${esc(o.name)}</b><small>${o.items.reduce((a, l) => a + l.qty, 0)} قطعة · ${new Date(o.created_at).toLocaleDateString("en-GB")}</small></span>
      <button type="button" class="btn ghost" data-ws-load="${o.id}">استرجاع</button><button type="button" class="rm" data-ws-del="${o.id}">حذف</button></div>`).join("")}</div>`;
}
async function wsSave() {
  if (!cart.length) { toast("السلة فاضية"); return; }
  const name = `طلب ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  const { error } = await db.from("saved_orders").insert({ name, items: cart.map(l => ({ id: l.id, shade: l.shade, qty: l.qty })) });
  toast(error ? "ما انحفظ الطلب، جرّبي كمان مرة" : "انحفظ الطلب ✓ بتلاقيه بصفحة الطلب السريع"); wsSaved();
}
async function wsLoad(id) {
  const { data } = await db.from("saved_orders").select("items").eq("id", id).single();
  let n = 0, cut = 0; (data?.items || []).forEach(it => { const p = byId[it.id]; if (!p) return;
    const l = cart.find(l => l.id === it.id && l.shade === it.shade), ok = Math.min(it.qty, wsCap(p, it.shade) - (l?.qty || 0));
    if (ok < it.qty) cut++; if (ok > 0) { l ? l.qty += ok : cart.push({ id: it.id, shade: it.shade, qty: ok }); n += ok; } });
  save(); drawCart(); toast(`رجعت ${n} قطعة للسلة${cut ? " (بعض الكميات انقصّت حسب المتوفر)" : ""}`);
  if (n) location.hash = "#/cart";
}
async function wsDel(id) { await db.from("saved_orders").delete().eq("id", id); wsSaved(); }
