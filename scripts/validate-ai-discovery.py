#!/usr/bin/env python3
"""Validate the public AI/search discovery signals for Stagepulse."""
from __future__ import annotations

import json
import re
import sys
import urllib.request

BASE = "https://stagepulse.com.tr"
UA = "Stagepulse-AI-Discovery/1.0"


def get(path: str) -> str:
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=25) as response:
        if response.status < 200 or response.status >= 400:
            raise RuntimeError(f"{path}: HTTP {response.status}")
        return response.read().decode("utf-8", errors="replace")


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


llms = get("/llms.txt")
for required in (
    "Stagepulse FOH Engineer",
    "Hatay / Antakya",
    "İbrahim Kavasoğlu",
    "https://stagepulse.com.tr/",
    "https://stagepulse.com.tr/ses-sistemi-kiralama.html",
    "https://stagepulse.com.tr/muhendislik.html",
):
    if required not in llms:
        fail(f"llms.txt missing: {required}")

robots = get("/robots.txt")
if "Sitemap: https://stagepulse.com.tr/sitemap.xml" not in robots:
    fail("robots.txt does not expose the canonical sitemap")
if "User-agent: GPTBot" not in robots or "User-agent: ClaudeBot" not in robots:
    fail("robots.txt is missing explicit AI crawler directives")

sitemap = get("/sitemap.xml")
urls = re.findall(r"<loc>(https://stagepulse\.com\.tr(?:/[^<]*)?)</loc>", sitemap)
if not urls or len(urls) != len(set(urls)):
    fail("sitemap has no valid URLs or contains duplicates")

html = get("/")
if "<title>Hatay Ses Sistemi Kiralama & FOH Engineer | Stagepulse</title>" not in html:
    fail("homepage title does not identify Stagepulse and its core service")
if 'name="description"' not in html or "Hatay / Antakya" not in html:
    fail("homepage description is missing regional/service identity")

blocks = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S)
if not blocks:
    fail("homepage has no JSON-LD")

found_org = False
for block in blocks:
    try:
        data = json.loads(block.strip())
    except json.JSONDecodeError:
        continue
    candidates = data.get("@graph", [data]) if isinstance(data, dict) else []
    for item in candidates:
        if not isinstance(item, dict) or item.get("@type") != "Organization":
            continue
        found_org = True
        if item.get("name") != "Stagepulse":
            fail("Organization name is not Stagepulse")
        if item.get("alternateName") != "Stagepulse FOH Engineer":
            fail("Organization alternateName is missing or inconsistent")
        if item.get("url") != BASE + "/":
            fail("Organization URL is not canonical")
        if "https://www.instagram.com/stagepulse.hatay" not in item.get("sameAs", []):
            fail("Organization sameAs is missing the official Instagram identity")
        area = item.get("areaServed", {})
        if area.get("@type") not in {"Country", "City", "AdministrativeArea"}:
            fail("Organization areaServed is missing")
        if not item.get("serviceType"):
            fail("Organization serviceType is missing")

if not found_org:
    fail("homepage Organization JSON-LD was not found")

print(f"PASS: AI/search discovery signals validated ({len(urls)} sitemap URLs)")
