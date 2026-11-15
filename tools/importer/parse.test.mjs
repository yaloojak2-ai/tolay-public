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

import { parseSfcc, parseCSV, fromRows, matchFiles, shadesFromFiles, parseBundle, SOURCES } from "./parse.js";

test("every source has one of the four statuses; NYX/Sephora are not claimed as available", () => {
  for (const s of Object.values(SOURCES)) assert.ok(["available", "restricted", "auth", "unsupported"].includes(s.status));
  assert.equal(SOURCES["nyxcosmetics.com"].status, "restricted"); assert.equal(SOURCES["sephora.com"].status, "restricted");
});

test("sfcc (NARS): shade names, number codes, official hex, per-shade full-size image", () => {
  const r = parseSfcc(fx("nars-powder-blush.html"), "https://www.narscosmetics.com/USA/powder-blush/999NAC0000192.html");
  assert.equal(r.brand, "NARS"); assert.equal(r.name, "Powder Blush");
  assert.deepEqual(r.shades.map(s => [s.name, s.code, s.hex, s.sku]), [["777 Orgasm", "777", "#faa7a6", "4251140407"], ["778 Orgasm Edge", "778", "#f58a8f", "4251140506"]]);
  const live = `<li data-shade-name="361 Morocco"><a data-lgimg='{&quot;url&quot;:&quot;https://www.narscosmetics.com/dw/image/v2/x/0194251171746_1.jpg?sw=255&amp;sh=255&quot;}\\"}'></a></li>`; // live attribute: not valid JSON
  assert.equal(parseSfcc(live, "https://www.narscosmetics.com/x").shades[0].barcode, "194251171746");
  assert.ok(r.shades[0].pack.endsWith("Orgasm_GLBL.jpg?sm=fit")); // sw/sh size params removed -> original size
  assert.notEqual(r.shades[0].pack, r.shades[1].pack); // each shade keeps its own image
  assert.equal(r.images[0].type, "main");
});

test("supplier CSV: quotes, semicolons, Arabic headers, aliases", () => {
  const rows = parseCSV('﻿Shade Name;SKU;EAN;Hex;Swatch Image;Packshot\n"102 Fair Ivory";NYX1;0800897;#F1D3C2;102_swatch.png;102_pack.jpg\n"Light, Warm";NYX2;;bad;;\n');
  assert.equal(rows.length, 2); assert.equal(rows[1]["Shade Name"], "Light, Warm");
  const d = fromRows(rows);
  assert.deepEqual(d.shades[0], { name: "102 Fair Ivory", code: null, sku: "NYX1", barcode: "0800897", hex: "#f1d3c2", swatch: "102_swatch.png", pack: "102_pack.jpg" });
  assert.equal(d.shades[1].hex, null); // a bad colour value is dropped, never guessed
  assert.deepEqual(fromRows([{ "اسم الدرجة": "وردي", "رقم": "5" }]).shades[0].code, "5");
});

test("files -> shades: by sku/code/name as a whole word; ambiguous or unrelated files are never assigned", () => {
  const shades = [{ name: "Hope", sku: "FGP9" }, { name: "Hopeful" }, { name: "102 Fair Ivory", code: "102" }, { name: "Joy" }];
  const m = Object.fromEntries(matchFiles(["x/SWATCH-HOPE.png", "Hopeful_pack.jpg", "102_swatch.png", "FGP9.jpg", "lifestyle-model.jpg", "logo.png", "joy hope combo.jpg"], shades).map(r => [r.file, r]));
  assert.equal(m["x/SWATCH-HOPE.png"].shade, "Hope"); assert.equal(m["x/SWATCH-HOPE.png"].type, "swatch");
  assert.equal(m["Hopeful_pack.jpg"].shade, "Hopeful"); assert.equal(m["Hopeful_pack.jpg"].type, "packaging");
  assert.equal(m["102_swatch.png"].shade, "102 Fair Ivory"); assert.equal(m["FGP9.jpg"].shade, "Hope");
  assert.equal(m["lifestyle-model.jpg"].shade, null); assert.equal(m["logo.png"].shade, null);
  assert.equal(m["joy hope combo.jpg"].shade, null); // two shades named -> nobody gets it
  assert.equal(matchFiles(["NARS_Orgasm_Edge.jpg"], [{ name: "777 Orgasm" }, { name: "Orgasm" }, { name: "Orgasm Edge" }])[0].shade, "Orgasm Edge");
  assert.deepEqual(shadesFromFiles(["102 Fair Ivory - swatch.png", "102 Fair Ivory.jpg", "Joy_box.jpg", "model-lifestyle.jpg", "main.jpg"]).map(s => s.name), ["102 Fair Ivory", "Joy"]);
});

