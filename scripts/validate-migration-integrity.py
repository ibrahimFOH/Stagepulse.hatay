#!/usr/bin/env python3
import json
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
LEDGER = ROOT / "supabase" / "migrations.sha256"
BASELINE = ROOT / "supabase" / "migration-baseline.json"

files = sorted(MIGRATIONS.glob("*.sql"))
if not files:
    raise SystemExit("No migrations found")
if not BASELINE.is_file():
    raise SystemExit("Missing supabase/migration-baseline.json")

baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
required_baseline_keys = {
    "format_version",
    "migration_count",
    "first_version",
    "last_version",
    "cutoff_version",
    "ledger_sha256",
    "archived_repository_migration_count",
}
if not isinstance(baseline, dict) or not required_baseline_keys.issubset(baseline):
    raise SystemExit("Invalid migration baseline manifest")
if baseline["format_version"] != 1:
    raise SystemExit("Unsupported migration baseline format")
for key in ("first_version", "last_version", "cutoff_version"):
    if not re.fullmatch(r"\d{14}", str(baseline[key])):
        raise SystemExit(f"Invalid migration baseline {key}")
if not re.fullmatch(r"[0-9a-f]{64}", str(baseline["ledger_sha256"])):
    raise SystemExit("Invalid migration baseline ledger hash")
if (
    not isinstance(baseline["migration_count"], int)
    or baseline["migration_count"] < 1
    or not isinstance(baseline["archived_repository_migration_count"], int)
    or baseline["archived_repository_migration_count"] < 1
):
    raise SystemExit("Invalid migration baseline counts")
if not (
    baseline["first_version"]
    <= baseline["last_version"]
    <= baseline["cutoff_version"]
):
    raise SystemExit("Migration baseline versions are not ordered")

versions = []
tree = hashlib.sha256()
tree.update(BASELINE.name.encode("utf-8"))
tree.update(b"\0")
tree.update(BASELINE.read_bytes())
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
archived_count = sum(version <= baseline["cutoff_version"] for version in versions)
if archived_count != baseline["archived_repository_migration_count"]:
    raise SystemExit(
        "Historical repository migration count changed below the sealed baseline cutoff"
    )
if not LEDGER.is_file():
    raise SystemExit("Missing supabase/migrations.sha256 integrity ledger")
expected = LEDGER.read_text(encoding="utf-8").strip()
if not re.fullmatch(r"[0-9a-f]{64}", expected) or tree.hexdigest() != expected:
    raise SystemExit("Migration checksum ledger mismatch; review history and intentionally regenerate it")

active_count = len(files) - archived_count
print(
    f"Migration ordering and checksums OK: {archived_count} archived, "
    f"{active_count} active after baseline"
)