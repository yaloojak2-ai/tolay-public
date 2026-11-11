#!/usr/bin/env python3
# Writes p/<id>.html: a tiny page with Open Graph tags (for WhatsApp/Facebook previews) that sends people to /#/p/<id>.
# Re-run after adding products: update tools/products.tsv (id, brand, name, image) first.
import html, os
os.makedirs("p", exist_ok=True)
for line in open("tools/products.tsv", encoding="utf-8"):
    i, b, n, img = line.rstrip("\n").split("\t")
    t = html.escape(f"{b} - {n}", quote=True)
    open(f"p/{i}.html", "w", encoding="utf-8").write(f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{t} | Tolay Makeup</title>
<meta property="og:type" content="product"><meta property="og:site_name" content="Tolay Makeup"><meta property="og:title" content="{t}">
<meta property="og:description" content="مكياج وعناية وعطور أصلية من أمريكا - الدفع عند الاستلام"><meta property="og:image" content="https://tolaymakeup.store/{img}">
<meta property="og:url" content="https://tolaymakeup.store/p/{i}.html"><meta name="twitter:card" content="summary_large_image">
<script>location.replace("/#/p/{i}")</script></head><body><a href="/#/p/{i}">{t}</a></body></html>''')
