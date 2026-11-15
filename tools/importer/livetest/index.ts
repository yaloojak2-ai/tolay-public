// Temporary live integration test (deployed only while testing, then deleted): real official pages -> extract -> match
// against the shades already on the Tolay product -> copy images into storage. Writes no product data.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { extract, importImages } from "./core.ts";
import { matchShades } from "./parse.js";
const CASES = [
  { url: "https://www.narscosmetics.com/USA/explicit-lipstick/999NAC0000221.html", pid: 98 },
  { url: "https://www.rarebeauty.com/products/soft-pinch-luminous-powder-blush", pid: 132 },
  { url: "https://www.narscosmetics.com/USA/powder-blush/999NAC0000192.html", pid: 0 }, // not in the store: every shade should come out "new"
  { url: "https://www.nyxcosmetics.com/makeup/face/primer/bare-with-me-daily-moisturizing-primer-spf-30/800897263052.html", pid: 0 }, // expected: restricted, never bypassed
];
const KEY = "lt-7f3c9a21e4b8"; // shortcut: fixed key, the function is deleted right after the test
Deno.serve(async req => {
  if (req.headers.get("x-livetest") !== KEY) return new Response("no", { status: 403 });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const report = [];
  for (const c of CASES) {
    const t0 = Date.now(), r = await extract(c.url);
    if (!r.ok) { report.push({ ...c, ok: false, r }); continue; }
    const { data: p } = c.pid ? await admin.from("products").select("name,swatches").eq("id", c.pid).single() : { data: null };
    const ex = (p?.swatches || []) as { name: string }[];
    const m = matchShades(r.data.shades, ex);
    const urls = [...new Set(m.map(s => s.swatch || s.pack).filter(Boolean))] as string[];
    const results = [];
    for (let i = 0; i < urls.length; i += 24) results.push(...await importImages(admin, `import/${c.pid || "demo"}`, urls.slice(i, i + 24)));
    const by = Object.fromEntries(results.map(x => [x.url, x]));
    report.push({ ...c, ok: true, product: p?.name, source: r.source, title: `${r.data.brand} — ${r.data.name}`, existing: ex.length,
      images: r.data.images.length, types: r.data.images.reduce((a: Record<string, number>, i: { type: string }) => (a[i.type] = (a[i.type] || 0) + 1, a), {}),
      shades: m.map(s => { const img = s.swatch || s.pack; const x = img ? by[img] : null;
        return { name: s.name, code: s.code, sku: s.sku, hex: s.hex, status: s.status, how: s.how, to: s.match != null ? ex[s.match].name : s.suggest != null ? "؟ " + ex[s.suggest].name : null, oldHex: s.match != null ? (ex[s.match] as { hex?: string }).hex ?? null : null,
          img, stored: x?.stored || null, hash: x?.hash || null, bytes: x?.bytes || null, dup: x?.dup || false, error: x && !x.ok ? x.error : (img ? null : "ما في صورة لهالدرجة") }; }),
      uploaded: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length, ms: Date.now() - t0 });
  }
  return new Response(JSON.stringify(report), { headers: { "Content-Type": "application/json" } });
});
