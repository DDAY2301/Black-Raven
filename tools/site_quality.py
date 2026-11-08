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

# Contact-form contract: test markup and integration without submitting private data.
contact_source = (ROOT / "o-nas.html").read_text(encoding="utf-8")
form_start = re.search(r'<form\b[^>]*\bid="contact-enquiry-form"[^>]*>', contact_source)
if not form_start:
    add_error("o-nas.html: missing contact enquiry form")
else:
    if 'action=' in form_start.group() or 'data-endpoint="https://blackraven-contact.dan-grmusa.workers.dev/contact"' not in form_start.group():
        add_error("o-nas.html: must point only to owned SMTP endpoint")
    if 'method="POST"' not in form_start.group():
        add_error("o-nas.html: contact form must use POST")
    form_content = contact_source[form_start.end():].split("</form>", 1)[0]
    for field_name in ('name', 'email', 'message', '_gotcha', '_subject', 'topic'):
        if f'name="{field_name}"' not in form_content:
            add_error(f"o-nas.html: missing contact field {field_name}")
    for field_id in ('contact-name', 'contact-email', 'contact-message'):
        if f'for="{field_id}"' not in form_content or f'id="{field_id}"' not in form_content:
            add_error(f"o-nas.html: missing label or field for {field_id}")
    for file in ('assets/css/contact-form.css', 'assets/js/contact-form.js'):
        if not (ROOT / file).is_file():
            add_error(f"Missing contact-form asset: {file}")
    if 'id="contact-form-status"' not in contact_source:
        add_error("o-nas.html: no failure/offline status region")
    if '<button class="contact-form-submit" type="submit" disabled>' not in contact_source:
        add_error("o-nas.html: submission should fail closed before configuration")
    if 'formspree.io' in contact_source or 'formsubmit.co' in contact_source:
        add_error("o-nas.html: third-party form provider still present")
    if 'https://formsubmit.co' in contact_source:
        add_error("o-nas.html: blocked old form processor remains")
    js_text = (ROOT / "assets/js/contact-form.js").read_text(encoding="utf-8")
    if 'blackraven-contact.dan-grmusa.workers.dev' not in js_text or '/ready' not in js_text or 'checkReady' not in js_text or 'event.preventDefault()' not in js_text or 'fetch(endpoint' not in js_text or '15000' not in js_text:
        add_error("contact-form.js: first-party asynchronous submission missing")
    if 'formspree' in js_text or 'formsubmit.co' in js_text:
        add_error("contact-form.js: external form processor still referenced")
    for path in ('backend/server.js', 'backend/lib.js', 'backend/package.json', 'backend/tests/validation.test.js'):
        if not (ROOT / path).is_file():
            add_error(f"Missing direct SMTP backend file: {path}")
    backend_text = (ROOT / 'backend/server.js').read_text(encoding="utf-8")
    if '/ready' not in backend_text or 'smtpout.secureserver.net' not in backend_text or 'info@blackraven.solutions' not in backend_text:
        add_error("backend: unexpected outbound SMTP configuration")
    if 'enquiry' in js_text and "enquiry') === 'sent'" in js_text:
        add_error("contact-form.js: query-based fake success still present")
    if 'formsubmit.co' in js_text:
        add_error("contact-form.js: old form processor present")


# The primary enquiry CTAs must not trigger the visitor's email client.
for page_name in ('index.html', 'info.html', 'oprema.html', 'stories.html'):
    page_source = (ROOT / page_name).read_text(encoding='utf-8')
    if 'mailto:info@blackraven.solutions' in page_source:
        add_error(f"{page_name}: old mailto CTA still present")
    if 'o-nas.html' not in page_source or '#contact-enquiry-form' not in page_source:
        add_error(f"{page_name}: contact form CTA is missing")
if 'contact-direct-email' not in contact_source or 'contact-direct-address' not in contact_source:
    add_error('o-nas.html: clean direct email footer missing')
if 'contact-email-alternative' in contact_source or 'contact-form-jump' in contact_source:
    add_error('o-nas.html: duplicated contact CTA still present')
if 'mailto:info@blackraven.solutions' in contact_source:
    add_error('o-nas.html: mail client shortcut should not crowd primary form')

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
