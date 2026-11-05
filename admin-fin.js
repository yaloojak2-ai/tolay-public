// admin-fin.js: suppliers + purchase orders (landed cost), supplier payments, expenses, capital,
// and the reports tab (sales, profit, cash flow, delivery, weekly report, Excel/PDF, documents archive).
// Uses the admin globals ($, db, esc, money, toast, fail, P, O, CO) and admin-ops.js helpers (can, fmt, r2, OST).

let SUP = [], POS = [], SPAY = [], EXP = [], CAP = [], POL = [];
const POST = { draft: "مسودة", ordered: "انطلب", received: "وصل ✓", cancelled: "ملغي" };
const EXC = { goods: "بضاعة", shipping: "شحن", delivery: "توصيل", salaries: "رواتب", ads: "إعلانات", packaging: "تغليف", subscriptions: "اشتراكات", admin: "إدارية", rent: "إيجار", other: "غير ذلك" };
const SPM = { cash: "كاش", transfer: "تحويل", check: "شيك", card: "بطاقة" };
const m2 = v => money(r2(v || 0));
const poTotal = po => r2(((po.items || []).reduce((a, it) => a + (+it.qty || 0) * (+it.unit_cost || 0), 0) + (+po.shipping || 0) + (+po.customs || 0) + (+po.fees || 0) + (+po.extra || 0)) * (+po.fx_rate || 1));
const poPaid = id => SPAY.filter(p => p.po_id === id && !p.void).reduce((a, p) => a + +p.amount, 0);
const supName = id => SUP.find(s => s.id === id)?.name || "—";
const prodOf = v => { const m = String(v || "").match(/#(\d+)\s*$/); return m ? P.find(p => p.id === +m[1]) : null; };

async function loadFin() {
  const [s, po, sp, ex, ca] = await Promise.all([
    db.from("suppliers").select("*").order("name"), db.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("supplier_payments").select("*").order("at", { ascending: false }).limit(500),
    db.from("expenses").select("*").order("day", { ascending: false }).limit(1000), db.from("capital_moves").select("*").order("day", { ascending: false }),
  ]);
  if (s.error) { $("#poRows").innerHTML = `<tr><td colspan="9" class="hint">شغّل ملف phase9.sql أول.</td></tr>`; return; }
  SUP = s.data || []; POS = po.data || []; SPAY = sp.data || []; EXP = ex.data || []; CAP = ca.data || [];
  if (!$("#mvPL").options.length) $("#mvPL").innerHTML = P.map(p => `<option value="${esc(p.brand)} – ${esc(p.name)} #${p.id}">`).join("");
  $("#poS").innerHTML = SUP.filter(x => x.active).map(x => `<option value="${x.id}">${esc(x.name)}${x.country ? " · " + esc(x.country) : ""}</option>`).join("") || `<option value="">ضيف مورد تحت أول</option>`;
  $("#exC").innerHTML = Object.entries(EXC).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  if (!$("#exD").value) $("#exD").value = new Date().toISOString().slice(0, 10);
  drawPOL(); drawPOs(); drawSup(); drawSPay(); if (!$("#t-rep").hidden || !REP.from) setPeriod(REP.per || "week");
}

// ===== new purchase order =====
function drawPOL() {
  const fx = +$("#poFx").value || 1, goods = POL.reduce((a, l) => a + l.qty * l.unit_cost, 0);
  const extras = ["#poSh", "#poCu", "#poFe", "#poEx"].reduce((a, k) => a + (+$(k).value || 0), 0);
  $("#poL").innerHTML = POL.map((l, i) => { const p = P.find(x => x.id === l.product_id), landed = (l.unit_cost + (goods ? l.unit_cost / goods * extras : 0)) * fx;
    return `<tr><td class="nm">${esc(p?.name || "#" + l.product_id)}<small>${esc(p?.brand || "")}</small></td>
      <td><select data-pl="${i}" data-k="shade">${(p ? shadesOf(p) : [""]).map(k => `<option ${k === l.shade ? "selected" : ""} value="${esc(k)}">${esc(k) || "—"}</option>`).join("")}</select></td>
      <td><input type="number" min="1" value="${l.qty}" data-pl="${i}" data-k="qty" dir="ltr" style="width:70px"></td><td><input type="number" min="0" step="0.01" value="${l.unit_cost}" data-pl="${i}" data-k="unit_cost" dir="ltr" style="width:90px"></td>
      <td><b>${m2(landed)}</b>${CO[l.product_id] != null ? `<small class="hint"> (هلأ ${m2(CO[l.product_id])})</small>` : ""}</td><td><button class="sm no" type="button" data-plrm="${i}">حذف</button></td></tr>`; }).join("")
    || `<tr><td colspan="6" class="hint">ضيف المنتجات اللي بدك تطلبها.</td></tr>`;
  $("#poTot").textContent = m2((goods + extras) * fx);
}
$("#poAdd").addEventListener("click", () => { const p = prodOf($("#poP").value); if (!p) { toast("اختار المنتج من القائمة"); return; } POL.push({ product_id: p.id, shade: shadesOf(p)[0], qty: 1, unit_cost: 0 }); $("#poP").value = ""; drawPOL(); });
$("#poL").addEventListener("change", e => { const d = e.target.dataset; if (d.pl === undefined) return; const l = POL[+d.pl]; l[d.k] = d.k === "shade" ? e.target.value : +e.target.value || 0; drawPOL(); });
$("#poL").addEventListener("click", e => { if (e.target.dataset.plrm !== undefined) { POL.splice(+e.target.dataset.plrm, 1); drawPOL(); } });
["#poFx", "#poSh", "#poCu", "#poFe", "#poEx"].forEach(k => $(k).addEventListener("input", drawPOL));
$("#poC").addEventListener("change", e => { if (e.target.value === "ILS") $("#poFx").value = 1; drawPOL(); });
async function savePO(status) {
  if (!+$("#poS").value) { toast("اختار المورد"); return; }
  if (!POL.length || POL.some(l => !(l.qty > 0))) { toast("ضيف منتجات بعدد صحيح"); return; }
  const row = { supplier_id: +$("#poS").value, status, currency: $("#poC").value, fx_rate: +$("#poFx").value || 1, items: POL,
    shipping: +$("#poSh").value || 0, customs: +$("#poCu").value || 0, fees: +$("#poFe").value || 0, extra: +$("#poEx").value || 0,
    note: $("#poN").value.trim() || null, expected_at: $("#poExp").value || null, ordered_at: status === "ordered" ? new Date().toISOString().slice(0, 10) : null };
  if (fail((await db.from("purchase_orders").insert(row)).error)) return;
  POL = []; ["#poSh", "#poCu", "#poFe", "#poEx"].forEach(k => $(k).value = 0); $("#poN").value = ""; toast("انحفظ أمر الشراء ✓"); loadFin();
}
$("#poSave").addEventListener("click", () => savePO("ordered")); $("#poDraft").addEventListener("click", () => savePO("draft"));

function drawPOs() {
  const f = $("#poF").value;
  $("#poRows").innerHTML = POS.filter(p => !f || p.status === f).map(p => { const t = poTotal(p), pd = poPaid(p.id), n = (p.items || []).reduce((a, it) => a + (+it.qty || 0), 0), late = p.status === "ordered" && p.expected_at && Date.parse(p.expected_at) < Date.now();
    return `<tr class="${p.status === "cancelled" ? "off" : late ? "late" : ""}"><td dir="ltr">#${p.id}</td><td>${esc(supName(p.supplier_id))}</td><td>${POST[p.status]}${late ? " <small class='neg'>متأخر</small>" : ""}</td>
      <td dir="ltr">${(p.received_at || p.ordered_at || p.created_at || "").slice(0, 10)}</td><td>${n}</td><td>${m2(t)}<small class="hint" dir="ltr"> ${p.currency} @${p.fx_rate}</small></td><td>${m2(pd)}</td><td class="${t - pd > 0.01 && p.status !== "cancelled" ? "neg" : ""}">${p.status === "cancelled" ? "—" : m2(t - pd)}</td>
      <td><a class="sm" href="receipt.html?po=${p.id}" target="_blank" rel="noopener">🧾</a>
        ${p.status === "draft" ? `<button class="sm" type="button" data-pord="${p.id}">اطلب</button>` : ""}
        ${["draft", "ordered"].includes(p.status) ? `<button class="sm ok" type="button" data-prcv="${p.id}">📦 وصل</button> <button class="sm no" type="button" data-pcan="${p.id}">إلغاء</button>` : ""}
        ${p.status !== "cancelled" && t - pd > 0.01 ? `<button class="sm ok" type="button" data-ppay="${p.id}">💵 دفعة</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="9" class="hint">لسا ما في أوامر شراء.</td></tr>`;
  const open = POS.filter(p => p.status !== "cancelled"), due = open.reduce((a, p) => a + Math.max(0, poTotal(p) - poPaid(p.id)), 0);
  $("#supK").innerHTML = `<div><b>${SUP.length}</b><small>موردين</small></div><div><b>${POS.filter(p => p.status === "ordered").length}</b><small>طلبيات بالطريق</small></div>
    <div><b>${m2(open.filter(p => p.status === "received").reduce((a, p) => a + poTotal(p), 0))}</b><small>مشتريات وصلت</small></div><div><b class="${due > 0 ? "neg" : ""}">${m2(due)}</b><small>علينا للموردين</small></div>`;
}
$("#poF").addEventListener("change", drawPOs);
$("#poRows").addEventListener("click", async e => {
  const d = e.target.dataset, b = e.target;
  if (d.pord && !fail((await db.from("purchase_orders").update({ status: "ordered", ordered_at: new Date().toISOString().slice(0, 10) }).eq("id", +d.pord)).error)) loadFin();
  if (d.pcan && confirm("تلغي أمر الشراء؟") && !fail((await db.from("purchase_orders").update({ status: "cancelled" }).eq("id", +d.pcan)).error)) loadFin();
  if (d.prcv) {
    const { data: whs } = await db.from("warehouses").select("id,name,is_default").eq("active", true);
    const list = whs || []; if (!list.length) { toast("شغّل phase8.sql أول (المخازن)"); return; }
    const pick = list.length === 1 ? list[0] : list.find(w => w.name === prompt("لأي مخزن؟\n" + list.map(w => w.name).join("\n"), list.find(w => w.is_default)?.name || list[0].name));
    if (!pick || !confirm(`نستلم أمر الشراء #${d.prcv} بـ«${pick.name}»؟ الكميات بتنضاف وتكلفة كل منتج بتتحدّث (متوسط مرجّح).`)) return;
    b.disabled = true; const { error } = await db.rpc("receive_po", { p_id: +d.prcv, p_wh: pick.id }); b.disabled = false;
    if (!fail(error)) { toast("وصلت البضاعة وانحدّثت التكاليف ✓"); const co = await db.from("product_costs").select("*"); (co.data || []).forEach(r => CO[r.product_id] = r.cost); if (window.refreshProducts) await refreshProducts(); loadFin(); if (window.loadInv && can("stock")) loadInv(); }
  }
  if (d.ppay) { const po = POS.find(p => p.id === +d.ppay), left = r2(poTotal(po) - poPaid(po.id)); const v = +prompt(`كم دفعت للمورد ${supName(po.supplier_id)}؟ (₪) الباقي ${left}`, left); if (!(v > 0)) return;
    const meth = (prompt("الطريقة: transfer / cash / check / card", "transfer") || "transfer").trim();
    if (!fail((await db.from("supplier_payments").insert({ supplier_id: po.supplier_id, po_id: po.id, amount: v, method: SPM[meth] ? meth : "transfer" })).error)) { toast("انسجلت الدفعة ✓"); loadFin(); } }
});

// ===== suppliers =====
function drawSup() {
  $("#suRows").innerHTML = SUP.map(s => { const pos = POS.filter(p => p.supplier_id === s.id && p.status !== "cancelled"), bought = pos.reduce((a, p) => a + poTotal(p), 0), paid = SPAY.filter(p => p.supplier_id === s.id && !p.void).reduce((a, p) => a + +p.amount, 0);
    return `<tr class="${s.active ? "" : "off"}"><td class="nm"><b>${esc(s.name)}</b><small>${esc([s.country, s.contact].filter(Boolean).join(" · "))}</small></td>
      <td class="nm">${esc(s.payment_terms || "—")}<small>${[s.discount_pct ? `خصم ${s.discount_pct}%` : "", s.shipping_cost ? `شحن ${s.shipping_cost}` : "", s.min_order ? `أقل طلبية ${s.min_order}` : "", s.currency].filter(Boolean).join(" · ")}</small></td>
      <td>${m2(bought)}<small class="hint"> (${pos.length})</small></td><td class="${bought - paid > 0.01 ? "neg" : ""}">${m2(bought - paid)}</td>
      <td><a class="sm" href="receipt.html?supplier=${s.id}" target="_blank" rel="noopener">كشف حساب</a> <input type="checkbox" ${s.active ? "checked" : ""} data-suon="${s.id}" style="width:auto" aria-label="شغّال"></td></tr>`; }).join("") || `<tr><td colspan="5" class="hint">ضيف أول مورد.</td></tr>`;
}
$("#suAdd").addEventListener("click", async () => {
  const name = $("#suName").value.trim(); if (!name) { toast("اكتب اسم المورد"); return; }
  const n = k => $(k).value === "" ? null : +$(k).value;
  const row = { name, country: $("#suCo").value.trim() || null, contact: $("#suCt").value.trim() || null, payment_terms: $("#suTerms").value.trim() || null, discount_pct: n("#suDisc") || 0, shipping_cost: n("#suShip"), currency: $("#suCur").value.trim().toUpperCase() || "USD", min_order: n("#suMin") };
  if (!fail((await db.from("suppliers").insert(row)).error)) { ["#suName", "#suCo", "#suCt", "#suTerms", "#suDisc", "#suShip", "#suMin"].forEach(k => $(k).value = ""); toast("انضاف المورد ✓"); loadFin(); }
});
$("#suRows").addEventListener("change", async e => { const id = +e.target.dataset.suon; if (id && !fail((await db.from("suppliers").update({ active: e.target.checked }).eq("id", id)).error)) loadFin(); });
function drawSPay() {
  $("#spRows").innerHTML = SPAY.slice(0, 100).map(p => `<tr class="${p.void ? "off" : ""}"><td dir="ltr">${fmt(p.at)}</td><td>${esc(supName(p.supplier_id))}${p.po_id ? ` <small class="hint">#${p.po_id}</small>` : ""}</td><td>${m2(p.amount)}</td><td>${SPM[p.method] || p.method}</td>
    <td>${p.void ? "<small class='hint'>ملغية</small>" : `<button class="sm no" type="button" data-spv="${p.id}">إلغاء</button>`}</td></tr>`).join("") || `<tr><td colspan="5" class="hint">ما في دفعات.</td></tr>`;
}
$("#spRows").addEventListener("click", async e => { const id = +e.target.dataset.spv; if (id && confirm("تلغي هالدفعة؟ بتضل بالسجل.") && !fail((await db.from("supplier_payments").update({ void: true }).eq("id", id)).error)) loadFin(); });

// ===== reports =====
const REP = { per: "", from: null, to: null, data: null };
const isoD = d => d.toISOString().slice(0, 10);
function setPeriod(per) {
  const now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let f, t = new Date(d0.getTime() + 864e5);
  if (per === "week") f = new Date(t - 7 * 864e5);
  else if (per === "lastweek") { t = new Date(t - 7 * 864e5); f = new Date(t - 7 * 864e5); }
  else if (per === "month") f = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (per === "lastmonth") { f = new Date(now.getFullYear(), now.getMonth() - 1, 1); t = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (per === "year") f = new Date(now.getFullYear(), 0, 1);
  REP.per = per; $("#rFrom").value = isoD(f); $("#rTo").value = isoD(new Date(t - 864e5));
  document.querySelectorAll("[data-per]").forEach(b => b.setAttribute("aria-pressed", b.dataset.per === per));
  loadReport();
}
async function loadReport() {
  const f = $("#rFrom").value, t = $("#rTo").value; if (!f || !t) return;
  REP.from = f; REP.to = t; const gte = f + "T00:00:00", lt = isoD(new Date(Date.parse(t) + 864e5)) + "T00:00:00";
  $("#rTitle").textContent = `تقرير Tolay Makeup · ${f} ← ${t}`;
  $("#rBody").innerHTML = `<p class="hint">لحظة…</p>`;
  const [o, oc, pay, sh, al, sl] = await Promise.all([
    db.from("orders").select("id,created_at,status,kind,total,delivery,discount,coupon_off,items,user_id,name,phone,paid,payment").gte("created_at", gte).lt("created_at", lt).limit(5000),
    db.from("order_costs").select("*"), db.from("payments").select("*").gte("at", gte).lt("at", lt),
    db.from("shipments").select("*").gte("sent_at", gte).lt("sent_at", lt), db.from("restock_alerts").select("product_id,shade,created_at").gte("created_at", gte).lt("created_at", lt),
    db.from("search_log").select("term,results").gte("created_at", gte).lt("created_at", lt).limit(5000),
  ]);
  REP.data = { O: o.data || [], OC: Object.fromEntries((oc.data || []).map(r => [r.order_id, r])), PAY: pay.data || [], SH: sh.data || [], AL: al.data || [], SL: sl.data || [], gte, lt };
  drawReport();
}
const LIVE = ["confirmed", "preparing", "packed", "ready", "shipped", "delivered"];
function drawReport() {
  const R = REP.data; if (!R) return;
  const inP = d => d && d >= R.gte.slice(0, 10) && d < R.lt.slice(0, 10);
  const sold = R.O.filter(o => LIVE.includes(o.status)), net = o => (+o.total || 0) - (+o.delivery || 0);
  const sales = sold.reduce((a, o) => a + net(o), 0), delivery = sold.reduce((a, o) => a + (+o.delivery || 0), 0);
  let cogs = 0, noCost = 0;
  sold.forEach(o => { const c = R.OC[o.id]; if (c && c.cogs != null && !c.missing) cogs += +c.cogs; else (o.items || []).forEach(it => { if (CO[it.id] != null) cogs += CO[it.id] * it.qty; else noCost += it.qty; }); });
  const exps = EXP.filter(x => !x.void && inP(x.day)), expT = exps.reduce((a, x) => a + +x.amount, 0);
  const gross = sales - cogs, netP = gross - expT, margin = sales ? netP / sales * 100 : 0;
  // cash flow: money that actually moved in the period
  const payIn = R.PAY.filter(p => !p.void && !p.refund).reduce((a, p) => a + +p.amount, 0), refunds = R.PAY.filter(p => !p.void && p.refund).reduce((a, p) => a + +p.amount, 0);
  const supOut = SPAY.filter(p => !p.void && inP(p.at.slice(0, 10))).reduce((a, p) => a + +p.amount, 0);
  const capIn = CAP.filter(c => !c.void && c.kind === "in" && inP(c.day)).reduce((a, c) => a + +c.amount, 0), capOut = CAP.filter(c => !c.void && c.kind === "out" && inP(c.day)).reduce((a, c) => a + +c.amount, 0);
  const cash = payIn + capIn - refunds - supOut - expT - capOut;
  const k = (v, l, cls = "") => `<div><b class="${cls}">${v}</b><small>${l}</small></div>`;
  $("#rK").innerHTML = k(m2(sales), `صافي المبيعات (${sold.length} طلب)`) + k(m2(cogs), `تكلفة البضاعة المباعة${noCost ? ` · ${noCost} قطعة بدون تكلفة` : ""}`) + k(m2(gross), "الربح الإجمالي", gross < 0 ? "neg" : "pos")
    + k(m2(expT), "المصاريف") + k(m2(netP), "صافي الربح", netP < 0 ? "neg" : "pos") + k(margin.toFixed(1) + "%", "هامش الربح")
    + k(m2(sold.length ? sales / sold.length : 0), "متوسط الطلب") + k(m2(delivery), "رسوم توصيل محصّلة") + k(m2(cash), "صافي الكاش بالفترة", cash < 0 ? "neg" : "pos");

  const group = (rows, key, val) => { const g = {}; rows.forEach(r => { const kk = key(r); g[kk] = (g[kk] || 0) + val(r); }); return Object.entries(g).sort((a, b) => b[1] - a[1]); };
  const lines = sold.flatMap(o => (o.items || []).map(it => ({ ...it, o })));
  const tbl = (title, rows, fmtv = m2, n = 12) => { const mx = Math.max(...rows.map(r => Math.abs(r[1])), 1);
    return `<div><h3>${title}</h3><div class="tbl"><table><tbody>${rows.slice(0, n).map(([a, v]) => `<tr><td class="nm">${esc(a)}<span class="bars"><i style="width:${Math.round(Math.abs(v) / mx * 100)}%"></i></span></td><td>${fmtv(v)}</td></tr>`).join("") || `<tr><td class="hint">ما في بيانات.</td></tr>`}</tbody></table></div></div>`; };
  const stCount = Object.keys(OST).map(s => [OST[s], R.O.filter(o => o.status === s).length, R.O.filter(o => o.status === s).reduce((a, o) => a + (+o.total || 0), 0)]).filter(r => r[1]);
  const late = R.SH.filter(s => s.status === "sent" && Date.now() - Date.parse(s.sent_at) > 3 * 864e5);
  const shRows = [["طلع", R.SH.length], ["انسلّم", R.SH.filter(s => s.status === "delivered").length], ["متأخر (+3 أيام)", late.length], ["رفض الزبون", R.SH.filter(s => s.status === "refused").length], ["رجع", R.SH.filter(s => s.status === "returned").length], ["ضاع", R.SH.filter(s => s.status === "lost").length]];
  const cod = R.SH.filter(s => s.status === "delivered").reduce((a, s) => a + +s.cod, 0), fees = R.SH.reduce((a, s) => a + +s.fee, 0), owed = R.SH.filter(s => s.status === "delivered" && !s.settled).reduce((a, s) => a + +s.cod - +s.fee, 0);
  const ret = R.O.filter(o => ["returned", "refused"].includes(o.status));
  const months = {}; // profit by month inside the period
  sold.forEach(o => { const mo = o.created_at.slice(0, 7), c = R.OC[o.id]; months[mo] = months[mo] || { s: 0, c: 0, e: 0 }; months[mo].s += net(o); months[mo].c += c && !c.missing ? +c.cogs : (o.items || []).reduce((a, it) => a + (CO[it.id] || 0) * it.qty, 0); });
  exps.forEach(x => { const mo = x.day.slice(0, 7); months[mo] = months[mo] || { s: 0, c: 0, e: 0 }; months[mo].e += +x.amount; });
  const docs = [...R.O.map(o => ({ at: o.created_at, t: "فاتورة بيع", l: `#${o.id} · ${o.name}`, u: `invoice.html?id=${o.id}` })),
    ...R.PAY.map(p => ({ at: p.at, t: p.refund ? "سند صرف (استرجاع)" : "سند قبض", l: `R-${p.id} · ${p.name} · ${m2(p.amount)}`, u: `receipt.html?id=${p.id}` })),
    ...POS.filter(p => inP((p.created_at || "").slice(0, 10))).map(p => ({ at: p.created_at, t: "أمر شراء", l: `#${p.id} · ${supName(p.supplier_id)}`, u: `receipt.html?po=${p.id}` })),
    ...R.O.filter(o => R.SH.some(s => s.order_id === o.id)).map(o => ({ at: o.created_at, t: "مستند شحن", l: `#${o.id} · ${o.name}`, u: `invoice.html?id=${o.id}&t=label` }))].sort((a, b) => a.at < b.at ? 1 : -1);
  REP.csv = { sales, cogs, gross, expT, netP, margin, payIn, refunds, supOut, capIn, capOut, cash, delivery, n: sold.length,
    brand: group(lines, l => l.brand || "—", l => (+l.unit || 0) * l.qty), prod: group(lines, l => `${l.brand} – ${l.name}`, l => (+l.unit || 0) * l.qty),
    cust: group(sold, o => o.name || o.phone || "—", o => net(o)), exc: group(exps, x => EXC[x.category], x => +x.amount), stCount, months };
  $("#rBody").innerHTML = `<div class="rgrid">
    ${tbl("مفرق مقابل جملة", group(sold, o => o.kind === "wholesale" ? "جملة" : "مفرق", net))}
    ${tbl("المبيعات حسب الماركة", REP.csv.brand)}
    ${tbl("أكثر المنتجات مبيعاً (بالقيمة)", REP.csv.prod)}
    ${tbl("أكثر المنتجات مبيعاً (بالقطع)", group(lines, l => `${l.brand} – ${l.name}`, l => l.qty), v => v + " قطعة")}
    ${tbl("أكبر الزباين والتجار", REP.csv.cust)}
    ${tbl("المصاريف حسب النوع", REP.csv.exc)}
    <div><h3>الطلبات حسب الحالة</h3><div class="tbl"><table><tbody>${stCount.map(([a, n, v]) => `<tr><td>${a}</td><td>${n}</td><td>${m2(v)}</td></tr>`).join("") || `<tr><td class="hint">ما في طلبات.</td></tr>`}</tbody></table></div>
      <p class="hint">طلبات استلمناها: ${R.O.length} · انطلبت ولسا ما تأكدت: ${R.O.filter(o => ["new", "pending"].includes(o.status)).length} · مرتجعات ومرفوضة: ${ret.length} (${m2(ret.reduce((a, o) => a + (+o.total || 0), 0))})</p></div>
    <div><h3>تقرير التوصيل</h3><div class="tbl"><table><tbody>${shRows.map(([a, n]) => `<tr><td>${a}</td><td>${n}</td></tr>`).join("")}
      <tr><td>انحصّل من الزباين</td><td>${m2(cod)}</td></tr><tr><td>رسوم شركات التوصيل</td><td>${m2(fees)}</td></tr><tr><td>مستحق إلنا عند الشركات</td><td class="${owed > 0 ? "neg" : ""}">${m2(owed)}</td></tr></tbody></table></div></div>
    <div><h3>التدفق النقدي</h3><div class="tbl"><table><tbody>
      <tr><td>⬆️ دفعات الزباين</td><td class="pos">${m2(payIn)}</td></tr><tr><td>⬆️ رأس مال انحط</td><td class="pos">${m2(capIn)}</td></tr>
      <tr><td>⬇️ استرجاع للزباين</td><td class="neg">${m2(refunds)}</td></tr><tr><td>⬇️ دفعات للموردين</td><td class="neg">${m2(supOut)}</td></tr><tr><td>⬇️ مصاريف</td><td class="neg">${m2(expT)}</td></tr><tr><td>⬇️ سحوبات</td><td class="neg">${m2(capOut)}</td></tr>
      <tr><td><b>الصافي</b></td><td><b class="${cash < 0 ? "neg" : "pos"}">${m2(cash)}</b></td></tr></tbody></table></div></div>
    <div><h3>الأرباح حسب الشهر</h3><div class="tbl"><table><thead><tr><th>الشهر</th><th>مبيعات</th><th>تكلفة</th><th>مصاريف</th><th>صافي</th></tr></thead><tbody>${Object.entries(months).sort().map(([mo, v]) => `<tr><td dir="ltr">${mo}</td><td>${m2(v.s)}</td><td>${m2(v.c)}</td><td>${m2(v.e)}</td><td class="${v.s - v.c - v.e < 0 ? "neg" : "pos"}">${m2(v.s - v.c - v.e)}</td></tr>`).join("") || `<tr><td colspan="5" class="hint">—</td></tr>`}</tbody></table></div></div>
    ${tbl("طلبات منتجات مش متوفرة (نبّهوني)", group(R.AL, a => { const p = P.find(x => x.id === a.product_id); return p ? `${p.brand} – ${p.name}${a.shade ? " · " + a.shade : ""}` : "#" + a.product_id; }, () => 1), v => v + " طلب")}
    ${tbl("كلمات انبحثت وما لقت نتيجة", group(R.SL.filter(s => !s.results), s => s.term.toLowerCase().trim(), () => 1), v => v + " مرة")}
    <div class="noprint"><h3>المصاريف بالفترة</h3><div class="tbl" style="max-height:300px"><table><tbody>${exps.map(x => `<tr><td dir="ltr">${x.day}</td><td>${EXC[x.category]}</td><td>${m2(x.amount)}</td><td>${esc(x.note || "")}</td><td><button class="sm no" type="button" data-exv="${x.id}">إلغاء</button></td></tr>`).join("") || `<tr><td class="hint">ما في مصاريف.</td></tr>`}</tbody></table></div>
      <h3 style="margin-top:12px">حركات رأس المال (كلها)</h3><div class="tbl" style="max-height:200px"><table><tbody>${CAP.filter(c => !c.void).map(c => `<tr><td dir="ltr">${c.day}</td><td>${c.kind === "in" ? "⬆️ انحط" : "⬇️ انسحب"}</td><td>${m2(c.amount)}</td><td>${esc(c.note || "")}</td><td><button class="sm no" type="button" data-cav="${c.id}">إلغاء</button></td></tr>`).join("") || `<tr><td class="hint">—</td></tr>`}</tbody></table></div>
      <p class="hint">رأس المال الكلي: ${m2(CAP.filter(c => !c.void).reduce((a, c) => a + (c.kind === "in" ? +c.amount : -c.amount), 0))} · انصرف منه على بضاعة (دفعات موردين): ${m2(SPAY.filter(p => !p.void).reduce((a, p) => a + +p.amount, 0))} · مصاريف كلها: ${m2(EXP.filter(x => !x.void).reduce((a, x) => a + +x.amount, 0))}</p></div>
    <div class="noprint"><h3>📁 أرشيف الوثائق بالفترة</h3><div class="bar"><select id="dcT"><option value="">كل الوثائق</option>${[...new Set(docs.map(d => d.t))].map(t => `<option>${t}</option>`).join("")}</select>
      ${[...new Set(SUP.map(s => s.id))].length ? `<span class="hint">كشوفات الموردين من تبويب الموردين، وكشوفات الزباين من «الحسابات».</span>` : ""}</div>
      <div class="tbl" style="max-height:340px"><table><tbody id="dcRows">${docRows(docs)}</tbody></table></div></div>
  </div>`;
  REP.docs = docs;
}
const docRows = docs => docs.slice(0, 400).map(d => `<tr><td dir="ltr">${fmt(d.at)}</td><td>${d.t}</td><td>${esc(d.l)}</td><td><a class="sm" href="${d.u}" target="_blank" rel="noopener">فتح / PDF</a></td></tr>`).join("") || `<tr><td class="hint">ما في وثائق.</td></tr>`;
document.addEventListener("change", e => { if (e.target.id === "dcT") $("#dcRows").innerHTML = docRows(REP.docs.filter(d => !e.target.value || d.t === e.target.value)); });
document.querySelectorAll("[data-per]").forEach(b => b.addEventListener("click", () => setPeriod(b.dataset.per)));
["#rFrom", "#rTo"].forEach(k => $(k).addEventListener("change", () => { REP.per = ""; document.querySelectorAll("[data-per]").forEach(b => b.setAttribute("aria-pressed", false)); loadReport(); }));
$("#rPrint").addEventListener("click", () => print());
// Excel: a CSV with a BOM so Excel opens Arabic correctly
$("#rCsv").addEventListener("click", () => {
  const c = REP.csv; if (!c) return;
  const rows = [["تقرير Tolay Makeup", REP.from, REP.to], [], ["البند", "القيمة"], ["صافي المبيعات", c.sales], ["عدد الطلبات", c.n], ["تكلفة البضاعة المباعة", c.cogs], ["الربح الإجمالي", c.gross], ["المصاريف", c.expT], ["صافي الربح", c.netP], ["هامش الربح %", c.margin.toFixed(1)], ["رسوم التوصيل", c.delivery],
    ["دفعات الزباين", c.payIn], ["استرجاع", c.refunds], ["دفعات الموردين", c.supOut], ["رأس مال انحط", c.capIn], ["سحوبات", c.capOut], ["صافي الكاش", c.cash],
    [], ["الماركة", "المبيعات"], ...c.brand, [], ["المنتج", "المبيعات"], ...c.prod, [], ["الزبون", "المبيعات"], ...c.cust, [], ["المصروف", "المبلغ"], ...c.exc,
    [], ["الحالة", "عدد", "قيمة"], ...c.stCount, [], ["الشهر", "مبيعات", "تكلفة", "مصاريف", "صافي"], ...Object.entries(c.months).sort().map(([m, v]) => [m, r2(v.s), r2(v.c), r2(v.e), r2(v.s - v.c - v.e)])];
  const csv = "﻿" + rows.map(r => r.map(v => `"${String(typeof v === "number" ? r2(v) : v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `tolay-report-${REP.from}_${REP.to}.csv`; a.click();
});
$("#exAdd").addEventListener("click", async () => {
  const amount = +$("#exA").value; if (!(amount > 0)) { toast("اكتب المبلغ"); return; }
  if (!fail((await db.from("expenses").insert({ day: $("#exD").value || null, category: $("#exC").value, amount, note: $("#exN").value.trim() || null })).error)) { $("#exA").value = $("#exN").value = ""; toast("انسجل المصروف ✓"); await loadFin(); drawReport(); }
});
$("#caAdd").addEventListener("click", async () => {
  const amount = +$("#caA").value; if (!(amount > 0)) { toast("اكتب المبلغ"); return; }
  if (!fail((await db.from("capital_moves").insert({ kind: $("#caK").value, amount, note: $("#caN").value.trim() || null })).error)) { $("#caA").value = $("#caN").value = ""; toast("انحفظ ✓"); await loadFin(); drawReport(); }
});
$("#rBody").addEventListener("click", async e => {
  const d = e.target.dataset;
  if (d.exv && confirm("تلغي هالمصروف؟ بيضل بالسجل.") && !fail((await db.from("expenses").update({ void: true }).eq("id", +d.exv)).error)) { await loadFin(); drawReport(); }
  if (d.cav && confirm("تلغي هالحركة؟ بتضل بالسجل.") && !fail((await db.from("capital_moves").update({ void: true }).eq("id", +d.cav)).error)) { await loadFin(); drawReport(); }
});
document.querySelector(".tabbar").addEventListener("click", e => { const t = e.target.closest("[data-tab]")?.dataset.tab; if ((t === "sup" || t === "rep") && can("finance")) loadFin(); });
