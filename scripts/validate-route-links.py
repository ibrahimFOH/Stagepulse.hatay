#!/usr/bin/env python3
"""Audit local HTML links against files/routes in the repository."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", ".github", "node_modules", "supabase", "tests", "twa-configs", "vendor"}
IGNORED_SCHEMES = {"http", "https", "mailto", "tel", "javascript", "data"}
errors = []
checked = 0

class Parser(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"a", "area", "link", "script", "img", "iframe", "source", "video", "audio"}:
            key = "href" if tag in {"a", "area", "link"} else "src"
            if attrs.get(key): self.links.append((tag, attrs[key]))

html_files = [p for p in ROOT.rglob("*.html") if not any(part in SKIP_DIRS for part in p.parts)]
for page in html_files:
    parser = Parser(page)
    parser.feed(page.read_text(encoding="utf-8", errors="ignore"))
    for tag, raw in parser.links:
        value = raw.strip()
        if not value or value.startswith("#"):
            continue
        parsed = urlparse(value)
        if parsed.scheme.lower() in IGNORED_SCHEMES or parsed.netloc:
            continue
        target = unquote(parsed.path)
        if not target:
            continue
        if target.startswith("/"):
            candidate = ROOT / target.lstrip("/")
        else:
            candidate = (page.parent / target).resolve()
        try:
            candidate.relative_to(ROOT.resolve())
        except ValueError:
            errors.append(f"{page}: link escapes repository: {raw}")
            continue
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.is_file():
            errors.append(f"{page}: broken local {tag} link: {raw} -> {candidate.relative_to(ROOT)}")
        checked += 1

# Validate sitemap targets as part of the same route audit.
sitemap = ROOT / "sitemap.xml"
if sitemap.is_file():
    urls = re.findall(r"<loc>(https://stagepulse\\.com\\.tr(?:/[^<]*)?)</loc>", sitemap.read_text(encoding="utf-8", errors="ignore"))
    for url in urls:
        path = urlparse(url).path.lstrip("/")
        candidate = ROOT / path
        if not path: candidate = ROOT / "index.html"
        elif candidate.is_dir(): candidate /= "index.html"
        if not candidate.is_file(): errors.append(f"sitemap target missing: {url}")

if errors:
    print("ROUTE / LINK AUDIT FAILED")
    for e in errors: print(f"- {e}")
    sys.exit(1)
print(f"Route/link audit passed: {len(html_files)} HTML pages and {checked} local resource links checked.")
