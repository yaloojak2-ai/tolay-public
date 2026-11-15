// Tolay helper end to end on an e.l.f.-style page: swatch chip and variant product photo stay apart (needs: npm i jsdom)
import { JSDOM } from "jsdom"; import fs from "fs"; import assert from "assert";
import { build } from "../tolay-helper/build.js";
import { parseBundle, matchShades } from "./parse.js";
// official og:image per shade, as read live from elfcosmetics.com via WebFetch (Nov 15 2026)
const OG = { "Cream & Sugar": "29921_OpenA_R.png", "Cold Brew": "21194_OpenA_V2_R.png", "Orange Dreamsicle": "21152_OpenA_R.png", "Truffles": "generic.png", "Berry Bad": "generic.png" };
const names = Object.keys(OG);
const html = `<body><div class="swatch">${names.map(n => `<button aria-label="${n.replace("&", "&amp;")}"></button>`).join("")}</div>${names.map((n, i) => `<a href="/products/bite-size-eyeshadow?Color=${encodeURIComponent(n).replace(/%20/g, "+")}"><img src="https://cdn.x/chip${i}.jpg"></a>`).join("")}</body>`;
const d = new JSDOM(html, { url: "https://www.elfcosmetics.com/products/bite-size-eyeshadow?Color=Orange+Dreamsicle", runScripts: "outside-only" });
d.window.fetch = async u => { const c = decodeURIComponent(String(u).split("Color=")[1].replace(/\+/g, " "));
  return { ok: true, text: async () => `<html><head><meta property="og:image" content="https://cdn.shopify.com/s/files/${OG[c]}"></head><body><img src="https://cdn.shopify.com/${c.length}_arm.jpg" alt="${c} Arm Swatches"></body></html>` }; };
d.window.eval("globalThis.R=" + fs.readFileSync(new URL("../tolay-helper/grab.js", import.meta.url), "utf8").replace(/;\s*$/, ""));
const g = await d.window.R; g.html = "<html></html>"; g.dom.images = [];
const r = build(g), by = Object.fromEntries(r.shades.map(s => [s.name, s]));
for (const n of ["Cream & Sugar", "Cold Brew", "Orange Dreamsicle"]) { assert.ok(by[n].swatch.includes("chip"), n + " swatch"); assert.ok(by[n].pack.endsWith(OG[n]), n + " pack"); }
assert.equal(new Set(["Cream & Sugar", "Cold Brew", "Orange Dreamsicle"].map(n => by[n].pack)).size, 3, "3 different product photos");
for (const n of ["Truffles", "Berry Bad"]) { assert.equal(by[n].pack, null, n + " shared photo dropped"); assert.ok(by[n].swatch, n + " keeps swatch"); }
// the bundle the admin reads keeps both pictures apart, and missing ones stay missing
const b = parseBundle(JSON.parse(JSON.stringify(r))), m = matchShades(b.shades, []);
assert.ok(m.find(s => s.name === "Cold Brew").pack.endsWith("21194_OpenA_V2_R.png") && m.find(s => s.name === "Cold Brew").swatch.includes("chip"));
assert.equal(m.find(s => s.name === "Truffles").pack, null);
console.log("helper OK:", JSON.stringify(r.shades.map(s => [s.name, s.swatch?.split("/").pop(), s.pack?.split("/").pop() || "MISSING"])));
