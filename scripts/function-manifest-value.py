#!/usr/bin/env python3
import json
import pathlib
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: function-manifest-value.py FUNCTION_NAME")

root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((root / "supabase" / "functions-manifest.json").read_text(encoding="utf-8"))
matches = [row for row in manifest.get("functions", []) if row.get("name") == sys.argv[1]]
if len(matches) != 1:
    raise SystemExit(f"Unknown or duplicate function: {sys.argv[1]}")
print("true" if matches[0].get("verifyJwt") is True else "false")