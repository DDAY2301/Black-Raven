#!/usr/bin/env python3
"""Black Raven static-site regression checks. No third-party dependencies."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("index.html", "gallery.html", "stories.html", "info.html", "zakaj-narava.html", "o-nas.html", "video.html", "oprema.html")
EXTRA_PAGES = ("404.html",)
BASE = "https://dday2301.github.io/Black-Raven/"
errors: list[str] = []


class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.images: list[dict[str, str]] = []
        self.links: list[str] = []
        self.assets: list[str] = []
        self.lang_sl = 0
        self.lang_en = 0
        self.main_count = 0
        self.h1_count = 0
        self.canonical: list[str] = []
        self.og_images: list[str] = []
        self.has_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.append(a["id"])
        self.lang_sl += "data-sl" in a
        self.lang_en += "data-en" in a
        if tag == "main":
            self.main_count += 1
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self.has_title = True
        if tag == "img":
            self.images.append(a)
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical.append(a.get("href", ""))
        if tag == "meta" and a.get("property") == "og:image":
            self.og_images.append(a.get("content", ""))
        for attr in ("src",):
            if a.get(attr):
                self.assets.append(a[attr])
        if tag == "link" and a.get("href") and a.get("rel") in ("stylesheet", "icon", "preload"):
            self.assets.append(a["href"])


def add_error(message):
    errors.append(message)
    print("FAIL:", message)


pages = {}
for filename in PAGES + EXTRA_PAGES:
    path = ROOT / filename
    if not path.is_file():
        add_error(f"Missing page: {filename}")
        continue
    parsed = AuditParser()
    parsed.feed(path.read_text(encoding="utf-8"))
    pages[filename] = parsed

for filename in PAGES:
    page = pages.get(filename)
    if not page:
        continue
    if page.main_count != 1:
        add_error(f"{filename}: expected 1 main, got {page.main_count}")
    if page.h1_count != 1:
        add_error(f"{filename}: expected 1 h1, got {page.h1_count}")
    if not page.has_title:
        add_error(f"{filename}: missing title")
    if page.lang_sl != page.lang_en:
        add_error(f"{filename}: incomplete language pair ({page.lang_sl}/{page.lang_en})")
    if page.canonical != [BASE + ("" if filename == "index.html" else filename)]:
        add_error(f"{filename}: bad or missing canonical: {page.canonical}")
    if len(page.og_images) != 1:
        add_error(f"{filename}: missing or duplicated og:image")
    if page.ids.count("site-navigation") != 1:
        add_error(f"{filename}: missing navigation landmark ID")

for filename, page in pages.items():
    if len(page.ids) != len(set(page.ids)):
        add_error(f"{filename}: duplicate element IDs")
    for img in page.images:
        if "alt" not in img:
            add_error(f"{filename}: img without alt: {img.get('src','')}")
    for asset in page.assets:
        bits = urlsplit(asset)
        if bits.scheme or asset.startswith("//") or asset.startswith("data:"):
            continue
        target = ROOT / unquote(bits.path).lstrip("/")
        if not target.is_file():
            add_error(f"{filename}: missing asset {asset}")
    for link in page.links:
        if link.startswith(("mailto:", "tel:", "https:", "http:", "javascript:")):
            continue
        parsed = urlsplit(link)
        if not parsed.path and not parsed.fragment:
            add_error(f"{filename}: empty link")
            continue
        destination = parsed.path or filename
        if destination == ".":
            destination = "index.html"
        destination = unquote(destination).lstrip("/")
        target = ROOT / destination
        if not target.is_file():
            add_error(f"{filename}: broken link {link}")
            continue
        if parsed.fragment and destination in pages:
            if unquote(parsed.fragment) not in pages[destination].ids:
                add_error(f"{filename}: missing anchor in {link}")

xml_path = ROOT / "sitemap.xml"
if xml_path.is_file():
    try:
        tree = ET.parse(xml_path)
        entries = {
            e.text.strip() for e in tree.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            if e.text
        }
        expected = {BASE + ("" if p == "index.html" else p) for p in PAGES}
        if entries != expected:
            add_error(f"sitemap.xml mismatch: missing={expected-entries} extra={entries-expected}")
    except ET.ParseError as exc:
        add_error(f"sitemap.xml invalid: {exc}")
else:
    add_error("Missing sitemap.xml")

if not (ROOT / "robots.txt").is_file():
    add_error("Missing robots.txt")
if not (ROOT / "assets/js/main.js").is_file():
    add_error("Missing main.js")
print(f"Checked {len(pages)} HTML pages, {sum(len(p.images) for p in pages.values())} image elements, "
      f"{sum(len(p.links) for p in pages.values())} internal/external links.")
if errors:
    print(f"QUALITY GATE FAILED ({len(errors)} issues)")
    sys.exit(1)
print("QUALITY GATE PASSED")
