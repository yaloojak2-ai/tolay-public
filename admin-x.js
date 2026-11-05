// admin-x.js: notifications center (+ who receives what, browser alerts), 2FA, backup, accounts,
// customer support tickets, team tasks, and Tolay AI (answers computed from the store's own data, no paid AI).
// Uses the admin globals ($, db, esc, money, toast, fail, P, O, T, CO, STAFF, ME) and helpers from admin-ops.js (can, fmt, r2, OST).

const NEV = { new_order: "🛍️ طلب جديد", new_wholesale: "📦 طلب جملة", cancelled: "❌ إلغاء طلب", new_trader: "🏪 تاجر جديد", low_stock: "🟠 كمية قليلة", out_of_stock: "🔴 نفد منتج", new_ticket: "💬 سؤال أو شكوى", restock_request: "🔔 طلب منتج مش متوفر", task: "✅ مهمة" };
let NF = [], NR = [], TK = [], TA = [], NFMAX = 0, GOAL = 0;
const goTab = t => document.querySelector(`.tabbar [data-tab="${t}"]`)?.click();

async function loadX() {
  loadNtf(); drawMfa(); if (can("orders")) loadHelp();
  if (can("owner")) { loadRules(); loadAccounts(); }
  drawAiChips();
  if (!loadX.timer) loadX.timer = setInterval(pollNtf, 60000);
}