test("browser-helper bundle: validated, bad hex dropped, inline images kept", () => {
  assert.throws(() => parseBundle({ shades: [] }));
  const b = parseBundle({ tolay: 1, brand: "NYX", name: "Bare With Me", url: "https://www.nyxcosmetics.com/x.html", shades: [{ name: "01 Light", hex: "zz" }], images: [{ url: "https://www.nyxcosmetics.com/a.jpg", type: "swatch", shade: "01 Light", data: "AAAA", mime: "image/png" }] });
  assert.equal(b.shades[0].hex, null); assert.equal(b.images[0].data, "AAAA");
});

import { build } from "../tolay-helper/build.js";
test("browser helper: same parser copy, no risky permissions, NARS page -> bundle the admin accepts", () => {
  assert.equal(fs.readFileSync(new URL("../tolay-helper/parse.js", import.meta.url), "utf8"), fs.readFileSync(new URL("./parse.js", import.meta.url), "utf8"));
  const man = JSON.parse(fs.readFileSync(new URL("../tolay-helper/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(man.permissions, ["activeTab", "scripting"]); assert.equal(man.host_permissions, undefined);
  const html = fx("nars-powder-blush.html"), url = "https://www.narscosmetics.com/USA/powder-blush/999NAC0000192.html";
  const b = build({ url, title: "Powder Blush | NARS", html, dom: { shades: [], images: [] } });
  const back = parseBundle(JSON.parse(JSON.stringify(b)));
  assert.deepEqual(back.shades.map(s => [s.name, s.hex]), [["777 Orgasm", "#faa7a6"], ["778 Orgasm Edge", "#f58a8f"]]);
  // a page with no known structure: shades come from the swatch buttons on screen, colour only from the page's own attributes
  const g = build({ url: "https://www.nyxcosmetics.com/x.html", title: "Bare With Me | NYX", html: "<html></html>", dom: { shades: [{ name: "01 Light", hex: "#f2d6c4", thumb: "https://www.nyxcosmetics.com/sw1.jpg" }, { name: "02 Medium", hex: null, thumb: null }], images: [{ url: "https://www.nyxcosmetics.com/main.jpg", alt: "" }] } });
  assert.deepEqual(g.shades.map(s => [s.name, s.code, s.hex, s.swatch]), [["01 Light", "01", "#f2d6c4", "https://www.nyxcosmetics.com/sw1.jpg"], ["02 Medium", "02", null, null]]);
  assert.equal(g.images.find(i => i.shade === "01 Light").type, "swatch");
});

test("bundle keeps only the 'sampled' confidence mark", async () => {
  const { parseBundle } = await import("./parse.js");
  const b = parseBundle({ tolay: 1, shades: [{ name: "Java", hex: "#381E1D", conf: "sampled" }, { name: "Fair", hex: "#f1c4b1", conf: "high" }] });
  assert.equal(b.shades[0].conf, "sampled"); assert.equal(b.shades[0].hex, "#381e1d"); assert.equal(b.shades[1].conf, null);
});

test("bundle accepts hexSampled from older helper copies as sampled", async () => {
  const { parseBundle } = await import("./parse.js");
  const b = parseBundle({ tolay: 1, shades: [{ name: "Java", hexSampled: "#452928" }, { name: "Fair", hex: "#f1c4b1", hexSampled: "#000000" }] });
  assert.equal(b.shades[0].hex, "#452928"); assert.equal(b.shades[0].conf, "sampled"); assert.equal(b.shades[1].hex, "#f1c4b1"); assert.equal(b.shades[1].conf, null);
});

test("helper files for different shades merge into one product", async () => {
  const { parseBundle, mergeBundles } = await import("./parse.js");
  const a = parseBundle({ tolay: 1, name: "Blur", shades: [{ name: "Java", hex: "#381e1d" }, { name: "Fair" }], images: [{ url: "https://x/g1.jpg" }, { url: "https://x/java-model.jpg", shade: "Java" }] });
  const b = parseBundle({ tolay: 1, name: "Blur", shades: [{ name: "fair", hex: "#f1c4b1" }, { name: "Mocha" }], images: [{ url: "https://x/g1.jpg" }, { url: "https://x/fair-model.jpg", shade: "Fair" }] });
  const m = mergeBundles([a, b]);
  assert.deepEqual(m.shades.map(s => s.name), ["Java", "Fair", "Mocha"]); assert.equal(m.shades[1].hex, "#f1c4b1");
  assert.deepEqual(m.images.map(i => [i.url.split("/").pop(), i.shade]), [["g1.jpg", null], ["java-model.jpg", "Java"], ["fair-model.jpg", "Fair"]]);
});
