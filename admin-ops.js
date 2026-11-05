// admin-ops.js: staff permissions, the order desk, delivery companies + shipments, customer accounts + receipts, audit log.
// Runs after the main admin script and uses its globals ($, db, esc, money, toast, fail, P, O, OST, PERMS, ME, STAFF).

const TABPERM = { orders: "orders", alerts: "orders", products: "products", cats: "products", stock: "stock", inv: "stock", sup: "finance", rep: "finance", traders: "traders", coins: "marketing", battles: "marketing", searches: "marketing", mkt: "marketing", reviews: "marketing", delivery: "delivery", money: "finance", settings: "settings", audit: "audit", staff: "owner" };
const PERM_LABEL = { orders: "الطلبات وطلبات التنبيه", products: "المنتجات والأقسام", stock: "المخزون", traders: "التجار", marketing: "التسويق والنقاط والتقييمات", delivery: "التوصيل والشحن", finance: "المالية (التكلفة، الأرباح، الدفعات)", settings: "الإعدادات", audit: "سجل العمليات" };
const can = p => PERMS.includes("all") || PERMS.includes(p);
const staffName = id => { const s = STAFF.find(x => x.id === id); return s ? s.full_name || s.email : "—"; };
const r2 = n => Math.round(n * 100) / 100;
const fmt = v => v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const waNo = ph => { const d = String(ph || "").replace(/\D/g, ""); return !d ? "" : d.startsWith("0") ? "972" + d.slice(1) : d; };
const ZONE = { 20: "الضفة الغربية", 30: "القدس", 70: "الداخل" };

function gateTabs() {
  document.querySelectorAll(".tabbar [data-tab]").forEach(b => b.hidden = !can(TABPERM[b.dataset.tab] || "owner"));
  document.body.classList.toggle("nofin", !can("finance"));
  $("#ost").innerHTML = `<option value="">كل الطلبات</option>` + Object.entries(OST).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  if (!can("orders")) [...document.querySelectorAll(".tabbar [data-tab]")].find(b => !b.hidden)?.click();
}

async function loadOps() {
  const { data } = await db.from("profiles").select("id,full_name,email,role,perms").in("role", ["admin", "staff"]);
  STAFF = data || [];
  $("#oas").innerHTML = `<option value="">كل الموظفين</option><option value="me">طلباتي أنا</option><option value="none">بدون مسؤول</option>` + STAFF.map(s => `<option value="${s.id}">${esc(s.full_name || s.email)}</option>`).join("");
  drawO();
  if (can("delivery")) loadDelivery();
  if (can("finance")) loadMoney();
  if (can("owner")) drawStaff();
  if (can("audit")) loadAudit();
  if (can("stock") && window.loadInv) loadInv();
  if (can("finance") && window.loadFin) loadFin();
}

