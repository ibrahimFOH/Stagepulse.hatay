#!/usr/bin/env python3
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SYNC = (ROOT / "scripts" / "sync-supabase-migrations.py").read_text(encoding="utf-8")

required_tokens = [
    "lock table supabase_migrations.schema_migrations in exclusive mode",
    "actual_historical_count",
    "actual_historical_first",
    "actual_historical_last",
    "actual_historical_hash",
    "actual_baseline_guard",
    "sealed migration baseline changed before atomic apply",
    "production migration baseline guard changed before atomic apply",
]
for token in required_tokens:
    if token not in SYNC:
        raise SystemExit(f"Atomic migration guard is missing required check: {token}")

lock_position = SYNC.index(
    "lock table supabase_migrations.schema_migrations in exclusive mode"
)
historical_check_position = SYNC.index("actual_historical_hash")
migration_position = SYNC.index('f"{migration_sql.rstrip()}\\n"')
if not lock_position < historical_check_position < migration_position:
    raise SystemExit(
        "Atomic migration guard must lock and verify historical state before migration SQL"
    )


def fingerprint(rows):
    digest = hashlib.sha256()
    for row in rows:
        statement_hash = hashlib.sha256(
            json.dumps(
                row["statements"],
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        digest.update(
            f"{row['version']}|{row['name']}|{statement_hash}\n".encode("utf-8")
        )
    return digest.hexdigest()


before_lock = [
    {"version": "20260101000000", "name": "baseline", "statements": ["select 1"]}
]
sealed = fingerprint(before_lock)
between_read_and_lock = [
    {"version": "20260101000000", "name": "baseline", "statements": ["select 2"]}
]
if fingerprint(between_read_and_lock) == sealed:
    raise SystemExit("Simulated between-read-and-lock baseline mutation was not detected")

print("Atomic migration guard ordering and race simulation OK")