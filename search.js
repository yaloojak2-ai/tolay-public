// Tolay search: every word has to match somewhere (brand, name, type, shade, colour, SKU, barcode, description),
// Arabic and English words find each other, small typos get fixed, and "تحت 50" / "under 50" becomes a price filter.
window.TS = (() => {
  const norm = s => String(s ?? "").toLowerCase().normalize("NFKD")
    .replace(/[ً-ٰٟ̀-ͯ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  // English key -> Arabic and other spellings people type
  const SYN = {
    blush: "بلاشر بلشر بلاش خدود", lipstick: "روج احمر حمره حمرة", lip: "شفاه شفايف ليب", gloss: "قلوس جلوس غلوس ملمع",
    oil: "زيت اويل", balm: "بلسم بالم", liner: "لاينر ايلاينر محدد قلم", mascara: "ماسكرا مسكره ماسكارا", foundation: "فاونديشن فونديشن اساس",
    primer: "برايمر برايمير", powder: "بودره بودرة", concealer: "كونسيلر خافي", highlighter: "هايلايتر اضاءه", bronzer: "برونزر",
    palette: "باليت باليته", eyeshadow: "ظلال شادو", brow: "حواجب حاجب", perfume: "عطر عطور بيرفيوم", serum: "سيروم",
    spray: "سبراي بخاخ", setting: "مثبت تثبيت", sponge: "اسفنجه سبونج بلندر", brush: "فرشايه فرشاه فرش", set: "مجموعه سيت طقم",
    mini: "ميني صغير", cream: "كريم", tint: "تنت", mask: "ماسك قناع", patches: "باتش لصقات", stain: "ستين", cheek: "خد",
    dior: "ديور", huda: "هدى هدي", fenty: "فنتي", elf: "ايلف", nyx: "نيكس", sephora: "سيفورا", charlotte: "شارلوت", tilbury: "تلبري",
    ysl: "ايف سان لوران", benefit: "بنفت", maybelline: "ميبيلين", mac: "ماك", rare: "رير", nars: "نارس", valentino: "فالنتينو",
    red: "احمر", pink: "زهري وردي بينك", nude: "نود بيج", brown: "بني", berry: "توتي", coral: "مرجاني كورال", orange: "برتقالي",
    purple: "بنفسجي موف", black: "اسود", gold: "ذهبي", white: "ابيض", clear: "شفاف",
  };
  const ALT = {};
  for (const [en, ar] of Object.entries(SYN)) { const g = [en, ...ar.split(" ")].map(norm); g.forEach(w => ALT[w] = g); }

  // colour family from a shade hex, so "pink blush" or "احمر" finds the right shades
  const family = hex => {
    const n = parseInt(String(hex || "").slice(1), 16); if (isNaN(n)) return "";
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < .08) return l > .85 ? "white clear" : l < .2 ? "black" : "nude";
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
    const s = d / (1 - Math.abs(2 * l - 1));
    if (l > .62 && s < .55) return "nude";
    if (h < 15 || h >= 345) return l < .35 ? "berry red" : "red";
    if (h < 40) return l < .4 ? "brown" : s > .6 ? "coral orange" : "nude brown";
    if (h < 65) return l > .6 ? "nude gold" : "brown gold";
    if (h < 290 && h > 250) return "purple";
    if (h >= 290) return l < .4 ? "berry" : "pink";
    return "";
  };

  let IDX = [], VOCAB = [];
  function build(products, desc) {
    IDX = products.map(p => {
      const x = desc?.[p.b + "|" + p.n] || {}, sh = (p.sw || []).map(s => `${s.name} ${s.barcode || ""} ${family(s.hex)}`).join(" ");
      const codes = [p.sku, p.bc, "tly" + p.id, ...(p.sw || []).flatMap((s, i) => [s.barcode, `tly${p.id}-${i + 1}`])].filter(Boolean).map(c => String(c).toLowerCase());  // TLY… = our printed labels
      return { p, b: norm(p.b), n: norm(p.n), codes, hay: " " + norm(`${p.b} ${p.n} ${p.cat} ${p.s || ""} ${sh} ${p.sku || ""} ${p.bc || ""} ${p.fin || ""} ${x.t || ""}`) + " " };
    });
    VOCAB = [...new Set(IDX.flatMap(e => e.hay.split(" ")).filter(w => w.length > 2))];
  }

  const lev = (a, b) => {
    if (Math.abs(a.length - b.length) > 2) return 9;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  };
  const known = w => IDX.some(e => e.hay.includes(" " + w) || e.hay.includes(w));
  // nearest catalogue word for a typo ("hda" -> "huda", "blsh" -> "blush")
  const fix = w => {
    if (w.length < 3 || known(w) || ALT[w]) return w;
    let best = w, bd = w.length >= 7 ? 3 : 2;
    for (const v of VOCAB) { if (v[0] !== w[0] && w.length < 5) continue; const d = lev(w, v); if (d < bd) { bd = d; best = v; } }
    return best;
  };

  // "تحت 50", "اقل من 50", "under 50", "<50", "فوق 100", "over 100", "50-100"
  function parse(q) {
    let s = " " + norm(q) + " ", min = null, max = null;
    s = s.replace(/ (?:تحت|اقل من|ارخص من|under|below|less than) (\d+)/g, (_, n) => { max = +n; return " "; })
         .replace(/ (?:فوق|اكثر من|اغلى من|over|above|more than) (\d+)/g, (_, n) => { min = +n; return " "; })
         .replace(/ (\d+) (\d+) /g, (m, a, b) => +b > +a && +b < 5000 && String(a).length < 5 ? (min = +a, max = +b, " ") : m);
    const raw = String(q).replace(/[<>]\s*(\d+)/g, (m, n) => { m[0] === "<" ? max = +n : min = +n; return ""; });
    if (raw !== String(q)) s = " " + norm(raw) + " ";
    const words = s.trim().split(/\s+/).filter(w => w && !["و", "مع", "في", "من", "the", "and", "for", "with"].includes(w));
    return { words, min, max };
  }

  // returns { list, fixed: corrected query or "", code: exact barcode/SKU product or null }
  function search(q, price) {
    const raw = String(q || "").trim().toLowerCase();
    if (!raw) return { list: IDX.map(e => e.p), fixed: "", code: null };
    const hit = IDX.find(e => e.codes.includes(raw));
    if (hit) return { list: [hit.p], fixed: "", code: hit.p };
    const { words, min, max } = parse(q);
    const run = ws => IDX.map(e => {
      let sc = 0;
      for (const w of ws) {
        const alts = ALT[w] || [w];
        const m = alts.find(a => e.hay.includes(" " + a)) || alts.find(a => a.length > 2 && e.hay.includes(a));
        if (!m) return null;
        sc += e.b.startsWith(m) ? 6 : e.n.startsWith(m) ? 5 : e.n.includes(m) ? 3 : 1;
      }
      const v = price(e.p);
      if ((min !== null && !(v >= min)) || (max !== null && !(v <= max))) return null;
      return { p: e.p, sc };
    }).filter(Boolean).sort((a, b) => b.sc - a.sc).map(x => x.p);
    let list = run(words), fixed = "";
    if (!list.length && words.length) {
      const fw = words.map(fix);
      if (fw.join(" ") !== words.join(" ")) { list = run(fw); if (list.length) fixed = fw.join(" "); }
    }
    return { list, fixed, code: null };
  }
  return { build, search, norm, family };
})();