// ===== order desk =====
let OD = null, SHIPS = [], COUR = [];
function notifyText(o) {
  const base = `${location.origin}${location.pathname.replace(/admin\.html$/, "")}`;
  const t = {
    new: `مرحبا ${o.name} 💗 استلمنا طلبك رقم #${o.id} من Tolay Makeup وعم نراجعه.`,
    pending: `مرحبا ${o.name} 💗 طلبك رقم #${o.id} بانتظار التأكيد. ممكن تأكديلنا العنوان؟`,
    confirmed: `تأكد طلبك رقم #${o.id} ✓ المجموع ${money(o.total)}. رح نبلشه بالتجهيز.`,
    preparing: `طلبك رقم #${o.id} عم يتجهز هلأ 🎁`, packed: `طلبك رقم #${o.id} تغلّف وجاهز 🎀`, ready: `طلبك رقم #${o.id} جاهز للشحن 📦`,
    shipped: `طلبك رقم #${o.id} طلع مع الشوفير 🚚 الدفع عند الاستلام وبتقدري تفحصيه قدامه. تتبعيه هون: ${base}#/track`,
    delivered: `وصلك طلبك رقم #${o.id} 💗 شكراً إنك اخترتي Tolay! بنستنى رأيك وتقييمك بالموقع.`,
    cancelled: `تم إلغاء طلبك رقم #${o.id}. لأي استفسار احكينا هون.`,
    returned: `استلمنا الطلب رقم #${o.id} كمرتجع. لأي استفسار احكينا.`, refused: `الطلب رقم #${o.id} رجع بدون استلام. بدك نرجع نبعته؟`,
  };
  return t[o.status] || t.new;
}
function odTotals() {
  const unknown = OD.items.some(i => i.unit == null || i.unit === ""), sub = OD.items.reduce((a, i) => a + (+i.unit || 0) * i.qty, 0);
  return { sub: unknown ? null : r2(sub), total: unknown ? null : r2(sub - (+OD.discount || 0) + (+OD.delivery || 0)) };
}
function openOrder(id) {
  const o = O.find(x => x.id === id); if (!o) return;
  OD = { ...o, items: o.items.map(i => ({ ...i })) };
  drawOD(); $("#od").showModal(); loadODHistory();
}
function drawOD() {
  const o = OD, t = odTotals(), wa = waNo(o.phone), sh = SHIPS.find(s => s.order_id === o.id), closed = ["delivered", "cancelled", "returned", "refused"].includes(o.status);
  $("#odBody").innerHTML = `
  <div class="odh"><h2>طلب #${o.id}</h2><span class="hint">${fmt(o.created_at)} · ${o.kind === "wholesale" ? "جملة" : "مفرق"} · ${o.payment === "credit" ? "دين/أقساط" : "كاش"}${o.coupon ? ` · كود ${esc(o.coupon)}` : ""}${o.merged_into ? ` · اندمج بطلب #${o.merged_into}` : ""}</span></div>
  <div class="odg">
    <label>الحالة<select id="odSt">${Object.entries(OST).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label>الموظف المسؤول<select id="odAs"><option value="">—</option>${STAFF.map(s => `<option value="${s.id}" ${s.id === o.assigned_to ? "selected" : ""}>${esc(s.full_name || s.email)}</option>`).join("")}</select></label>
    <div class="odc"><b>${esc(o.name)}</b><span dir="ltr">${esc(o.phone || "")}</span>${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener">واتساب</a> · <a href="tel:${esc(o.phone)}">اتصال</a>` : ""}<small style="display:block">${esc(o.address || "")}</small>${o.note ? `<small>📝 ${esc(o.note)}</small>` : ""}</div>
  </div>
  <h3>المنتجات</h3>
  <div class="tbl"><table><thead><tr><th title="للتقسيم">✂️</th><th>المنتج</th><th>العدد</th><th>السعر</th><th>المجموع</th><th></th></tr></thead><tbody>
    ${o.items.map((it, i) => `<tr><td><input type="checkbox" data-split="${i}" style="width:auto" aria-label="اختار للتقسيم"></td><td class="nm">${esc(it.name)}<small>${esc(it.brand)}${it.shade ? " · " + esc(it.shade) : ""}</small></td>
      <td><input type="number" min="1" value="${it.qty}" data-oi="${i}" data-k="qty" style="width:70px" dir="ltr"></td><td><input type="number" step="0.01" min="0" value="${it.unit ?? ""}" data-oi="${i}" data-k="unit" style="width:90px" dir="ltr"></td>
      <td>${it.unit != null && it.unit !== "" ? money(r2(it.unit * it.qty)) : "—"}</td><td><button class="sm no" type="button" data-odrm="${i}">حذف</button></td></tr>`).join("") || `<tr><td colspan="6" class="hint">ما في منتجات.</td></tr>`}
  </tbody></table></div>
  <div class="bar"><select id="odAddP" style="flex:1 1 240px"><option value="">+ ضيف منتج للطلب…</option>${P.map(p => `<option value="${p.id}">${esc(p.brand)} – ${esc(p.name)}</option>`).join("")}</select><input id="odAddS" placeholder="الدرجة (اختياري)" style="width:140px"><input id="odAddQ" type="number" min="1" value="1" style="width:70px" dir="ltr"><button class="sm" type="button" id="odAdd">إضافة</button></div>
  <div class="odsum">
    <label>الخصم ₪<input type="number" step="0.01" min="0" value="${+o.discount || 0}" id="odDisc" dir="ltr"></label>
    <label>التوصيل ₪<input type="number" step="0.01" min="0" value="${+o.delivery || 0}" id="odDel" dir="ltr"></label>
    <div><small class="hint">المنتجات</small><b>${money(t.sub)}</b></div><div><small class="hint">المبلغ النهائي</small><b>${money(t.total)}</b></div>
    ${can("finance") ? `<div><small class="hint">مدفوع</small><b>${money(+o.paid || 0)}</b></div><div><small class="hint">ضل</small><b>${t.total == null ? "—" : money(r2(t.total - (+o.paid || 0)))}</b></div>` : ""}
    <button class="btn" type="button" id="odSave">حفظ تعديلات المنتجات</button>
  </div>
  <div class="bar odact">
    <a class="sm" href="invoice.html?id=${o.id}" target="_blank" rel="noopener">🧾 فاتورة</a>
    <a class="sm" href="invoice.html?id=${o.id}&t=label" target="_blank" rel="noopener">🏷️ ملصق الشحن</a>
    ${wa ? `<a class="sm" href="https://wa.me/${wa}?text=${encodeURIComponent(notifyText(o))}" target="_blank" rel="noopener">📲 إشعار للزبون (${esc(OST[o.status])})</a>` : ""}
    ${closed ? "" : `<button class="sm" type="button" id="odSplit">✂️ تقسيم المحدد لطلب جديد</button><span class="bar" style="gap:4px"><input id="odMergeN" type="number" placeholder="رقم طلب ثاني" style="width:120px" dir="ltr"><button class="sm" type="button" id="odMerge">🔗 دمجه بهالطلب</button></span>`}
  </div>
  ${can("delivery") ? `<h3>الشحن</h3>${sh ? `<p class="hint">🚚 ${esc(COUR.find(c => c.id === sh.courier_id)?.name || "")}${sh.driver ? " · المندوب " + esc(sh.driver) : ""}${sh.tracking_no ? ` · رقم الشحنة <b dir="ltr">${esc(sh.tracking_no)}</b>` : ""} · ${SHST[sh.status]} · يحصّل ${money(sh.cod)}</p>`
    : closed ? `<p class="hint">الطلب مسكّر.</p>` : `<div class="bar"><select id="shC">${COUR.filter(c => c.active).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("") || `<option value="">ضيف شركة توصيل من تبويب التوصيل</option>`}</select>
      <input id="shDrv" placeholder="اسم المندوب" style="width:130px"><input id="shNo" placeholder="رقم الشحنة" dir="ltr" style="width:120px">
      <label class="hint">يحصّل ₪<input id="shCod" type="number" step="0.01" min="0" value="${t.total == null ? "" : r2(t.total - (+o.paid || 0))}" dir="ltr" style="width:90px"></label><button class="sm ok" type="button" id="shMake">🚚 إنشاء شحنة</button></div>`}` : ""}
  ${can("finance") ? `<h3>تسجيل دفعة</h3><div class="bar"><input id="pyAmt" type="number" step="0.01" min="0.01" placeholder="المبلغ" dir="ltr" style="width:110px" value="${t.total == null ? "" : Math.max(0, r2(t.total - (+o.paid || 0))) || ""}">
      <select id="pyM">${Object.entries(PAYM).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><input id="pyNote" placeholder="ملاحظة" style="flex:1 1 140px"><label class="hint"><input type="checkbox" id="pyRf" style="width:auto"> استرجاع للزبون</label><button class="sm ok" type="button" id="pyAdd">💵 سجّل واطبع سند قبض</button></div>` : ""}
  <h3>ملاحظات الفريق</h3>
  <ul class="notes">${(o.notes || []).map(n => `<li><small>${fmt(n.at)}${n.by ? " · " + esc(n.by) : ""}</small>${esc(n.text)}</li>`).join("") || `<li class="hint">ما في ملاحظات.</li>`}</ul>
  <div class="bar"><input id="odNote" placeholder="اكتب ملاحظة للفريق…" style="flex:1"><button class="sm" type="button" id="odNoteAdd">إضافة</button></div>
  <h3>سجل الطلب</h3><ul class="notes" id="odHist"><li class="hint">لحظة…</li></ul>`;
}
async function loadODHistory() {
  const o = OD, rows = (o.status_log || []).map(x => ({ at: x.at, txt: `صار "${OST[x.s] || x.s}"`, by: x.by }));
  rows.unshift({ at: o.created_at, txt: "انعمل الطلب" });
  if (can("audit")) {
    const { data } = await db.from("audit_log").select("*").eq("tbl", "orders").eq("row_id", String(o.id)).order("at");
    (data || []).forEach(a => { const k = Object.keys(a.new || {}).filter(k => !["updated_at", "status_log", "status", "stock_taken"].includes(k)); if (a.action === "update" && k.length) rows.push({ at: a.at, by: a.who, txt: "تعديل: " + k.map(x => AUF[x] || x).join("، ") }); });
  }
  rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (OD?.id === o.id) $("#odHist").innerHTML = rows.map(r => `<li><small>${fmt(r.at)}${r.by ? " · " + esc(r.by) : ""}</small>${esc(r.txt)}</li>`).join("");
}
const AUF = { items: "المنتجات", subtotal: "المجموع", total: "المبلغ النهائي", discount: "الخصم", delivery: "التوصيل", assigned_to: "الموظف المسؤول", notes: "ملاحظة", paid: "المدفوع", address: "العنوان", phone: "الهاتف", name: "الاسم", retail_price: "سعر المفرق", price: "السعر", cost: "التكلفة", stock: "الكمية", active: "ظاهر", role: "الدور", perms: "الصلاحيات", status: "الحالة", amount: "المبلغ", void: "إلغاء", value: "القيمة" };
async function refreshOrder(id) { await loadOrders(); const o = O.find(x => x.id === id); if (o && $("#od").open) { OD = { ...o, items: o.items.map(i => ({ ...i })) }; drawOD(); loadODHistory(); } }
async function myName() { return STAFF.find(s => s.id === ME)?.full_name || STAFF.find(s => s.id === ME)?.email || ""; }

$("#oRows").addEventListener("click", e => { const id = +e.target.dataset.od; if (id) openOrder(id); });
$("#od").addEventListener("change", async e => {
  const t = e.target, d = t.dataset;
  if (d.oi !== undefined) { const it = OD.items[+d.oi]; it[d.k] = d.k === "qty" ? Math.max(1, +t.value || 1) : t.value === "" ? null : +t.value; drawOD(); }
  else if (t.id === "odDisc") { OD.discount = +t.value || 0; drawOD(); }
  else if (t.id === "odDel") { OD.delivery = +t.value || 0; drawOD(); }
  else if (t.id === "odSt") { if (!fail((await db.from("orders").update({ status: t.value }).eq("id", OD.id)).error)) { toast("انحفظت الحالة ✓"); refreshOrder(OD.id); } }
  else if (t.id === "odAs") { if (!fail((await db.from("orders").update({ assigned_to: t.value || null }).eq("id", OD.id)).error)) { toast("انحفظ ✓"); refreshOrder(OD.id); } }
});
$("#od").addEventListener("click", async e => {
  const t = e.target, d = t.dataset;
  if (d.odrm !== undefined) { OD.items.splice(+d.odrm, 1); drawOD(); }
  else if (t.id === "odAdd") {
    const p = P.find(x => x.id === +$("#odAddP").value); if (!p) { toast("اختار منتج"); return; }
    const w = W[p.id], ws = OD.kind === "wholesale" && w?.price != null, base = ws ? w.price * (100 - (+w.discount || 0)) / 100 : p.retail_price != null ? p.retail_price * (100 - (+p.discount || 0)) / 100 : null;
    OD.items.push({ id: p.id, brand: p.brand, name: p.name, shade: $("#odAddS").value.trim(), qty: Math.max(1, +$("#odAddQ").value || 1), unit: base == null ? null : r2(base) }); drawOD();
  }
  else if (t.id === "odSave") {
    if (!OD.items.length) { toast("الطلب لازم يضل فيه منتج. إذا بدك تلغيه غيّر الحالة لـ\"تم الإلغاء\""); return; }
    const tt = odTotals();
    if (!fail((await db.from("orders").update({ items: OD.items, subtotal: tt.sub, discount: +OD.discount || 0, delivery: +OD.delivery || 0, total: tt.total }).eq("id", OD.id)).error)) { toast("انحفظت التعديلات ✓ والمخزون اتعدّل"); refreshOrder(OD.id); }
  }
  else if (t.id === "odNoteAdd") {
    const txt = $("#odNote").value.trim(); if (!txt) return;
    const o = O.find(x => x.id === OD.id), notes = [...(o.notes || []), { at: new Date().toISOString(), by: await myName(), text: txt }];
    if (!fail((await db.from("orders").update({ notes }).eq("id", OD.id)).error)) refreshOrder(OD.id);
  }
  else if (t.id === "odSplit") {
    const lines = [...document.querySelectorAll("#od [data-split]:checked")].map(x => +x.dataset.split);
    if (!lines.length || lines.length === OD.items.length) { toast("علّم على بعض المنتجات (مش كلهم) بعمود ✂️"); return; }
    const { data, error } = await db.rpc("split_order", { p_id: OD.id, p_lines: lines });
    if (!fail(error)) { toast(`انعمل طلب جديد #${data} ✓`); refreshOrder(OD.id); }
  }
  else if (t.id === "odMerge") {
    const n = +$("#odMergeN").value; if (!n) return;
    if (!confirm(`تدمج طلب #${n} بطلب #${OD.id}؟ الطلب #${n} رح يتلغى ومنتجاته تنتقل لهون.`)) return;
    const { error } = await db.rpc("merge_orders", { p_keep: OD.id, p_other: n });
    if (!fail(error)) { toast("اندمجوا ✓"); refreshOrder(OD.id); }
  }
  else if (t.id === "shMake") {
    const c = COUR.find(x => x.id === +$("#shC").value); if (!c) { toast("ضيف شركة توصيل أول"); return; }
    const zone = ZONE[+OD.delivery] || "", fee = { 20: c.fee_west, 30: c.fee_jer, 70: c.fee_48 }[+OD.delivery] ?? 0;
    const { error } = await db.from("shipments").insert({ order_id: OD.id, courier_id: c.id, driver: $("#shDrv").value.trim() || null, tracking_no: $("#shNo").value.trim() || null, zone, cod: +$("#shCod").value || 0, fee: +fee || 0 });
    if (!fail(error)) { toast("انعملت الشحنة ✓ والطلب صار \"خرج للتوصيل\""); await loadDelivery(); refreshOrder(OD.id); }
  }
  else if (t.id === "pyAdd") {
    const amount = +$("#pyAmt").value; if (!(amount > 0)) { toast("اكتب المبلغ"); return; }
    const { data, error } = await db.from("payments").insert({ order_id: OD.id, user_id: OD.user_id, name: OD.name, phone: OD.phone, amount, method: $("#pyM").value, note: $("#pyNote").value.trim() || null, ...($("#pyRf").checked ? { refund: true } : {}) }).select("id").single();
    if (!fail(error)) { window.open(`receipt.html?id=${data.id}`, "_blank", "noopener"); toast("انسجلت الدفعة ✓"); loadMoney(); refreshOrder(OD.id); }
  }
});

