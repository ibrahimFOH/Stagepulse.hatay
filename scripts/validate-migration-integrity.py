#!/usr/bin/env python3
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
LEDGER = ROOT / "supabase" / "migrations.sha256"

files = sorted(MIGRATIONS.glob("*.sql"))
if not files:
    raise SystemExit("No migrations found")

versions = []
tree = hashlib.sha256()
for path in files:
    match = re.fullmatch(r"(\d{14})_([A-Za-z0-9_]+)\.sql", path.name)
    if not match:
        raise SystemExit(f"Invalid migration filename: {path.name}")
    versions.append(match.group(1))
    tree.update(path.name.encode("utf-8"))
    tree.update(b"\0")
    tree.update(path.read_bytes())

if versions != sorted(versions) or len(versions) != len(set(versions)):
    raise SystemExit("Migration versions must be unique and strictly ordered")
if not LEDGER.is_file():
    raise SystemExit("Missing supabase/migrations.sha256 integrity ledger")
expected = LEDGER.read_text(encoding="utf-8").strip()
if not re.fullmatch(r"[0-9a-f]{64}", expected) or tree.hexdigest() != expected:
    raise SystemExit("Migration checksum ledger mismatch; review history and intentionally regenerate it")

print(f"Migration ordering and checksums OK: {len(files)}")