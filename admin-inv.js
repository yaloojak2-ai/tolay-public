// admin-inv.js: warehouses, stock movements, transfers, stocktake, batches + expiry, stock alerts.
// Uses the admin globals ($, db, esc, money, toast, fail, P, O) and helpers from admin-ops.js (can, fmt).

let WH = [], WHS = [], MOVES = [], BATCH = [], LOW = 10;
const MVT = { purchase: "📦 شراء", add: "➕ إضافة", sale: "🛒 بيع", return: "↩️ مرتجع", damage: "💔 تالف", loss: "❓ مفقود", transfer: "🔁 تحويل", manual: "✏️ يدوي", stocktake: "📋 جرد" };
const pName = id => { const p = P.find(x => x.id === id); return p ? `${p.brand} – ${p.name}` : "#" + id; };
const whName = id => WH.find(w => w.id === id)?.name || "—";
const dayMs = 864e5, today = () => new Date(new Date().toDateString()).getTime();
const shadesOf = p => { const k = (p.swatches || []).map(s => s.name); Object.keys(p.stock || {}).forEach(x => { if (!k.includes(x)) k.push(x); }); return k.length ? k : [""]; };

async function loadInv() {
  const [w, s, m, b, st] = await Promise.all([
    db.from("warehouses").select("*").order("id"), db.from("wh_stock").select("*"),
    db.from("stock_moves").select("*").order("at", { ascending: false }).limit(500),
    db.from("product_batches").select("*").order("exp_date", { ascending: true, nullsFirst: false }),
    db.from("settings").select("value").eq("key", "low_stock").maybeSingle(),
  ]);
  if (w.error) { $("#iAlRows").innerHTML = `<tr><td colspan="6" class="hint">شغّل ملف phase8.sql أول.</td></tr>`; return; }
  WH = w.data || []; WHS = s.data || []; MOVES = m.data || []; BATCH = b.data || []; LOW = +st.data?.value || 10;
  $("#iLow").value = LOW; $("#iLow").disabled = !can("settings");
  const opts = WH.filter(x => x.active).map(x => `<option value="${x.id}">${esc(x.name)}${x.is_default ? " (الرئيسي)" : ""}</option>`).join("");
  $("#mvW").innerHTML = opts; $("#mvW2").innerHTML = opts; $("#tkW").innerHTML = opts;
  $("#mvPL").innerHTML = P.map(p => `<option value="${esc(p.brand)} – ${esc(p.name)} #${p.id}">`).join("");
  $("#mlT").innerHTML = `<option value="">كل الأنواع</option>` + Object.entries(MVT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  mvMode(); drawInv(); drawWh(); drawTake(); drawBatches(); drawMoves();
}

// pieces held by orders that aren't confirmed yet (stock is only taken at "confirmed")
function reserved() {
  const r = {};
  O.filter(o => ["new", "pending"].includes(o.status)).forEach(o => (o.items || []).forEach(it => { const k = it.id + "|" + (it.shade || ""); r[k] = (r[k] || 0) + it.qty; }));
  return r;
}
function lastSale() {
  const l = {};
  O.filter(o => !["cancelled", "returned", "refused"].includes(o.status)).forEach(o => (o.items || []).forEach(it => { const t = Date.parse(o.created_at); if (!(l[it.id] > t)) l[it.id] = t; }));
  MOVES.filter(m => m.type === "sale").forEach(m => { const t = Date.parse(m.at); if (!(l[m.product_id] > t)) l[m.product_id] = t; });
  return l;
}
function expState(b) {
  if (!b.exp_date) return null;
  const d = Math.round((Date.parse(b.exp_date) - today()) / dayMs);
  return d < 0 ? ["dead", `منتهي من ${-d} يوم`] : d <= 90 ? ["soon", `بينتهي بعد ${d} يوم`] : ["ok", "سليم"];
}

function drawInv() {
  const R = reserved(), L = lastSale(), A = [], stale = Date.now() - 90 * dayMs;
  P.filter(p => p.active !== false).forEach(p => {
    const st = p.stock || {}; if (!Object.keys(st).length) return;   // quantities never entered: no alerts
    shadesOf(p).forEach(k => {
      if (!(k in st)) return;
      const n = +st[k] || 0, rv = R[p.id + "|" + k] || 0;
      if (n <= 0) A.push({ t: "out", l: "🔴 نفد", p, k, n, rv });
      else if (n - rv <= LOW) A.push({ t: "low", l: `🟠 قليل (≤${LOW})`, p, k, n, rv });
    });
    const total = Object.values(st).reduce((a, v) => a + (+v || 0), 0), since = L[p.id] || Date.parse(p.arrived_at || p.created_at || 0);
    if (total > 0 && since < stale) A.push({ t: "stale", l: `💤 راكد ${L[p.id] ? Math.floor((Date.now() - L[p.id]) / dayMs) + " يوم" : "ما انباع"}`, p, k: "", n: total, rv: 0 });
  });
  BATCH.filter(b => !b.done).forEach(b => { const e = expState(b); if (e && e[0] !== "ok") A.push({ t: "exp", l: e[0] === "dead" ? `⛔ ${e[1]}` : `⏳ ${e[1]}`, p: P.find(x => x.id === b.product_id) || { id: b.product_id, brand: "", name: "#" + b.product_id }, k: b.shade, n: b.qty, rv: 0, b }); });
  const c = t => A.filter(a => a.t === t).length, units = Object.values(R).reduce((a, v) => a + v, 0);
  $("#iKpis").innerHTML = `<div><b>${c("out")}</b><small>درجات نفدت</small></div><div><b>${c("low")}</b><small>قليلة (${LOW} وأقل بعد المحجوز)</small></div><div><b>${c("stale")}</b><small>راكدة 90 يوم</small></div><div><b>${c("exp")}</b><small>صلاحية قربت أو خلصت</small></div><div><b>${units}</b><small>قطعة محجوزة بطلبات لسا ما تأكدت</small></div><div><b>${WH.length}</b><small>مخازن</small></div>`;
  $("#invN").textContent = c("out") + c("low") + c("exp") ? `(${c("out") + c("low") + c("exp")})` : "";
  const f = $("#iAlF").value;
  $("#iAlRows").innerHTML = A.filter(a => !f || a.t === f).map(a => `<tr><td>${a.l}</td><td class="nm">${esc(a.p.name)}<small>${esc(a.p.brand)}${a.b?.batch_no ? " · دفعة " + esc(a.b.batch_no) : ""}</small></td><td>${esc(a.k) || "—"}</td><td>${a.n}</td><td>${a.rv || ""}</td>
    <td>${a.t === "out" || a.t === "low" ? `<button class="sm ok" type="button" data-recv="${a.p.id}" data-rs="${esc(a.k)}">📦 استلام</button>` : a.t === "exp" ? `<button class="sm" type="button" data-bdone="${a.b.id}">خلصت</button>` : ""}</td></tr>`).join("")
    || `<tr><td colspan="6" class="hint">${P.some(p => Object.keys(p.stock || {}).length) ? "ما في تنبيهات ✓" : "لسا ما في كميات مدخلة. ادخلها من «المخزون والقيمة» أو من «استلام بضاعة»."}</td></tr>`;
}

// ===== one form for every kind of movement =====
const mvProduct = () => { const m = $("#mvP").value.match(/#(\d+)\s*$/); return m ? P.find(p => p.id === +m[1]) : null; };
function mvMode() {
  const t = $("#mvT").value;
  document.querySelectorAll("#mvF [data-mv]").forEach(l => l.hidden = l.dataset.mv !== t);
  $("#mvWl").textContent = t === "transfer" ? "من مخزن" : "المخزن";
  $("#mvQ").min = t === "manual" ? "" : "1";
}
function mvShades() {
  const p = mvProduct();
  $("#mvS").innerHTML = p ? shadesOf(p).map(k => `<option value="${esc(k)}">${esc(k) || "—"}${k in (p.stock || {}) ? ` (${p.stock[k]})` : ""}</option>`).join("") : `<option value="">—</option>`;
}
$("#mvT").addEventListener("change", mvMode);
$("#mvP").addEventListener("change", mvShades); $("#mvP").addEventListener("input", mvShades);
$("#mvGo").addEventListener("click", async e => {
  const p = mvProduct(), t = $("#mvT").value, sh = $("#mvS").value, wh = +$("#mvW").value, q = parseInt($("#mvQ").value, 10), note = $("#mvN").value.trim() || null;
  if (!p) { toast("اختار المنتج من القائمة"); return; }
  if (!q || (t !== "manual" && q < 0)) { toast("اكتب العدد"); return; }
  const b = e.target; b.disabled = true;
  let r;
  if (t === "receive") r = await db.rpc("receive_goods", { p_product: p.id, p_shade: sh, p_wh: wh, p_qty: q, p_batch: $("#mvB").value, p_mfg: $("#mvM").value || null, p_exp: $("#mvE").value || null, p_pao: +$("#mvO").value || null, p_note: note });
  else if (t === "transfer") r = await db.rpc("stock_transfer", { p_product: p.id, p_shade: sh, p_from: wh, p_to: +$("#mvW2").value, p_qty: q, p_note: note });
  else r = await db.rpc("stock_adjust", { p_product: p.id, p_shade: sh, p_wh: wh, p_delta: ["damage", "loss"].includes(t) ? -q : q, p_type: t, p_note: note });
  b.disabled = false;
  if (r.error) { toast(/not enough/.test(r.error.message) ? "الكمية بهالمخزن أقل من هيك" : /expiry/.test(r.error.message) ? "تاريخ الانتهاء لازم يكون بعد الإنتاج" : /bad transfer/.test(r.error.message) ? "اختار مخزنين مختلفين" : "ما زبط: " + r.error.message); return; }
  toast("انسجلت الحركة ✓"); ["#mvQ", "#mvB", "#mvM", "#mvE", "#mvO", "#mvN"].forEach(k => $(k).value = k === "#mvQ" ? 1 : "");
  await refreshProducts(); loadInv();
});
// the products list holds the totals: re-read it after a movement so every tab agrees
async function refreshProducts() {
  const { data } = await db.from("products").select("*").order("sort");
  if (data) { P.length = 0; P.push(...data); drawStock(); drawP(); }
}

// ===== warehouses =====
function drawWh() {
  const u = {}; WHS.forEach(s => u[s.warehouse_id] = (u[s.warehouse_id] || 0) + s.qty);
  $("#whRows").innerHTML = WH.map(w => `<tr class="${w.active ? "" : "off"}"><td class="nm">${esc(w.name)}<small>${esc(w.location || "")}</small></td><td>${u[w.id] || 0}</td>
    <td><input type="radio" name="whdef" ${w.is_default ? "checked" : ""} data-whdef="${w.id}" style="width:auto" aria-label="المخزن الرئيسي"></td><td><input type="checkbox" ${w.active ? "checked" : ""} data-whon="${w.id}" ${w.is_default ? "disabled" : ""} style="width:auto" aria-label="شغّال"></td></tr>`).join("");
}
$("#whAdd").addEventListener("click", async () => {
  const name = $("#whName").value.trim(); if (!name) { toast("اكتب اسم المخزن"); return; }
  if (!fail((await db.from("warehouses").insert({ name, location: $("#whLoc").value.trim() || null })).error)) { $("#whName").value = $("#whLoc").value = ""; loadInv(); }
});
$("#whRows").addEventListener("change", async e => {
  const d = e.target.dataset;
  if (d.whon) { if (!fail((await db.from("warehouses").update({ active: e.target.checked }).eq("id", +d.whon)).error)) loadInv(); }
  if (d.whdef) {  // one default at a time (unique index), so clear the old one first
    const old = WH.find(w => w.is_default);
    if (old && fail((await db.from("warehouses").update({ is_default: false }).eq("id", old.id)).error)) return;
    if (!fail((await db.from("warehouses").update({ is_default: true, active: true }).eq("id", +d.whdef)).error)) { toast("صار الرئيسي ✓"); loadInv(); }
  }
});

// ===== stocktake =====
function drawTake() {
  const wh = +$("#tkW").value, q = $("#tkQ").value.trim().toLowerCase(), have = {};
  WHS.filter(s => s.warehouse_id === wh).forEach(s => have[s.product_id + "|" + s.shade] = s.qty);
  const rows = [];
  P.forEach(p => { if (!Object.keys(p.stock || {}).length && !Object.keys(have).some(k => k.startsWith(p.id + "|"))) return;
    shadesOf(p).forEach(k => { if ((!q || `${p.brand} ${p.name} ${k}`.toLowerCase().includes(q))) rows.push({ p, k, n: have[p.id + "|" + k] || 0 }); }); });
  $("#tkRows").innerHTML = rows.slice(0, 400).map(r => `<tr><td class="nm">${esc(r.p.name)}<small>${esc(r.p.brand)}${r.k ? " · " + esc(r.k) : ""}</small></td><td>${r.n}</td>
    <td><input type="number" min="0" dir="ltr" data-tk="${r.p.id}" data-tks="${esc(r.k)}" data-sys="${r.n}" style="width:80px" aria-label="المعدود"></td></tr>`).join("") || `<tr><td colspan="3" class="hint">ما في كميات بهالمخزن.</td></tr>`;
}
$("#tkW").addEventListener("change", drawTake); $("#tkQ").addEventListener("input", drawTake);
$("#tkGo").addEventListener("click", async () => {
  const lines = [...document.querySelectorAll("#tkRows [data-tk]")].filter(i => i.value !== "" && +i.value !== +i.dataset.sys).map(i => ({ product_id: +i.dataset.tk, shade: i.dataset.tks, counted: +i.value }));
  if (!lines.length) { toast("ما في فروقات. اكتب المعدود بس للي بيختلف."); return; }
  if (!confirm(`رح نعدّل ${lines.length} صنف حسب الجرد. أكيد؟`)) return;
  const { data, error } = await db.rpc("stocktake", { p_wh: +$("#tkW").value, p_lines: lines });
  if (!fail(error)) { toast(`انحفظ الجرد: ${data} صنف تعدّل ✓`); await refreshProducts(); loadInv(); }
});

// ===== batches + expiry =====
function drawBatches() {
  $("#btRows").innerHTML = BATCH.map(b => { const e = expState(b), pao = b.pao_months ? `${b.pao_months}M` : "—";
    return `<tr class="${b.done ? "off" : e?.[0] === "dead" ? "late" : ""}"><td class="nm">${esc(pName(b.product_id))}${b.shade ? `<small>${esc(b.shade)}</small>` : ""}</td><td dir="ltr">${esc(b.batch_no || "—")}</td>
      <td dir="ltr">${b.mfg_date || "—"}</td><td dir="ltr">${b.exp_date || "—"}</td><td>${pao}</td><td>${b.qty}</td><td>${esc(whName(b.warehouse_id))}</td><td>${e ? e[1] : "—"}</td>
      <td><input type="checkbox" ${b.done ? "checked" : ""} data-bd="${b.id}" style="width:auto" aria-label="خلصت"></td></tr>`; }).join("") || `<tr><td colspan="9" class="hint">الدفعات بتنضاف من «استلام بضاعة» فوق.</td></tr>`;
}
$("#btRows").addEventListener("change", async e => { const id = +e.target.dataset.bd; if (id && !fail((await db.from("product_batches").update({ done: e.target.checked }).eq("id", id)).error)) loadInv(); });

// ===== movement log =====
function drawMoves() {
  const t = $("#mlT").value, q = $("#mlQ").value.trim().toLowerCase();
  $("#mlRows").innerHTML = MOVES.filter(m => (!t || m.type === t) && (!q || `${pName(m.product_id)} ${m.shade} ${m.order_id || ""} ${m.note || ""}`.toLowerCase().includes(q))).slice(0, 300).map(m =>
    `<tr><td dir="ltr">${fmt(m.at)}</td><td>${MVT[m.type] || m.type}</td><td class="nm">${esc(pName(m.product_id))}${m.shade ? `<small>${esc(m.shade)}</small>` : ""}</td>
    <td dir="ltr"><b style="color:${m.type === "transfer" ? "inherit" : m.qty < 0 ? "var(--danger)" : "#2e8b57"}">${m.type === "transfer" ? m.qty : (m.qty > 0 ? "+" : "") + m.qty}</b></td>
    <td>${esc(whName(m.warehouse_id))}${m.to_warehouse_id ? " ← " + esc(whName(m.to_warehouse_id)) : ""}</td><td>${esc(m.who || "النظام")}</td>
    <td>${m.order_id ? `<button class="sm" type="button" data-od="${m.order_id}">طلب #${m.order_id}</button> ` : ""}${esc(m.note || "")}</td></tr>`).join("") || `<tr><td colspan="7" class="hint">لسا ما في حركات.</td></tr>`;
}
$("#mlT").addEventListener("change", drawMoves); $("#mlQ").addEventListener("input", drawMoves);
$("#iAlF").addEventListener("change", drawInv);
$("#iLow").addEventListener("change", async e => {
  const v = Math.max(1, +e.target.value || 10);
  if (!fail((await db.from("settings").upsert({ key: "low_stock", value: String(v) })).error)) { LOW = v; drawInv(); toast("انحفظ ✓"); }
});
$("#iAlRows").addEventListener("click", async e => {
  const d = e.target.dataset;
  if (d.recv) { const p = P.find(x => x.id === +d.recv); $("#mvT").value = "receive"; mvMode(); $("#mvP").value = `${p.brand} – ${p.name} #${p.id}`; mvShades(); $("#mvS").value = d.rs; $("#mvQ").focus(); $("#mvF").scrollIntoView({ behavior: "smooth", block: "center" }); }
  if (d.bdone && !fail((await db.from("product_batches").update({ done: true }).eq("id", +d.bdone)).error)) loadInv();
});
document.querySelector(".tabbar").addEventListener("click", e => { if (e.target.closest("[data-tab]")?.dataset.tab === "inv" && can("stock")) loadInv(); });
$("#mlRows").addEventListener("click", e => { const id = +e.target.dataset.od; if (id) openOrder(id); });
