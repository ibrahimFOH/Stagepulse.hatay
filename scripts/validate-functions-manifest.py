#!/usr/bin/env python3
import json
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parents[1]
functions_root = root / "supabase" / "functions"
manifest = json.loads((root / "supabase" / "functions-manifest.json").read_text(encoding="utf-8"))
rows = manifest.get("functions", [])
names = [row.get("name") for row in rows]
errors = []

if len(names) != len(set(names)):
    errors.append("Function manifest contains duplicate names.")

directories = sorted(
    path.name for path in functions_root.iterdir()
    if path.is_dir() and path.name != "_shared" and (path / "index.ts").is_file()
)
if sorted(names) != directories:
    errors.append(f"Manifest/directories differ: manifest={sorted(names)} directories={directories}")

config_text = (root / "supabase" / "config.toml").read_text(encoding="utf-8")
configured = {}
for match in re.finditer(
    r"(?ms)^\[functions\.([A-Za-z0-9_-]+)\]\s*\n\s*verify_jwt\s*=\s*(true|false)\s*$",
    config_text,
):
    configured[match.group(1)] = match.group(2) == "true"

expected = {row["name"]: bool(row["verifyJwt"]) for row in rows}
if configured != expected:
    errors.append(f"Manifest/config mismatch: manifest={expected} config={configured}")

if errors:
    print("\n".join(errors), file=sys.stderr)
    raise SystemExit(1)
print(f"Function manifest OK: {len(rows)} functions")