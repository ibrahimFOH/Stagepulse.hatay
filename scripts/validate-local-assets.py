#!/usr/bin/env python3
import html.parser
import pathlib
import urllib.parse

root = pathlib.Path(__file__).resolve().parents[1]

class AssetParser(html.parser.HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source
        self.refs = []
        self.base_href = None

    def handle_starttag(self, tag, attrs):
        if tag == "base":
            href = dict(attrs).get("href")
            if href:
                self.base_href = href
        for key, value in attrs:
            if key not in ("src", "href") or not value:
                continue
            if value.startswith(("#", "http:", "https:", "mailto:", "tel:", "javascript:", "data:", "blob:", "/cdn-cgi/")):
                continue
            clean = urllib.parse.unquote(value.split("#", 1)[0].split("?", 1)[0])
            if clean:
                self.refs.append(clean)

missing = []
for source in root.rglob("*.html"):
    if any(part in {".git", "_site", "node_modules"} for part in source.parts):
        continue
    parser = AssetParser(source)
    parser.feed(source.read_text(encoding="utf-8", errors="ignore"))
    for ref in parser.refs:
        if ref.startswith("/"):
            target = root / ref.lstrip("/")
        elif parser.base_href and parser.base_href.startswith("/"):
            target = root / parser.base_href.lstrip("/") / ref
        else:
            target = source.parent / ref
        target = target.resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            continue
        if not target.exists():
            # Gallery/media assets are loaded dynamically from media.json through
            # media-loader-snippet.js. Missing local copies are intentional.
            normalized = ref.lstrip("./")
            if normalized.startswith(("images/gallery/", "images/", "documents/", "videos/")):
                continue
            missing.append(f"{source.relative_to(root)}: {ref}")

if missing:
    print("\n".join(missing))
    raise SystemExit(1)
print("Local HTML assets OK")
