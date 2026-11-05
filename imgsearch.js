// Search by photo, free and on the shopper's phone: MobileNet (TensorFlow.js) turns each picture into a
// fingerprint and we show the products whose photos look closest. If the model can't load, colour matching is used.
(() => {
  const TF = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
  const MN = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js";
  let model = null, mode = null; const FP = {};
  const script = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
  const load = src => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = no; i.src = src; });

  async function getModel() {
    if (mode) return;
    try {
      if (!window.mobilenet) { await script(TF); await script(MN); }
      model = await Promise.race([window.mobilenet.load({ version: 2, alpha: 1 }), new Promise((_, no) => setTimeout(no, 25000))]);
      mode = "mn";
    } catch { mode = "color"; }
  }
  // colour fingerprint: hue/saturation/brightness histogram of the middle of the photo, ignoring white background
  function colorFP(img) {
    const c = document.createElement("canvas"), n = 64; c.width = c.height = n;
    const x = c.getContext("2d", { willReadFrequently: true }), w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, m = Math.min(w, h) * .8;
    x.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, n, n);
    const d = x.getImageData(0, 0, n, n).data, hst = new Float32Array(8 * 4 * 4); let tot = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx ? (mx - mn) / mx : 0;
      if (v > .93 && s < .08) continue; // white backdrop
      let hu = 0; if (mx !== mn) hu = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
      hst[Math.min(7, Math.floor(hu / 6 * 8)) * 16 + Math.min(3, Math.floor(s * 4)) * 4 + Math.min(3, Math.floor(v * 4))]++; tot++;
    }
    return Array.from(hst, v => v / (tot || 1));
  }
  async function fp(img) {
    if (mode !== "mn") return colorFP(img);
    const t = window.tf.tidy(() => model.infer(img, true)), a = await t.data(); t.dispose();
    let s = 0; for (const v of a) s += v * v; s = Math.sqrt(s) || 1;
    return Array.from(a, v => v / s);
  }
  const sim = (a, b) => { let s = 0; if (mode === "mn") { for (let i = 0; i < a.length; i++) s += a[i] * b[i]; } else { for (let i = 0; i < a.length; i++) s += Math.min(a[i], b[i]); } return s; };

  async function run(file) {
    const dlg = $("#imgS"), body = $("#imgSBody"), url = URL.createObjectURL(file);
    body.innerHTML = `<div class="is-q"><img src="${url}" alt="صورتك"><div><b>عم ندوّر على المنتج…</b><small id="isMsg">بنجهّز البحث بالصورة (أول مرة بتاخد ثواني)</small><progress id="isBar" max="1" value="0"></progress></div></div><div class="grid" id="isRes"></div>`;
    dlg.showModal();
    try {
      await getModel();
      const q = await fp(await load(url));
      const list = withImg(ALL.filter(p => !SKIP_BRANDS.includes(p.b) || p.b === "Tolay Select")), key = "tolay-imgfp-" + mode;
      let cache = {}; try { cache = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
      let done = 0;
      for (const p of list) {
        if (!dlg.open) return;
        if (!FP[mode + p.img]) FP[mode + p.img] = cache[p.img] || await load(p.img).then(fp).catch(() => null);
        if (FP[mode + p.img]) cache[p.img] = FP[mode + p.img];
        $("#isBar").value = ++done / list.length; $("#isMsg").textContent = `قارنّا ${done} من ${list.length} منتج`;
      }
      try { localStorage.setItem(key, JSON.stringify(cache, (k, v) => typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v)); } catch {}
      const top = list.map(p => [p, FP[mode + p.img] ? sim(q, FP[mode + p.img]) : -1]).sort((a, b) => b[1] - a[1]).slice(0, 8);
      body.querySelector(".is-q b").textContent = "هدول أقرب منتجات لصورتك";
      $("#isMsg").textContent = "إذا ما لقيتي اللي بدك ياه، ابعتيلنا الصورة على واتساب ومنساعدك."; $("#isBar").remove();
      $("#isRes").innerHTML = top.map(([p]) => cardHTML(p)).join("");
    } catch {
      $("#isMsg").textContent = "ما قدرنا نقرأ الصورة، جرّبي صورة تانية أوضح للمنتج.";
    }
  }
  $("#imgPick").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) run(f); });
  document.addEventListener("click", e => { if (e.target.closest("[data-imgsearch]")) $("#imgPick").click(); if (e.target.closest("#imgSBody [data-open],#imgSBody [data-add]")) $("#imgS").close(); }, true);
  window.imgSearch = run;
})();
