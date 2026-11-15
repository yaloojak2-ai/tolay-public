// run: node --test tools/importer/  (fixtures only, never hits live sites)
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { checkUrl, sourceOf, isBlockedPage, parseShopify, parseMaybelline, parseJsonLd, matchShades, classify, cleanImg } from "./parse.js";
const fx = f => fs.readFileSync(new URL("./fixtures/" + f, import.meta.url), "utf8");

test("url validation: https + official hosts only", () => {
  assert.equal(checkUrl("https://www.rarebeauty.com/products/x").ok, true);
  assert.equal(checkUrl("http://www.rarebeauty.com/products/x").ok, false);
  assert.equal(checkUrl("https://evil.com/?u=rarebeauty.com").ok, false);
  assert.equal(checkUrl("https://rarebeauty.com.evil.com/x").ok, false);
  assert.equal(checkUrl("https://127.0.0.1/x").ok, false);
  assert.equal(checkUrl("https://169.254.169.254/latest").ok, false);
  assert.equal(checkUrl("https://user:pw@www.rarebeauty.com/").ok, false);
  assert.equal(checkUrl("https://www.rarebeauty.com:8443/").ok, false);
  assert.equal(checkUrl("not a url").ok, false);
  assert.equal(sourceOf("www.maybelline.com").kind, "maybelline");
  assert.equal(sourceOf("www.sephora.com").kind, "blocked");
});

test("bot walls are detected, not bypassed", () => {
  assert.equal(isBlockedPage(403, fx("nyx-challenge.html")), true);
  assert.equal(isBlockedPage(200, fx("nyx-challenge.html")), true);
  assert.equal(isBlockedPage(200, "<html><title>Shop</title></html>"), false);
});

test("shopify (Rare Beauty): shades, sku, swatch/packaging/lifestyle split", () => {
  const r = parseShopify(JSON.parse(fx("rarebeauty-soft-pinch.json")), "https://www.rarebeauty.com/products/soft-pinch-liquid-blush");
  assert.equal(r.brand, "Rare Beauty"); assert.equal(r.name, "Soft Pinch Liquid Blush");
  assert.deepEqual(r.shades.map(s => s.name), ["Hope", "Bliss", "Adore"]);
  const by = Object.fromEntries(r.shades.map(s => [s.name, s]));
  assert.equal(by.Hope.sku, "FGPSPB009DF1");
  assert.match(by.Hope.swatch, /SWATCH-SP-LIQUID-BLUSH-DEWY-HOPE\.png/);
  assert.match(by.Hope.pack, /ECOMM-SP-LIQUID-BLUSH-DEWY-HOPE\.jpg/);
  assert.match(by.Bliss.swatch, /swatch-bliss\.png/);
  assert.match(by.Adore.swatch, /SWATCH-SP-LIQUID-BLUSH-DEWY-ADORE\.png/);
  // shade grids / arm swatches are lifestyle, never a shade swatch
  for (const s of r.shades) { assert.doesNotMatch(s.swatch, /GRID|ARM/); assert.doesNotMatch(s.pack, /GRID|ARM/); }
  assert.ok(r.images.filter(i => /SHADE-GRIDS|ARM-SWATCHES|COMPARISON/.test(i.url)).every(i => i.type === "lifestyle"));
  // a swatch for a shade that is not on this page is not attached to anyone
  assert.ok(!r.images.some(i => /RESILIENCE/.test(i.url) && i.shade));
  assert.ok(r.shades.every(s => !/RESILIENCE/.test(s.swatch + s.pack)));
  // no duplicate image urls
  assert.equal(new Set(r.images.map(i => i.url)).size, r.images.length);
});

test("maybelline: official hex, code, EAN; unrelated shade image not attached", () => {
  const r = parseMaybelline(fx("maybelline-fit-me.html"), "https://www.maybelline.com/face-makeup/foundation-makeup/fit-me-matte-poreless-foundation");
  assert.equal(r.name, "Fit Me Matte + Poreless");
  assert.deepEqual(r.shades.map(s => [s.name, s.hex, s.code, s.barcode]), [["102", "#ffeae3", "1", "041554538311"], ["105", "#ffe1c9", "2", "041554538328"]]);
  assert.ok(r.shades.every(s => s.pack === null)); // 334's photo must not land on 102/105
  assert.ok(!r.images.some(i => /lumi-matte/.test(i.url))); // other products on the page are ignored
  assert.equal(r.images.find(i => /video-still/.test(i.url)).type, "lifestyle");
});

test("generic JSON-LD ProductGroup", () => {
  const r = parseJsonLd(fx("jsonld-product.html"), "https://www.narscosmetics.com/x");
  assert.equal(r.brand, "NARS"); assert.equal(r.name, "Radiant Creamy Concealer");
  assert.deepEqual(r.shades.map(s => [s.name, s.sku]), [["Custard", "0607845028"], ["Vanilla", "0607845011"]]);
  assert.match(r.shades[1].pack, /vanilla-pack/);
  assert.throws(() => parseJsonLd("<html></html>", "https://x"), /JSON-LD/);
});

test("classification", () => {
  assert.equal(classify({ src: "a/SWATCH-HOPE.png" }, true), "swatch");
  assert.equal(classify({ src: "a/ARM-SWATCHES.jpg" }, false), "lifestyle");
  assert.equal(classify({ src: "a/hero.jpg" }, false), "main");
  assert.equal(classify({ src: "a/ECOMM-HOPE.jpg" }, true), "packaging");
  assert.equal(cleanImg("https://x.test/a.jpg?rev=1&v=2"), "https://x.test/a.jpg?v=2");
});

test("matching: sku > code > name, fuzzy only suggests, duplicates flagged", () => {
  const existing = [{ name: "Hope" }, { name: "102 Fair Ivory" }, { name: "Bliss", sku: "S-1" }];
  const m = matchShades([
    { name: "HOPE " }, { name: "102" }, { name: "Blissful", sku: "S-1" }, { name: "New One" }, { name: "Dup" }, { name: "dup" },
  ], existing);
  assert.deepEqual(m.map(x => [x.status, x.match, x.how, x.suggest]), [
    ["matched", 0, "name", null], ["review", null, null, 1], ["matched", 2, "sku", null], ["new", null, null, null], ["duplicate", null, null, null], ["duplicate", null, null, null]]);
  assert.equal(m[0].missingImage, true);
});
