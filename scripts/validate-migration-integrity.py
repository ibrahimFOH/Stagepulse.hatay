#!/usr/bin/env python3
import json
import hashlib
import pathlib
import re
import subprocess

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
required_baseline_keys = {"format_version", "migration_count", "first_version", "last_version", "cutoff_version", "ledger_sha256", "archived_repository_migration_count"}
if not isinstance(baseline, dict) or not required_baseline_keys.issubset(baseline):
    raise SystemExit("Invalid migration baseline manifest")
if baseline["format_version"] != 1:
    raise SystemExit("Unsupported migration baseline format")
for key in ("first_version", "last_version", "cutoff_version"):
    if not re.fullmatch(r"\d{14}", str(baseline[key])):
        raise SystemExit(f"Invalid migration baseline {key}")
if not re.fullmatch(r"[0-9a-f]{64}", str(baseline["ledger_sha256"])):
    raise SystemExit("Invalid migration baseline ledger hash")
if (not isinstance(baseline["migration_count"], int) or baseline["migration_count"] < 1 or not isinstance(baseline["archived_repository_migration_count"], int) or baseline["archived_repository_migration_count"] < 1):
    raise SystemExit("Invalid migration baseline counts")
if not (baseline["first_version"] <= baseline["last_version"] <= baseline["cutoff_version"]):
    raise SystemExit("Migration baseline versions are not ordered")

versions = []
tree = hashlib.sha256()
tree.update(BASELINE.name.encode("utf-8")); tree.update(b"\0"); tree.update(BASELINE.read_bytes())
for path in files:
    match = re.fullmatch(r"(\d{14})_([A-Za-z0-9_]+)\.sql", path.name)
    if not match:
        raise SystemExit(f"Invalid migration filename: {path.name}")
    versions.append(match.group(1))
    if match.group(1) > baseline["cutoff_version"]:
        sql = path.read_text(encoding="utf-8")
        if re.search(r"(?im)^\s*(begin|commit|rollback)\s*;|create\s+index\s+concurrently", sql):
            raise SystemExit(f"Active migration cannot run in the required atomic wrapper: {path.name}")
    tree.update(path.name.encode("utf-8")); tree.update(b"\0"); tree.update(path.read_bytes())

if versions != sorted(versions) or len(versions) != len(set(versions)):
    raise SystemExit("Migration versions must be unique and strictly ordered")
archived_count = sum(version <= baseline["cutoff_version"] for version in versions)
if archived_count != baseline["archived_repository_migration_count"]:
    raise SystemExit("Historical repository migration count changed below the sealed baseline cutoff")
if not LEDGER.is_file():
    raise SystemExit("Missing supabase/migrations.sha256 integrity ledger")
expected = LEDGER.read_text(encoding="utf-8").strip()
current = tree.hexdigest()
if not re.fullmatch(r"[0-9a-f]{64}", expected):
    raise SystemExit("Migration checksum ledger has invalid format")
if current != expected:
    # The checksum file is a sealed checkpoint. Existing migration bytes remain
    # immutable; only new post-cutoff migration files may be appended afterwards.
    try:
        checkpoint = subprocess.check_output(["git", "log", "-1", "--format=%H", "--", "supabase/migrations.sha256"], cwd=ROOT, text=True).strip()
        checkpoint_ledger = subprocess.check_output(["git", "show", f"{checkpoint}:supabase/migrations.sha256"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
        changed = subprocess.check_output(["git", "diff", "--name-status", checkpoint, "HEAD", "--", "supabase/migrations"], cwd=ROOT, text=True).splitlines()
    except (subprocess.CalledProcessError, FileNotFoundError):
        raise SystemExit("Migration checksum ledger mismatch and checkpoint is unavailable")
    if checkpoint_ledger != expected or not changed:
        raise SystemExit("Migration checksum ledger mismatch; review history and intentionally regenerate it")
    for row in changed:
        status, *names = row.split("\t")
        if status != "A" or len(names) != 1:
            raise SystemExit("Migration checksum ledger mismatch; existing migration content changed")
        match = re.fullmatch(r"supabase/migrations/(\d{14})_[A-Za-z0-9_]+\.sql", names[0])
        if not match or match.group(1) <= baseline["cutoff_version"]:
            raise SystemExit("Migration checksum ledger mismatch; only new post-cutoff migrations may be appended")
    print(f"Migration ledger checkpoint preserved; {len(changed)} new post-cutoff migration(s) appended")

active_count = len(files) - archived_count
print(f"Migration ordering and checksums OK: {archived_count} archived, {active_count} active after baseline")
