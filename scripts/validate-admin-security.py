#!/usr/bin/env python3
"""Static admin security gate. Intentionally conservative."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ADMIN = ROOT / "admin"
errors = []

if not (ADMIN / "index.html").is_file():
    errors.append("admin/index.html is missing")

text_files = [p for p in ADMIN.rglob("*") if p.is_file() and p.suffix.lower() in {".html", ".js", ".css", ".json", ".md"}]
combined = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in text_files)

patterns = {
    "service-role credential": r"SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]",
    "private key material": r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    "hard-coded bearer token": r"Authorization\s*[:=]\s*[\"']Bearer\s+[A-Za-z0-9._-]{24,}",
    "unsafe javascript URL": r"href\s*=\s*[\"']javascript:",
}
for label, pattern in patterns.items():
    if re.search(pattern, combined, re.I):
        errors.append(f"found {label} in admin source")

headers = ADMIN / "_headers"
if not headers.is_file():
    errors.append("admin/_headers is missing")
else:
    h = headers.read_text(encoding="utf-8", errors="ignore").lower()
    for required in ("x-content-type-options: nosniff", "referrer-policy:", "content-security-policy:", "cache-control: no-store"):
        if required not in h:
            errors.append(f"admin/_headers missing {required}")

index = (ADMIN / "index.html").read_text(encoding="utf-8", errors="ignore") if (ADMIN / "index.html").is_file() else ""
if re.search(r'<meta[^>]+http-equiv=["\']content-security-policy', index, re.I):
    errors.append("admin/index.html duplicates CSP as an HTML meta policy; keep canonical policy in _headers")

if errors:
    print("ADMIN SECURITY GATE FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print(f"Admin security gate passed: {len(text_files)} admin text assets scanned; credentials, private keys, unsafe URL patterns and required security headers verified.")