// ===== notifications =====
async function loadNtf() {
  const { data, error } = await db.from("notifications").select("*").order("id", { ascending: false }).limit(200);
  if (error) { $("#nfRows").innerHTML = `<tr><td class="hint">شغّل ملف phase10.sql أول.</td></tr>`; return; }
  NF = data || []; NFMAX = Math.max(NFMAX, NF[0]?.id || 0); drawNtf(); drawLive();
}
const unread = n => !(n.read_by || []).includes(ME);
function drawNtf() {
  const u = NF.filter(unread).length; $("#ntfN").textContent = u ? `(${u})` : "";
  $("#nfRows").innerHTML = NF.map(n => `<tr class="nfi ${unread(n) ? "unread" : ""}"><td style="width:150px">${NEV[n.event] || n.event}</td><td>${esc(n.title)}<small>${esc(n.body || "")}</small></td>
    <td dir="ltr" style="width:120px"><small>${fmt(n.at)}</small></td><td style="width:70px">${n.link ? `<button class="sm" type="button" data-nfgo="${n.id}">فتح</button>` : ""}</td></tr>`).join("") || `<tr><td class="hint">ما في إشعارات لسا.</td></tr>`;
}
async function markRead(ids) { if (!ids.length) return; await db.rpc("mark_read", { p_ids: ids }); NF.forEach(n => { if (ids.includes(n.id) && unread(n)) n.read_by = [...(n.read_by || []), ME]; }); drawNtf(); }
$("#nfRows").addEventListener("click", e => {
  const n = NF.find(x => x.id === +e.target.dataset.nfgo); if (!n) return; markRead([n.id]);
  const [k, v] = n.link.split(":"); if (k === "order") { goTab("orders"); openOrder(+v); } else goTab(k);
});
$("#nfAll").addEventListener("click", () => markRead(NF.filter(unread).map(n => n.id)));
// every minute: new notifications become a browser alert + a short sound
async function pollNtf() {
  const { data } = await db.from("notifications").select("*").gt("id", NFMAX).order("id");
  if (!data?.length) return;
  NFMAX = data.at(-1).id; NF = [...data.reverse(), ...NF]; drawNtf();
  if (data.some(n => ["new_order", "new_wholesale", "cancelled"].includes(n.event)) && window.loadOrders) loadOrders();
  if (data.some(n => n.event === "new_ticket") && can("orders")) loadHelp();
  try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = .08; o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + .18); } catch { }
  if (window.Notification?.permission === "granted") data.slice(-3).forEach(n => new Notification(n.title, { body: n.body || "", icon: "img/og.jpg", tag: "tolay" + n.id }));
}
$("#nfPush").addEventListener("click", async () => {
  if (!window.Notification) { toast("المتصفح ما بيدعم التنبيهات"); return; }
  toast(await Notification.requestPermission() === "granted" ? "تمام، رح يجيك تنبيه لما يصير اشي جديد (والصفحة مفتوحة) 🔔" : "التنبيهات مسكّرة من إعدادات المتصفح");
});
// things that depend on time (no trigger can fire them): computed whenever the dashboard loads
function drawLive() {
  const L = [], now = Date.now(), day = 864e5;
  if (can("delivery") && typeof SHIPS !== "undefined") SHIPS.filter(s => isLate?.(s)).forEach(s => L.push(`🚚 شحنة الطلب #${s.order_id} متأخرة`));
  if (can("finance")) {
    if (typeof POS !== "undefined") POS.filter(p => p.status === "ordered" && p.expected_at && Date.parse(p.expected_at) < now).forEach(p => L.push(`📦 أمر شراء #${p.id} من ${esc(supName(p.supplier_id))} تأخر عن موعده`));
    if (typeof POS !== "undefined") POS.filter(p => p.status === "received" && poTotal(p) - poPaid(p.id) > 1).forEach(p => L.push(`💸 دفعة للمورد ${esc(supName(p.supplier_id))} مستحقة: ${money(r2(poTotal(p) - poPaid(p.id)))} (أمر #${p.id})`));
    O.filter(o => o.status === "delivered" && o.total != null && +o.total - (+o.paid || 0) > 1 && now - Date.parse(o.updated_at || o.created_at) > 7 * day).slice(0, 10).forEach(o => L.push(`🧾 طلب #${o.id} (${esc(o.name)}) انسلّم ولسا عليه ${money(r2(o.total - (+o.paid || 0)))}`));
    if (typeof EXP !== "undefined") { const wk = t => EXP.filter(x => !x.void && now - Date.parse(x.day) < t * day && now - Date.parse(x.day) >= (t - 7) * day).reduce((a, x) => a + +x.amount, 0);
      const cur = wk(7), avg = (wk(14) + wk(21) + wk(28) + wk(35)) / 4; if (avg > 0 && cur > avg * 1.5) L.push(`📈 مصاريف هالأسبوع (${money(r2(cur))}) أعلى بكثير من المعدل (${money(r2(avg))})`); }
    if (GOAL > 0) { const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
      const s = O.filter(o => Date.parse(o.created_at) >= m0 && ["confirmed", "preparing", "packed", "ready", "shipped", "delivered"].includes(o.status)).reduce((a, o) => a + (+o.total || 0) - (+o.delivery || 0), 0);
      L.push(s >= GOAL ? `🎉 وصلت هدف الشهر! ${money(r2(s))} من ${money(GOAL)}` : `🎯 هدف الشهر: ${money(r2(s))} من ${money(GOAL)} (${Math.round(s / GOAL * 100)}%)`); }
  }
  TA.filter(t => !t.done && t.due && Date.parse(t.due) < now - day && (t.assigned_to === ME || can("owner"))).forEach(t => L.push(`⏰ مهمة متأخرة: ${esc(t.title)}`));
  $("#nfLive").innerHTML = L.map(x => `<div class="live">${x}</div>`).join("");
}
async function loadRules() {
  const [r, g] = await Promise.all([db.from("notify_rules").select("*"), db.from("settings").select("value").eq("key", "sales_goal").maybeSingle()]);
  NR = r.data || []; GOAL = +g.data?.value || 0; $("#nfGoal").value = GOAL || "";
  const staff = STAFF.filter(s => s.role === "staff");
  $("#nrRows").innerHTML = NR.map(r => `<tr><td>${NEV[r.event] || r.event}</td><td><input type="checkbox" data-nron="${r.event}" ${r.on_ ? "checked" : ""} style="width:auto" aria-label="شغّال"></td>
    <td>${staff.map(s => `<label class="hint" style="margin-inline-end:10px"><input type="checkbox" data-nre="${r.event}" value="${s.id}" ${(r.recipients || []).includes(s.id) ? "checked" : ""} style="width:auto"> ${esc(s.full_name || s.email)}</label>`).join("") || `<span class="hint">ضيف موظفين من تبويب الموظفين.</span>`}</td></tr>`).join("");
  drawLive();
}
$("#nrRows").addEventListener("change", async e => {
  const d = e.target.dataset;
  if (d.nron) fail((await db.from("notify_rules").update({ on_: e.target.checked }).eq("event", d.nron)).error);
  if (d.nre) { const ids = [...document.querySelectorAll(`[data-nre="${d.nre}"]:checked`)].map(i => i.value); fail((await db.from("notify_rules").update({ recipients: ids }).eq("event", d.nre)).error); }
});
$("#nfGoal").addEventListener("change", async e => { GOAL = +e.target.value || 0; if (!fail((await db.from("settings").upsert({ key: "sales_goal", value: String(GOAL) })).error)) { toast("انحفظ الهدف ✓"); drawLive(); } });

