#!/usr/bin/env python3
"""Validate the single canonical Stagepulse runtime surface."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = (
    "admin/admin-runtime.js",
    "admin/patron-center.js",
    "admin/owner-operating-system.js",
    "admin/admin-ai.js",
    "supabase/functions/admin-login/index.ts",
    "supabase/functions/admin-data/index.ts",
    "supabase/functions/admin-ai/index.ts",
    "supabase/functions/staff-login/index.ts",
    "supabase/functions/portal-login/index.ts",
    "supabase/functions/staff-ai/index.ts",
    "supabase/functions/public-quote/index.ts",
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

for rel in (
    "jarvis/admin/index.html",
    "jarvis/core/config.js",
    "jarvis/core/health.md",
    "jarvis/docs/README.md",
    "admin/jarvis/index.html",
    "site-ai.js",
    "ai-knowledge.json",
):
    if (ROOT / rel).exists():
        errors.append(f"Removed AI/JARVIS artifact still present: {rel}")

map_path = ROOT / "docs/CANONICAL_OPERATION_MAP.md"
if not map_path.is_file():
    errors.append("Missing docs/CANONICAL_OPERATION_MAP.md")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    raise SystemExit(1)

print(f"Canonical operation layout OK: {len(REQUIRED)} primary entrypoints validated; retired JARVIS/public-AI artifacts are absent.")
