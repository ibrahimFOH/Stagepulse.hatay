#!/usr/bin/env python3
"""Validate the single canonical Stagepulse runtime surface."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = (
    "admin/admin-runtime.js",
    "admin/patron-center.js",
    "admin/owner-operating-system.js",
    "admin/admin-ai.js",
    "jarvis/admin/index.html",
    "jarvis/core/config.js",
    "supabase/functions/patron-ai/index.ts",
    "supabase/functions/jarvis-tools/index.ts",
    "supabase/functions/jarvis-approve/index.ts",
    "supabase/functions/jarvis-audit/index.ts",
    "supabase/functions/jarvis-health/index.ts",
    "supabase/functions/admin-login/index.ts",
    "supabase/functions/admin-data/index.ts",
    "supabase/functions/admin-ai/index.ts",
    "supabase/functions/staff-login/index.ts",
    "supabase/functions/portal-login/index.ts",
    "supabase/functions/staff-ai/index.ts",
    "supabase/functions/public-quote/index.ts",
    "supabase/functions/site-ai/index.ts",
    "supabase/functions/org-admin-control/index.ts",
    "script.js",
    "portal/staff-ai.js",
    "android/app/src/main/java/tr/com/stagepulse/app/MainActivity.kt",
    "android/app/src/main/java/tr/com/stagepulse/app/AppUpdater.kt",
    ".github/workflows/stagepulse-ci.yml",
    ".github/workflows/regional-seo.yml",
    ".github/workflows/apk-release.yml",
)

errors = []
for rel in REQUIRED:
    path = ROOT / rel
    if not path.is_file() or path.stat().st_size == 0:
        errors.append(f"Missing canonical entrypoint: {rel}")

legacy_redirect = ROOT / "admin/jarvis/index.html"
if not legacy_redirect.is_file():
    errors.append("Missing legacy JARVIS redirect: admin/jarvis/index.html")
else:
    text = legacy_redirect.read_text(encoding="utf-8", errors="ignore")
    if "/jarvis/admin/" not in text:
        errors.append("Legacy JARVIS route does not redirect to /jarvis/admin/")

map_path = ROOT / "docs/CANONICAL_OPERATION_MAP.md"
if not map_path.is_file():
    errors.append("Missing docs/CANONICAL_OPERATION_MAP.md")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    raise SystemExit(1)

print(f"Canonical operation layout OK: {len(REQUIRED)} primary entrypoints validated; legacy JARVIS route redirects to the canonical surface.")