// ===== 2FA (TOTP, e.g. Google Authenticator) =====
async function drawMfa() {
  const f = (await db.auth.mfa.listFactors()).data?.totp || [], on = f.find(x => x.status === "verified");
  $("#mfaBox").innerHTML = on ? `<span>✅ التحقق بخطوتين شغّال على حسابك.</span><button class="sm no" type="button" id="mfaOff">إيقاف</button>`
    : `<span class="hint">زيادة أمان: بعد كلمة السر بيطلب رمز من تطبيق على تلفونك.</span><button class="sm ok" type="button" id="mfaOn">تفعيل التحقق بخطوتين</button>`;
}
$("#mfaBox").addEventListener("click", async e => {
  if (e.target.id === "mfaOn") {
    const old = (await db.auth.mfa.listFactors()).data?.all?.filter(x => x.status !== "verified") || [];
    for (const x of old) await db.auth.mfa.unenroll({ factorId: x.id });   // leftovers from a half-finished setup
    const { data, error } = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: "Tolay " + Date.now() });
    if (error) { toast("ما زبط: " + error.message); return; }
    $("#mfaBox").innerHTML = `<div class="nm"><p class="hint">1) افتح Google Authenticator أو Microsoft Authenticator وامسح الرمز.<br>2) اكتب الرقم اللي طلع واضغط تأكيد.</p>
      <img src="${data.totp.qr_code}" alt="QR" width="180" height="180" style="background:#fff;border-radius:10px"><small dir="ltr">${esc(data.totp.secret)}</small></div>
      <input id="mfaNew" inputmode="numeric" maxlength="6" placeholder="123456" dir="ltr" style="width:120px"><button class="sm ok" type="button" id="mfaVer" data-f="${data.id}">تأكيد</button>`;
  }
  if (e.target.id === "mfaVer") {
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId: e.target.dataset.f, code: $("#mfaNew").value.trim() });
    if (error) { toast("الرمز غلط، جرّب الرمز الجديد"); return; } toast("انفعّل التحقق بخطوتين ✓ احفظ التطبيق، رح تحتاجه كل دخول."); drawMfa();
  }
  if (e.target.id === "mfaOff" && confirm("توقف التحقق بخطوتين؟ حسابك بيصير أقل أمان.")) {
    const f = (await db.auth.mfa.listFactors()).data?.totp?.find(x => x.status === "verified");
    if (f && !fail((await db.auth.mfa.unenroll({ factorId: f.id })).error)) { await db.auth.refreshSession(); toast("انوقف"); drawMfa(); }
  }
});

// ===== backup: every table the owner can read, in one JSON file =====
$("#bkGo").addEventListener("click", async e => {
  const tabs = ["settings", "categories", "products", "wholesale_prices", "product_costs", "profiles", "orders", "order_costs", "payments", "coupons", "couriers", "shipments", "reviews", "reels",
    "restock_alerts", "warehouses", "wh_stock", "stock_moves", "product_batches", "suppliers", "purchase_orders", "supplier_payments", "expenses", "capital_moves", "tasks", "tickets", "notify_rules", "audit_log"];
  e.target.disabled = true; const out = { made_at: new Date().toISOString(), store: "Tolay Makeup", tables: {} };
  for (const t of tabs) {
    $("#bkMsg").textContent = "لحظة… " + t; const rows = [];
    for (let i = 0; ; i += 1000) { const { data, error } = await db.from(t).select("*").range(i, i + 999); if (error || !data?.length) break; rows.push(...data); if (data.length < 1000) break; }
    out.tables[t] = rows;
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: "application/json" }));
  a.download = `tolay-backup-${out.made_at.slice(0, 10)}.json`; a.click();
  e.target.disabled = false; $("#bkMsg").textContent = `✓ ${Object.values(out.tables).reduce((a, r) => a + r.length, 0)} سطر من ${tabs.length} جدول`;
});

// ===== accounts (owner): create / remove through the admin-users edge function =====
let ACC = [];
async function loadAccounts() { const { data } = await db.from("profiles").select("id,full_name,shop_name,email,phone,role,status,created_at").order("created_at", { ascending: false }).limit(2000); ACC = data || []; drawAccounts(); }
const ROLE = { admin: "المالك", staff: "موظف", merchant: "تاجر", customer: "زبونة" };
function drawAccounts() {
  const q = $("#acQ").value.trim().toLowerCase();
  $("#acRows").innerHTML = ACC.filter(a => !q || `${a.full_name} ${a.shop_name} ${a.email} ${a.phone}`.toLowerCase().includes(q)).slice(0, 300).map(a => `<tr class="${a.status === "rejected" ? "off" : ""}"><td class="nm">${esc(a.full_name || a.shop_name || "—")}<small dir="ltr">${esc(a.email || "")} ${esc(a.phone || "")}</small></td>
    <td>${ROLE[a.role] || a.role}</td><td>${{ approved: "معتمد", pending: "بانتظار", rejected: "موقوف", active: "فعّال" }[a.status] || a.status}</td><td dir="ltr"><small>${(a.created_at || "").slice(0, 10)}</small></td>
    <td>${a.role === "admin" || a.status === "rejected" ? "" : `<button class="sm no" type="button" data-acdel="${a.id}">حذف الحساب</button>`}</td></tr>`).join("");
}
$("#acQ").addEventListener("input", drawAccounts);
async function adminUsers(body) {
  const { data, error } = await db.functions.invoke("admin-users", { body });
  if (!error) return data;
  let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch { }
  toast(/Failed to send|not found|404/i.test(msg) ? "لازم تنشر دالة admin-users على Supabase أول (التعليمات بالمحادثة)" : msg === "2fa" ? "ادخل برمز التحقق بخطوتين أول" : "ما زبط: " + msg);
  return null;
}
$("#acGo").addEventListener("click", async e => {
  const body = { action: "create", kind: $("#acK").value, full_name: $("#acN").value.trim(), email: $("#acE").value.trim(), phone: $("#acP").value.trim(), password: $("#acW").value,
    perms: [...document.querySelectorAll("#stPerms input:checked")].map(i => i.value) };
  if (!body.email || body.password.length < 8) { toast("اكتب إيميل وكلمة سر 8 أحرف وأكثر"); return; }
  e.target.disabled = true; const r = await adminUsers(body); e.target.disabled = false;
  if (r?.id) { toast("انعمل الحساب ✓ أعطيه الإيميل وكلمة السر"); ["#acN", "#acE", "#acP", "#acW"].forEach(k => $(k).value = ""); loadAccounts(); loadOps(); }
});
$("#acRows").addEventListener("click", async e => {
  const id = e.target.dataset.acdel; if (!id) return; const a = ACC.find(x => x.id === id);
  if (!confirm(`تحذف حساب ${a.full_name || a.email}؟ ما بيقدر يدخل بعدها، بس طلباته ودفعاته بتضل بالسجلات.`)) return;
  if (await adminUsers({ action: "delete", user_id: id })) { toast("انحذف الحساب ✓"); loadAccounts(); }
});