// ===== delivery =====
const SHST = { sent: "بالطريق", delivered: "تم التسليم", refused: "رفض الاستلام", returned: "مرتجعة", lost: "ضايعة" };
const isLate = s => { const c = COUR.find(x => x.id === s.courier_id); return s.status === "sent" && Date.parse(s.sent_at) + (c?.days || 2) * 864e5 < Date.now(); };
async function loadDelivery() {
  const [c, s] = await Promise.all([db.from("couriers").select("*").order("id"), db.from("shipments").select("*").order("sent_at", { ascending: false }).limit(1000)]);
  if (c.error) { $("#dKpis").innerHTML = `<p class="hint">شغّل ملف phase7.sql أول.</p>`; return; }
  COUR = c.data || []; SHIPS = s.data || []; drawDelivery();
}
function drawDelivery() {
  const del = SHIPS.filter(s => s.status === "delivered"), coll = del.reduce((a, s) => a + +s.cod, 0), due = del.filter(s => !s.settled).reduce((a, s) => a + +s.cod - +s.fee, 0);
  $("#dKpis").innerHTML = `<div><b>${SHIPS.filter(s => s.status === "sent").length}</b><small>بالطريق</small></div><div><b>${SHIPS.filter(isLate).length}</b><small>متأخرة</small></div><div><b>${del.length}</b><small>تم تسليمها</small></div>
    <div><b>${SHIPS.filter(s => s.status === "refused").length}</b><small>رفض الزبون استلامها</small></div><div><b>${O.filter(o => o.status === "cancelled").length}</b><small>طلبات ملغاة</small></div>
    <div><b>${money(r2(coll))}</b><small>حصّلتها شركات التوصيل</small></div><div><b>${money(r2(due))}</b><small>مستحق إلنا عندهم</small></div>`;
  $("#cuRows").innerHTML = COUR.map(c => { const l = SHIPS.filter(s => s.courier_id === c.id), d = l.filter(s => s.status === "delivered"), col = d.reduce((a, s) => a + +s.cod, 0), fee = d.reduce((a, s) => a + +s.fee, 0), un = d.filter(s => !s.settled).reduce((a, s) => a + +s.cod - +s.fee, 0);
    return `<tr class="${c.active ? "" : "off"}"><td><b>${esc(c.name)}</b></td><td dir="ltr">${esc(c.phone || "")}</td><td>${esc(c.zones || "")}</td><td dir="ltr">${[c.fee_west, c.fee_jer, c.fee_48].map(v => v ?? "—").join(" / ")}</td><td>${c.days} يوم</td><td>${l.length}${l.filter(isLate).length ? ` <small class="hint">(${l.filter(isLate).length} متأخرة)</small>` : ""}</td><td>${money(r2(col))}</td><td>${money(r2(fee))}</td><td><b>${money(r2(un))}</b></td><td><input type="checkbox" ${c.active ? "checked" : ""} data-cua="${c.id}" style="width:auto"></td></tr>`; }).join("") || `<tr><td colspan="10" class="hint">ضيف أول شركة توصيل.</td></tr>`;
  const f = $("#shF").value, list = SHIPS.filter(s => !f || (f === "late" ? isLate(s) : f === "unsettled" ? s.status === "delivered" && !s.settled : s.status === f));
  $("#shRows").innerHTML = list.map(s => { const o = O.find(x => x.id === s.order_id) || {}; return `<tr class="${isLate(s) ? "late" : ""}"><td><button class="sm" type="button" data-od="${s.order_id}">#${s.order_id}</button><small class="hint" style="display:block">${esc(o.name || "")}</small></td>
    <td class="nm">${esc(COUR.find(c => c.id === s.courier_id)?.name || "—")}${s.driver ? `<small>${esc(s.driver)}</small>` : ""}${s.tracking_no ? `<small dir="ltr">${esc(s.tracking_no)}</small>` : ""}</td><td>${esc(s.zone || "")}</td><td dir="ltr">${fmt(s.sent_at)}${isLate(s) ? ` <b style="color:var(--danger)">متأخرة</b>` : ""}</td>
    <td><select data-shs="${s.id}">${Object.entries(SHST).map(([k, v]) => `<option value="${k}" ${k === s.status ? "selected" : ""}>${v}</option>`).join("")}</select>${s.delivered_at ? `<small class="hint" style="display:block" dir="ltr">${fmt(s.delivered_at)}</small>` : ""}</td>
    <td>${money(s.cod)}</td><td>${money(s.fee)}</td><td><input type="checkbox" ${s.settled ? "checked" : ""} data-shok="${s.id}" style="width:auto" aria-label="الشركة حاسبتنا"></td></tr>`; }).join("") || `<tr><td colspan="8" class="hint">ما في شحنات.</td></tr>`;
}
$("#shF").addEventListener("change", drawDelivery);
$("#shRows").addEventListener("click", e => { const id = +e.target.dataset.od; if (id) openOrder(id); });
$("#shRows").addEventListener("change", async e => {
  const d = e.target.dataset;
  if (d.shs && !fail((await db.from("shipments").update({ status: e.target.value }).eq("id", +d.shs)).error)) { toast("انحفظ ✓ وحالة الطلب اتحدثت"); await loadDelivery(); loadOrders(); }
  if (d.shok && !fail((await db.from("shipments").update({ settled: e.target.checked }).eq("id", +d.shok)).error)) { toast("انحفظ ✓"); loadDelivery(); }
});
$("#cuRows").addEventListener("change", async e => { const id = +e.target.dataset.cua; if (id && !fail((await db.from("couriers").update({ active: e.target.checked }).eq("id", id)).error)) loadDelivery(); });
$("#cuAdd").addEventListener("click", async () => {
  const name = $("#cuName").value.trim(); if (!name) { toast("اكتب اسم الشركة"); return; }
  const n = id => $(id).value === "" ? null : +$(id).value;
  if (!fail((await db.from("couriers").insert({ name, phone: $("#cuPhone").value.trim() || null, zones: $("#cuZones").value.trim() || null, fee_west: n("#cuW"), fee_jer: n("#cuJ"), fee_48: n("#cuI"), days: +$("#cuD").value || 2 })).error)) { ["#cuName", "#cuPhone", "#cuZones", "#cuW", "#cuJ", "#cuI", "#cuD"].forEach(k => $(k).value = ""); toast("انضافت ✓"); loadDelivery(); }
});

