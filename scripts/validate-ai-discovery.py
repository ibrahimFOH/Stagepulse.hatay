#!/usr/bin/env python3
"""Validate AI/search discovery assets from the checked-out repository."""
from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://stagepulse.com.tr"


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        fail(f"repository asset is missing: {path}")
    return target.read_text(encoding="utf-8")


llms = read("llms.txt")
for required in (
    "Stagepulse FOH Engineer", "Hatay / Antakya", "İbrahim Kavasoğlu",
    BASE + "/", BASE + "/ses-sistemi-kiralama.html",
    BASE + "/muhendislik.html", BASE + "/ekipman.html",
    "Ses, Işık, LED", "Elde Bulunan",
):
    if required not in llms:
        fail(f"llms.txt missing: {required}")

robots = read("robots.txt")
if f"Sitemap: {BASE}/sitemap.xml" not in robots:
    fail("robots.txt does not expose the canonical sitemap")
robot_lines = {line.strip().lower() for line in robots.splitlines()}
for crawler in ("GPTBot", "ClaudeBot"):
    if f"user-agent: {crawler.lower()}" not in robot_lines:
        fail(f"robots.txt is missing explicit AI crawler directive for {crawler}")

sitemap = read("sitemap.xml")
urls = re.findall(r"<loc>(.*?)</loc>", sitemap, re.I | re.S)
canonical_urls = [url for url in urls if url.startswith(BASE + "/")]
if not canonical_urls or len(canonical_urls) != len(set(canonical_urls)):
    fail("sitemap has no valid canonical URLs or contains duplicates")

html = read("index.html")
if "<title>Hatay Ses Sistemi Kiralama & FOH Engineer | Stagepulse</title>" not in html:
    fail("homepage title does not identify Stagepulse and its core service")
if 'name="description"' not in html or "Hatay / Antakya" not in html:
    fail("homepage description is missing regional/service identity")

blocks = re.findall(
    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
    html, re.I | re.S,
)
if not blocks:
    fail("homepage has no JSON-LD")

found_org = False
for block in blocks:
    try:
        data = json.loads(block.strip())
    except json.JSONDecodeError:
        fail("homepage contains invalid JSON-LD")
    candidates = data.get("@graph", [data]) if isinstance(data, dict) else data if isinstance(data, list) else []
    for item in candidates:
        if not isinstance(item, dict) or item.get("@type") != "Organization":
            continue
        found_org = True
        checks = {
            "name": item.get("name") == "Stagepulse",
            "alternateName": item.get("alternateName") == "Stagepulse FOH Engineer",
            "url": item.get("url") == BASE + "/",
            "sameAs": "https://www.instagram.com/stagepulse.hatay" in item.get("sameAs", []),
            "@id": item.get("@id") == BASE + "/#stagepulse",
            "serviceType": bool(item.get("serviceType")),
            "areaServed": isinstance(item.get("areaServed"), dict)
                and item["areaServed"].get("@type") in {"Country", "City", "AdministrativeArea"},
        }
        for key, valid in checks.items():
            if not valid:
                fail(f"Organization JSON-LD field is missing or invalid: {key}")

if not found_org:
    fail("homepage Organization JSON-LD was not found")

print(f"PASS: repository AI/search discovery assets validated ({len(canonical_urls)} sitemap URLs)")