// ===== support tickets + team tasks =====
const TKK = { question: "💬 سؤال", complaint: "⚠️ شكوى", return: "↩️ طلب إرجاع", other: "📝 غير" };
async function loadHelp() {
  const [t, a] = await Promise.all([db.from("tickets").select("*").order("created_at", { ascending: false }).limit(300), db.from("tasks").select("*").order("done").order("due", { nullsFirst: false }).limit(500)]);
  if (t.error) { $("#tkList").innerHTML = `<p class="hint">شغّل ملف phase10.sql أول.</p>`; return; }
  TK = t.data || []; TA = a.data || [];
  $("#taA").innerHTML = `<option value="">بدون موظف</option>` + STAFF.map(s => `<option value="${s.id}">${esc(s.full_name || s.email)}</option>`).join("");
  drawTk(); drawTa(); drawLive();
}
function drawTk() {
  const f = $("#tkF").value, open = TK.filter(t => t.status === "open").length; $("#hlpN").textContent = open ? `(${open})` : "";
  $("#tkList").innerHTML = TK.filter(t => !f || t.status === f).map(t => { const p = P.find(x => x.id === t.product_id), wa = waNo(t.phone);
    return `<div class="tk"><div class="bar"><b>${TKK[t.kind]}</b><span>${esc(t.name || "")}</span><span dir="ltr" class="hint">${esc(t.phone || "")}</span><small class="hint" dir="ltr">${fmt(t.created_at)}</small>
      ${t.order_id ? `<button class="sm" type="button" data-tko="${t.order_id}">طلب #${t.order_id}</button>` : ""}${p ? `<small class="hint">${esc(p.brand)} – ${esc(p.name)}</small>` : ""}</div>
      <div>${esc(t.body)}</div>${t.image_url ? `<a href="${esc(t.image_url)}" target="_blank" rel="noopener"><img src="${esc(t.image_url)}" alt="صورة من الزبونة" loading="lazy"></a>` : ""}
      <textarea rows="2" data-tkr="${t.id}" placeholder="اكتب الرد…">${esc(t.reply || "")}</textarea>
      <div class="bar"><button class="sm ok" type="button" data-tksend="${t.id}">ردّ</button>${wa ? `<a class="sm" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(`مرحبا ${t.name || ""} 💗 ${t.reply || ""}`)}">واتساب</a>` : ""}
        ${t.status !== "closed" ? `<button class="sm" type="button" data-tkclose="${t.id}">سكّر</button>` : ""}<button class="sm" type="button" data-tktask="${t.id}">+ مهمة</button></div></div>`; }).join("") || `<p class="hint">ما في شي هون.</p>`;
}
$("#tkF").addEventListener("change", drawTk);
$("#tkList").addEventListener("click", async e => {
  const d = e.target.dataset;
  if (d.tko) { openOrder(+d.tko); return; }
  if (d.tksend) { const reply = document.querySelector(`[data-tkr="${d.tksend}"]`).value.trim(); if (!reply) { toast("اكتب الرد"); return; }
    if (!fail((await db.from("tickets").update({ reply, status: "answered", replied_at: new Date().toISOString() }).eq("id", +d.tksend)).error)) { toast("انبعت الرد ✓ الزبونة بتشوفه بحسابها"); loadHelp(); } }
  if (d.tkclose && !fail((await db.from("tickets").update({ status: "closed" }).eq("id", +d.tkclose)).error)) loadHelp();
  if (d.tktask) { const t = TK.find(x => x.id === +d.tktask); $("#taT").value = `${TKK[t.kind]}: ${t.name || ""} – ${t.body.slice(0, 50)}`; $("#taT").focus(); }
});
function drawTa() {
  const all = $("#taDone").checked, now = Date.now();
  $("#taRows").innerHTML = TA.filter(t => all || !t.done).map(t => `<tr class="${t.done ? "off" : t.due && Date.parse(t.due) < now - 864e5 ? "late" : ""}"><td style="width:40px"><input type="checkbox" ${t.done ? "checked" : ""} data-tad="${t.id}" style="width:auto" aria-label="خلصت"></td>
    <td>${esc(t.title)}${t.order_id ? ` <button class="sm" type="button" data-tko="${t.order_id}">#${t.order_id}</button>` : ""}</td><td>${esc(staffName(t.assigned_to))}</td><td dir="ltr">${t.due || ""}</td></tr>`).join("") || `<tr><td class="hint">ما في مهام.</td></tr>`;
}
$("#taDone").addEventListener("change", drawTa);
$("#taAdd").addEventListener("click", async () => {
  const title = $("#taT").value.trim(); if (!title) { toast("اكتب المهمة"); return; }
  const m = title.match(/#(\d+)/);
  if (!fail((await db.from("tasks").insert({ title, assigned_to: $("#taA").value || null, due: $("#taD").value || null, order_id: m ? +m[1] : null })).error)) { $("#taT").value = ""; loadHelp(); }
});
$("#taRows").addEventListener("change", async e => { const id = +e.target.dataset.tad; if (id && !fail((await db.from("tasks").update({ done: e.target.checked, done_at: e.target.checked ? new Date().toISOString() : null }).eq("id", id)).error)) loadHelp(); });
$("#taRows").addEventListener("click", e => { if (e.target.dataset.tko) openOrder(+e.target.dataset.tko); });
document.querySelector(".tabbar").addEventListener("click", e => { const t = e.target.closest("[data-tab]")?.dataset.tab; if (t === "ntf") { loadNtf(); if (can("owner")) loadRules(); } if (t === "help") loadHelp(); });

// ===== Tolay AI: questions answered from the store's own numbers =====
let AID = null;
async function aiData() {
  if (AID) return AID;
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const [o, oc, ex] = await Promise.all([db.from("orders").select("id,created_at,status,kind,total,delivery,discount,subtotal,paid,items,user_id,name,phone").gte("created_at", since).limit(10000),
    can("finance") ? db.from("order_costs").select("*") : { data: [] }, can("finance") ? db.from("expenses").select("*").eq("void", false) : { data: [] }]);
  AID = { O: o.data || O, OC: Object.fromEntries((oc.data || []).map(r => [r.order_id, r])), EX: ex.data || [] };
  setTimeout(() => AID = null, 5 * 60e3);
  return AID;
}
const SOLD = ["confirmed", "preparing", "packed", "ready", "shipped", "delivered"];
const unitPrice = p => p.retail_price == null ? null : p.retail_price * (100 - (+p.discount || 0)) / 100;
const tbl = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const linesIn = (D, days, from = 0) => D.O.filter(o => SOLD.includes(o.status) && Date.now() - Date.parse(o.created_at) < days * 864e5 && Date.now() - Date.parse(o.created_at) >= from * 864e5).flatMap(o => (o.items || []).map(it => ({ ...it, o })));
const needFin = () => can("finance") ? null : "هالسؤال فيه أرقام مالية، وصلاحيتك ما بتشمل المالية.";
const AI = [
  { k: "top", q: "أكثر 10 منتجات مبيعاً هالشهر", re: /اكثر|أكثر|top|بيع|مبيع/, fn: D => {
    const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0); const g = {};
    D.O.filter(o => SOLD.includes(o.status) && Date.parse(o.created_at) >= m0).forEach(o => (o.items || []).forEach(it => { const k = `${it.brand} – ${it.name}`; g[k] = g[k] || [0, 0]; g[k][0] += it.qty; g[k][1] += (+it.unit || 0) * it.qty; }));
    const r = Object.entries(g).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10);
    return r.length ? `هاي أكثر ${r.length} منتجات انباعت من أول الشهر:` + tbl(["المنتج", "قطع", "قيمة"], r.map(([k, v]) => [esc(k), v[0], money(r2(v[1]))])) : "لسا ما في مبيعات مؤكدة هالشهر."; } },
  { k: "brand", q: "أكثر ماركة بتربح", re: /ماركه|ماركة|براند|brand/, fn: D => { if (needFin()) return needFin();
    const g = {}; linesIn(D, 90).forEach(l => { const b = l.brand || "—", c = CO[l.id]; g[b] = g[b] || { s: 0, c: 0, n: 0, miss: 0 }; g[b].s += (+l.unit || 0) * l.qty; if (c != null) g[b].c += c * l.qty; else g[b].miss += l.qty; g[b].n += l.qty; });
    const r = Object.entries(g).map(([b, v]) => [b, v, v.s - v.c]).sort((a, b) => b[2] - a[2]);
    return r.length ? `آخر 90 يوم، أكثر ماركة ربّحتك <b>${esc(r[0][0])}</b> بربح تقريبي ${money(r2(r[0][2]))}.` + tbl(["الماركة", "مبيعات", "ربح", "هامش", "قطع بدون تكلفة"], r.slice(0, 12).map(([b, v, p]) => [esc(b), money(r2(v.s)), money(r2(p)), v.s ? Math.round(p / v.s * 100) + "%" : "—", v.miss || ""])) : "ما في مبيعات آخر 90 يوم."; } },
  { k: "reorder", q: "شو لازم أطلب هلأ؟", re: /اطلب|أطلب|طلبيه|طلبية|reorder|ينفد|تنفد|بخلص/, fn: D => {
    const sold = {}; linesIn(D, 30).forEach(l => { const k = l.id + "|" + (l.shade || ""); sold[k] = (sold[k] || 0) + l.qty; });
    const r = [];
    P.filter(p => p.active !== false).forEach(p => Object.entries(p.stock || {}).forEach(([sh, n]) => { n = +n || 0; const s30 = sold[p.id + "|" + sh] || 0, rate = s30 / 30, cover = rate ? n / rate : Infinity;
      if ((rate && cover < 21) || (n === 0 && s30)) r.push([p, sh, n, s30, cover, Math.max(1, Math.ceil(rate * 45) - n)]); }));
    r.sort((a, b) => a[4] - b[4]);
    return r.length ? `حسب سرعة البيع بآخر 30 يوم، هدول رح يخلصوا خلال 3 أسابيع. الكمية المقترحة بتكفي ~45 يوم (شهر شحن + أسبوعين احتياط):` + tbl(["المنتج", "الدرجة", "عندك", "انباع بـ30 يوم", "بيكفي", "اطلب"], r.slice(0, 25).map(([p, sh, n, s, c, q]) => [`${esc(p.brand)} – ${esc(p.name)}`, esc(sh) || "—", n, s, c === Infinity ? "—" : Math.floor(c) + " يوم", `<b>${q}</b>`]))
      : "ما في اشي مستعجل. (إذا الكميات مش مدخلة بالمخزون، الحساب ما بيشتغل.)"; } },
  { k: "week", q: "قديش ربحت هالأسبوع؟", re: /ربح|ربحت|profit|اسبوع|أسبوع/, fn: D => { if (needFin()) return needFin();
    const calc = (a, b) => { const os = D.O.filter(o => SOLD.includes(o.status) && Date.now() - Date.parse(o.created_at) < a * 864e5 && Date.now() - Date.parse(o.created_at) >= b * 864e5);
      const s = os.reduce((x, o) => x + (+o.total || 0) - (+o.delivery || 0), 0), c = os.reduce((x, o) => x + (D.OC[o.id] && !D.OC[o.id].missing ? +D.OC[o.id].cogs : (o.items || []).reduce((y, it) => y + (CO[it.id] || 0) * it.qty, 0)), 0);
      const e = D.EX.filter(x => Date.now() - Date.parse(x.day) < a * 864e5 && Date.now() - Date.parse(x.day) >= b * 864e5).reduce((x, y) => x + +y.amount, 0); return { n: os.length, s, c, e, p: s - c - e }; };
    const w = calc(7, 0), pw = calc(14, 7), ch = pw.p ? Math.round((w.p - pw.p) / Math.abs(pw.p) * 100) : null;
    return `آخر 7 أيام: صافي الربح <b>${money(r2(w.p))}</b>${ch != null ? ` (${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch)}% عن الأسبوع اللي قبله)` : ""}.` + tbl(["", "هالأسبوع", "اللي قبله"], [["طلبات", w.n, pw.n], ["مبيعات", money(r2(w.s)), money(r2(pw.s))], ["تكلفة البضاعة", money(r2(w.c)), money(r2(pw.c))], ["مصاريف", money(r2(w.e)), money(r2(pw.e))], ["<b>صافي</b>", `<b>${money(r2(w.p))}</b>`, money(r2(pw.p))]]); } },
  { k: "traders", q: "مين التجار اللي ما طلبوا من شهر؟", re: /تاجر|تجار|trader|ما طلب/, fn: D => {
    const last = {}; D.O.filter(o => o.user_id && o.status !== "cancelled").forEach(o => { const t = Date.parse(o.created_at); if (!(last[o.user_id] > t)) last[o.user_id] = t; });
    const r = T.filter(t => t.status === "approved" && !(last[t.id] > Date.now() - 30 * 864e5)).map(t => [t, last[t.id]]).sort((a, b) => (a[1] || 0) - (b[1] || 0));
    return r.length ? `${r.length} تاجر ما طلبوا من 30 يوم وأكثر. رسالة لطيفة بتفرق:` + tbl(["التاجر", "آخر طلب", ""], r.slice(0, 30).map(([t, l]) => [`${esc(t.shop_name || t.full_name || "")}<small> ${esc(t.city || "")}</small>`, l ? Math.floor((Date.now() - l) / 864e5) + " يوم" : "ولا مرة", waNo(t.phone) ? `<a class="sm" target="_blank" rel="noopener" href="https://wa.me/${waNo(t.phone)}?text=${encodeURIComponent(`مرحبا ${t.full_name || ""} 💗 اشتقنالك! وصلنا منتجات جديدة عند Tolay Makeup`)}">واتساب</a>` : ""])) : "كل التجار المعتمدين طلبوا خلال الشهر 👏"; } },
  { k: "stale", q: "شو المنتجات اللي ما بتتحرك؟", re: /راكد|ما بتتحرك|بتتحرك|stale|واقف/, fn: D => {
    const last = {}; D.O.filter(o => o.status !== "cancelled").forEach(o => (o.items || []).forEach(it => { const t = Date.parse(o.created_at); if (!(last[it.id] > t)) last[it.id] = t; }));
    const r = P.filter(p => Object.values(p.stock || {}).some(n => +n > 0) && !(last[p.id] > Date.now() - 60 * 864e5)).map(p => [p, Object.values(p.stock).reduce((a, n) => a + (+n || 0), 0), last[p.id]]).sort((a, b) => b[1] - a[1]);
    return r.length ? `${r.length} منتج عندك منهم بضاعة وما انباعوا آخر 60 يوم:` + tbl(["المنتج", "بالمخزون", "آخر بيع"], r.slice(0, 25).map(([p, n, l]) => [`${esc(p.brand)} – ${esc(p.name)}`, n, l ? Math.floor((Date.now() - l) / 864e5) + " يوم" : "ما انباع"])) : "كل المنتجات اللي إلها مخزون عم تنباع ✓"; } },
  { k: "value", q: "قيمة المخزون الحالي", re: /قيمه|قيمة|value|مخزون/, fn: () => {
    let u = 0, c = 0, r = 0, miss = 0; P.forEach(p => Object.values(p.stock || {}).forEach(n => { n = +n || 0; if (!n) return; u += n; if (CO[p.id] != null) c += n * CO[p.id]; else miss += n; const pr = unitPrice(p); if (pr != null) r += n * pr; }));
    return `عندك <b>${u}</b> قطعة. قيمتها بسعر المفرق <b>${money(r2(r))}</b>${can("finance") ? `، وتكلفتها عليك <b>${money(r2(c))}</b>${miss ? ` (${miss} قطعة بدون تكلفة)` : ""}، يعني ربح متوقع ${money(r2(r - c))}` : ""}.`; } },
  { k: "offers", q: "أحسن منتجات أعمل عليها عرض", re: /عرض|عروض|خصم|offer|discount/, fn: D => {
    const sold = {}; linesIn(D, 60).forEach(l => sold[l.id] = (sold[l.id] || 0) + l.qty);
    const r = P.filter(p => p.active !== false).map(p => { const n = Object.values(p.stock || {}).reduce((a, x) => a + (+x || 0), 0), pr = unitPrice(p), c = CO[p.id], m = pr && c != null ? (pr - c) / pr : null; return { p, n, s: sold[p.id] || 0, m }; })
      .filter(x => x.n >= 5 && x.s <= Math.max(1, x.n / 10) && (x.m == null || x.m >= .3)).sort((a, b) => b.n - a.n);
    return r.length ? `هدول عندك منهم كمية منيحة وبيعهم بطيء${can("finance") ? " وهامشهم بيسمح بخصم" : ""}. خصم مقترح 15-25%:` + tbl(["المنتج", "بالمخزون", "انباع بـ60 يوم", ...(can("finance") ? ["الهامش"] : []), "خصم مقترح"], r.slice(0, 15).map(x => [`${esc(x.p.brand)} – ${esc(x.p.name)}`, x.n, x.s, ...(can("finance") ? [x.m == null ? "بدون تكلفة" : Math.round(x.m * 100) + "%"] : []), x.m == null ? "15%" : x.m > .55 ? "25%" : x.m > .4 ? "20%" : "15%"]))
      : "ما لقيت منتجات واضحة للعرض (بدها كميات مدخلة بالمخزون)."; } },
  { k: "repeat", q: "مين الزباين المتوقع يرجعوا يطلبوا؟", re: /يرجع|يرجعوا|زباين|زبون|repeat|customers/, fn: D => {
    const g = {}; D.O.filter(o => o.status !== "cancelled").forEach(o => { const k = o.user_id || String(o.phone || "").replace(/\D/g, ""); if (!k) return; (g[k] = g[k] || []).push(o); });
    const r = Object.values(g).filter(os => os.length >= 2).map(os => { os.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)); const ts = os.map(o => Date.parse(o.created_at)), gap = (ts.at(-1) - ts[0]) / (ts.length - 1), next = ts.at(-1) + gap; return { o: os.at(-1), n: os.length, gap, next }; })
      .filter(x => x.next < Date.now() + 7 * 864e5 && x.next > Date.now() - 30 * 864e5).sort((a, b) => a.next - b.next);
    return r.length ? `هدول عادةً بيطلبوا كل فترة، وموعدهم قرّب أو فات شوي. ذكّريهم:` + tbl(["الزبون", "طلبات", "كل كم يوم", "الموعد المتوقع", ""], r.slice(0, 25).map(x => [esc(x.o.name), x.n, Math.round(x.gap / 864e5), new Date(x.next).toLocaleDateString("en-GB"), waNo(x.o.phone) ? `<a class="sm" target="_blank" rel="noopener" href="https://wa.me/${waNo(x.o.phone)}?text=${encodeURIComponent(`مرحبا ${x.o.name} 💗 صار وقت تجديد مكياجك؟ عنا جديد بـTolay Makeup`)}">واتساب</a>` : ""]))
      : "لسا ما في زباين بنمط واضح (بدها طلبين وأكثر لكل زبون)."; } },
  { k: "forecast", q: "توقّع المبيعات", re: /توقع|توقّع|forecast|الجاي|القادم/, fn: D => {
    const w = [...Array(8)].map((_, i) => D.O.filter(o => SOLD.includes(o.status) && Date.now() - Date.parse(o.created_at) < (8 - i) * 7 * 864e5 && Date.now() - Date.parse(o.created_at) >= (7 - i) * 7 * 864e5).reduce((a, o) => a + (+o.total || 0) - (+o.delivery || 0), 0));
    const n = w.length, mx = (n - 1) / 2, my = w.reduce((a, b) => a + b, 0) / n, slope = w.reduce((a, y, x) => a + (x - mx) * (y - my), 0) / w.reduce((a, _, x) => a + (x - mx) ** 2, 0);
    const next = Math.max(0, my + slope * (n - mx)), month = Math.max(0, [1, 2, 3, 4].reduce((a, k) => a + my + slope * (n - 1 + k - mx), 0));
    if (!my) return "ما في مبيعات كافية بآخر 8 أسابيع لتوقّع.";
    return `حسب آخر 8 أسابيع (الاتجاه ${slope > 0 ? "طالع 📈" : slope < 0 ? "نازل 📉" : "ثابت"})، المتوقع الأسبوع الجاي حوالي <b>${money(Math.round(next))}</b> والشهر الجاي حوالي <b>${money(Math.round(month))}</b>. هاد تقدير بسيط، العروض والمواسم بتغيّره.`
      + tbl(["الأسبوع", ...w.map((_, i) => i === 7 ? "هالأسبوع" : `-${7 - i}`)], [["المبيعات", ...w.map(v => Math.round(v))]]); } },
  { k: "odd", q: "في اشي غريب بالأرقام؟", re: /غريب|مشكله|مشكلة|anomal|خطأ|غلط/, fn: D => {
    const L = [];
    D.O.filter(o => +o.subtotal > 0 && +o.discount / +o.subtotal > .3 && o.status !== "cancelled").forEach(o => L.push(`طلب #${o.id}: خصم ${Math.round(o.discount / o.subtotal * 100)}% (كبير)`));
    D.O.filter(o => o.total == null && o.status !== "cancelled" && Date.now() - Date.parse(o.created_at) > 2 * 864e5).forEach(o => L.push(`طلب #${o.id}: لسا بدون سعر من ${Math.floor((Date.now() - Date.parse(o.created_at)) / 864e5)} يوم`));
    if (can("finance")) {
      P.filter(p => CO[p.id] != null && unitPrice(p) != null && unitPrice(p) < CO[p.id]).forEach(p => L.push(`${esc(p.brand)} – ${esc(p.name)}: سعر البيع (${unitPrice(p)}) أقل من التكلفة (${CO[p.id]})`));
      D.O.filter(o => o.status === "delivered" && o.total != null && +o.total - (+o.paid || 0) > 1 && Date.now() - Date.parse(o.created_at) > 14 * 864e5).forEach(o => L.push(`طلب #${o.id} (${esc(o.name)}) انسلّم من أكثر من أسبوعين ولسا عليه ${money(r2(o.total - (+o.paid || 0)))}`));
    }
    D.O.filter(o => o.items?.some(it => it.unit != null && +it.unit === 0) && o.status !== "cancelled").forEach(o => L.push(`طلب #${o.id}: فيه منتج سعره 0`));
    return L.length ? `لقيت ${L.length} اشي بيستاهل نظرة:<ul>${L.slice(0, 30).map(x => `<li>${x}</li>`).join("")}</ul>` : "ما لقيت اشي غريب ✓"; } },
];
function drawAiChips() { $("#aiChips").innerHTML = AI.map(a => `<button class="chip" type="button" data-ai="${a.k}">${a.q}</button>`).join(""); }
async function ask(q, k) {
  const a = k ? AI.find(x => x.k === k) : AI.find(x => x.re.test(q.toLowerCase()));
  const log = $("#aiLog"); log.insertAdjacentHTML("beforeend", `<div class="aim me">${esc(q)}</div>`);
  const ans = a ? await a.fn(await aiData()) : `ما فهمت عليك منيح 🙈 جرّب واحد من هالأسئلة: ${AI.map(x => `<button class="sm" type="button" data-ai="${x.k}">${x.q}</button>`).join(" ")}`;
  log.insertAdjacentHTML("beforeend", `<div class="aim bot">${ans}</div>`); log.scrollTop = log.scrollHeight;
}
document.addEventListener("click", e => { const k = e.target.dataset?.ai; if (k) ask(AI.find(x => x.k === k).q, k); });
$("#aiForm").addEventListener("submit", e => { e.preventDefault(); const q = $("#aiQ").value.trim(); if (q) { $("#aiQ").value = ""; ask(q); } });