// ===== customer accounts + payments =====
const PAYM = { cash: "كاش", transfer: "تحويل بنكي", check: "شيك", courier: "مع شركة التوصيل", card: "بطاقة" };
let BAL = [], PAYS = [];
async function loadMoney() {
  const [b, p] = await Promise.all([db.rpc("customer_balances"), db.from("payments").select("*").order("at", { ascending: false }).limit(300)]);
  if (b.error) { $("#mKpis").innerHTML = `<p class="hint">شغّل ملف phase7.sql أول.</p>`; return; }
  BAL = b.data || []; PAYS = p.data || []; drawMoney();
}
function drawMoney() {
  const q = $("#mq").value.trim().toLowerCase(), only = $("#mDue").checked, sum = k => r2(BAL.reduce((a, r) => a + +r[k], 0));
  $("#mKpis").innerHTML = `<div><b>${money(sum("billed"))}</b><small>مجموع الطلبات</small></div><div><b>${money(sum("paid"))}</b><small>انقبض</small></div><div><b>${money(sum("due"))}</b><small>ضل على الزباين</small></div><div><b>${BAL.filter(r => +r.due > 0).length}</b><small>زبون عليه مبلغ</small></div>`;
  $("#balRows").innerHTML = BAL.filter(r => (!only || +r.due > 0) && (!q || `${r.name} ${r.phone}`.toLowerCase().includes(q))).map((r, i) => `<tr><td class="nm">${esc(r.name)}<small dir="ltr">${esc(r.phone || "")}</small></td><td>${r.orders}</td><td>${money(r.billed)}</td><td>${money(r.paid)}</td><td><b style="color:${+r.due > 0 ? "var(--danger)" : "inherit"}">${money(r.due)}</b></td><td dir="ltr">${fmt(r.last_order)}</td>
    <td><button class="sm ok" type="button" data-bpay="${esc(r.key)}">💵 دفعة</button> <a class="sm" href="receipt.html?statement=${encodeURIComponent(r.key)}" target="_blank" rel="noopener">كشف حساب</a></td></tr>`).join("") || `<tr><td colspan="7" class="hint">ما في حسابات.</td></tr>`;
  $("#payRows").innerHTML = PAYS.map(p => `<tr class="${p.void ? "off" : ""}"><td>${p.id}</td><td dir="ltr">${fmt(p.at)}</td><td class="nm">${esc(p.name)}<small dir="ltr">${esc(p.phone || "")}</small></td><td>${p.order_id ? `<button class="sm" type="button" data-od="${p.order_id}">#${p.order_id}</button>` : "—"}</td><td><b>${money(p.amount)}</b></td><td>${PAYM[p.method] || p.method}${p.note ? `<small class="hint" style="display:block">${esc(p.note)}</small>` : ""}</td>
    <td><a class="sm" href="receipt.html?id=${p.id}" target="_blank" rel="noopener">🧾 سند قبض</a> ${p.void ? `<small class="hint">ملغية</small>` : `<button class="sm no" type="button" data-pvoid="${p.id}">إلغاء</button>`}</td></tr>`).join("") || `<tr><td colspan="7" class="hint">ما في دفعات.</td></tr>`;
}
$("#mq").addEventListener("input", drawMoney); $("#mDue").addEventListener("change", drawMoney);
$("#t-money").addEventListener("click", async e => {
  const d = e.target.dataset;
  if (d.od) openOrder(+d.od);
  if (d.pvoid && confirm("تلغي هالدفعة؟ بتضل مسجّلة بالسجل كملغية.") && !fail((await db.from("payments").update({ void: true }).eq("id", +d.pvoid)).error)) { loadMoney(); loadOrders(); }
  if (d.bpay) {
    const r = BAL.find(x => x.key === d.bpay), a = prompt(`دفعة من ${r.name}. ضل عليه ${money(r.due)}. كم المبلغ؟`, +r.due > 0 ? r.due : ""); if (!a || !(+a > 0)) return;
    const { data, error } = await db.from("payments").insert({ user_id: r.user_id, name: r.name, phone: r.phone, amount: +a, method: "cash" }).select("id").single();
    if (!fail(error)) { window.open(`receipt.html?id=${data.id}`, "_blank", "noopener"); loadMoney(); }
  }
});

// ===== staff =====
function drawStaff() {
  $("#stPerms").innerHTML = Object.entries(PERM_LABEL).map(([k, v]) => `<label class="hint"><input type="checkbox" value="${k}" style="width:auto" ${k === "orders" ? "checked" : ""}> ${v}</label>`).join("");
  $("#sfRows").innerHTML = STAFF.map(s => `<tr><td class="nm">${esc(s.full_name || "")}<small dir="ltr">${esc(s.email || "")}</small></td><td>${s.role === "admin" ? "<b>المالك (كل اشي)</b>" : (s.perms || []).map(p => PERM_LABEL[p] || p).join("، ") || "—"}</td>
    <td>${s.role === "staff" ? `<button class="sm" type="button" data-sedit="${esc(s.email)}">تعديل</button> <button class="sm no" type="button" data-srm="${s.id}">إزالة</button>` : ""}</td></tr>`).join("");
}
$("#stAdd").addEventListener("click", async () => {
  const email = $("#stEmail").value.trim(), perms = [...document.querySelectorAll("#stPerms input:checked")].map(i => i.value);
  if (!email) { toast("اكتب الإيميل"); return; }
  const { data, error } = await db.rpc("set_staff", { p_email: email, p_perms: perms });
  if (error) { toast(/no account/.test(error.message) ? "ما في حساب بهالإيميل. خلّي الموظف يعمل حساب من الموقع أول." : "ما انحفظ: " + error.message); return; }
  toast(`${data} صار موظف ✓`); $("#stEmail").value = ""; loadOps();
});
$("#sfRows").addEventListener("click", async e => {
  const d = e.target.dataset;
  if (d.sedit) { const s = STAFF.find(x => x.email === d.sedit); $("#stEmail").value = s.email; document.querySelectorAll("#stPerms input").forEach(i => i.checked = (s.perms || []).includes(i.value)); $("#stEmail").focus(); toast("عدّل الصلاحيات واضغط إضافة"); }
  if (d.srm && confirm("تشيل هالموظف؟ حسابه بيضل بس ما بيقدر يفتح لوحة التحكم.") && !fail((await db.rpc("remove_staff", { p_id: d.srm })).error)) loadOps();
});

// ===== audit log =====
let AU = [];
const AUT = { orders: "طلب", payments: "دفعة", products: "منتج", product_costs: "تكلفة", wholesale_prices: "سعر جملة", shipments: "شحنة", couriers: "شركة توصيل", coupons: "كوبون", settings: "إعداد", profiles: "حساب" };
const short = v => { const s = typeof v === "object" && v !== null ? (Array.isArray(v) ? `${v.length} عنصر` : "…") : String(v ?? "—"); return s.length > 40 ? s.slice(0, 40) + "…" : s; };
async function loadAudit() {
  const { data, error } = await db.from("audit_log").select("*").order("at", { ascending: false }).limit(400);
  if (error) { $("#auRows").innerHTML = `<tr><td colspan="4" class="hint">شغّل ملف phase7.sql أول.</td></tr>`; return; }
  AU = data || []; drawAudit();
}
function drawAudit() {
  const t = $("#auT").value, q = $("#auQ").value.trim().toLowerCase();
  $("#auRows").innerHTML = AU.filter(a => (!t || a.tbl === t) && (!q || `${a.row_id} ${a.who} ${JSON.stringify(a.new || a.old)}`.toLowerCase().includes(q))).map(a => {
    const keys = Object.keys(a.new || a.old || {}).filter(k => !["updated_at", "status_log", "stock_taken", "created_at"].includes(k));
    const what = a.action === "insert" ? "إضافة" : a.action === "delete" ? "حذف" : keys.map(k => `${AUF[k] || k}: ${esc(short(a.old?.[k]))} ← ${esc(short(a.new?.[k]))}`).join("<br>");
    return `<tr><td dir="ltr">${fmt(a.at)}</td><td>${esc(a.who || "النظام")}</td><td>${AUT[a.tbl] || a.tbl} ${a.row_id ? `<b dir="ltr">#${esc(a.row_id)}</b>` : ""}</td><td><small>${what}</small></td></tr>`; }).join("") || `<tr><td colspan="4" class="hint">ما في سجلات.</td></tr>`;
}
$("#auT").addEventListener("change", drawAudit); $("#auQ").addEventListener("input", drawAudit);
document.querySelector(".tabbar").addEventListener("click", e => { if (e.target.dataset.tab === "audit" && can("audit")) loadAudit(); if (e.target.dataset.tab === "delivery" && can("delivery")) loadDelivery(); if (e.target.dataset.tab === "money" && can("finance")) loadMoney(); });
