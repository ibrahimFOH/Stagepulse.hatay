#!/usr/bin/env python3
import json
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
APPLY_MISSING_INPUT = os.environ.get("APPLY_MISSING", "false").strip().lower()


def github_annotation(level: str, title: str, message: str):
    escaped = (
        message.replace("%", "%25")
        .replace("\r", "%0D")
        .replace("\n", "%0A")
    )
    print(f"::{level} title={title}::{escaped}", flush=True)


def github_summary(message: str):
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "").strip()
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(message.rstrip() + "\n")


def abort(message: str):
    github_annotation("error", "Migration synchronization failed", message)
    github_summary(f"## Migration synchronization failed\n\n{message}")
    raise SystemExit(message)


if APPLY_MISSING_INPUT not in {"true", "false"}:
    abort("APPLY_MISSING must be exactly true or false")
APPLY_MISSING = APPLY_MISSING_INPUT == "true"

if not TOKEN or not PROJECT_REF:
    abort("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required")
if not re.fullmatch(r"[a-z0-9]{20}", PROJECT_REF):
    abort("SUPABASE_PROJECT_REF is invalid")

API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"


def query(sql: str, *, read_only: bool):
    payload = json.dumps({"query": sql, "read_only": read_only})
    result = subprocess.run(
        [
            "curl",
            "--fail-with-body",
            "--silent",
            "--show-error",
            "--max-time",
            "180",
            "--request",
            "POST",
            API_URL,
            "--header",
            f"Authorization: Bearer {TOKEN}",
            "--header",
            "Content-Type: application/json",
            "--data-binary",
            "@-",
        ],
        input=payload,
        text=True,
        capture_output=True,
        check=False,
    )
    try:
        if result.returncode != 0:
            detail = (result.stdout or result.stderr or "unknown curl failure").strip()
            abort(f"Supabase database query failed: {detail[:500]}")
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        abort(f"Supabase database query returned invalid JSON: {result.stdout[:500]}")


def rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if "result" in payload:
            value = payload["result"]
        elif "data" in payload:
            value = payload["data"]
        else:
            abort("Supabase database query returned no result rows")
        if isinstance(value, list):
            return value
    abort("Supabase database query returned an unexpected response")


def remote_migrations():
    payload = query(
        "select version, coalesce(name, '') as name, "
        "coalesce(md5(array_to_string(statements, E'\\n')), '') as statement_hash "
        "from supabase_migrations.schema_migrations order by version",
        read_only=True,
    )
    migrations = []
    for row in rows(payload):
        if not isinstance(row, dict) or not re.fullmatch(r"\d{14}", str(row.get("version", ""))):
            abort("Production migration history contains an invalid version")
        name = str(row.get("name", ""))
        statement_hash = str(row.get("statement_hash", ""))
        if not re.fullmatch(r"[A-Za-z0-9_]*", name):
            abort("Production migration history contains an invalid name")
        if statement_hash and not re.fullmatch(r"[0-9a-f]{32}", statement_hash):
            abort("Production migration history contains an invalid statement hash")
        migrations.append(
            {
                "version": str(row["version"]),
                "name": name,
                "statement_hash": statement_hash,
            }
        )
    versions = [migration["version"] for migration in migrations]
    if versions != sorted(versions) or len(versions) != len(set(versions)):
        abort("Production migration versions must be unique and strictly ordered")
    return migrations


def remote_versions():
    return [migration["version"] for migration in remote_migrations()]


def emit_remote_inventory(remote):
    entries = [
        f"{migration['version']}|{migration['name'] or '-'}|"
        f"{migration['statement_hash'] or '-'}"
        for migration in remote
    ]
    chunk_size = 40
    chunk_count = (len(entries) + chunk_size - 1) // chunk_size
    for index in range(0, len(entries), chunk_size):
        chunk = entries[index : index + chunk_size]
        github_annotation(
            "warning",
            f"Production migration inventory {index // chunk_size + 1}/{chunk_count}",
            ",".join(chunk),
        )


def require_exact_prefix(remote, local_versions):
    remote_versions = [migration["version"] for migration in remote]
    if (
        len(remote_versions) > len(local_versions)
        or remote_versions != local_versions[: len(remote_versions)]
    ):
        local_only = sorted(set(local_versions) - set(remote_versions))
        remote_only = sorted(set(remote_versions) - set(local_versions))
        detail = (
            f"local={len(local_versions)} remote={len(remote_versions)}; "
            f"local_only={','.join(local_only) or '-'}; "
            f"remote_only={','.join(remote_only) or '-'}"
        )
        print(detail)
        emit_remote_inventory(remote)
        github_summary(f"## Migration audit blocked\n\n{detail}")
        github_annotation("error", "Migration history drift", detail)
        abort(
            "Production migration history is not an exact repository prefix; automatic apply is blocked"
        )


# Do not trust this script's filename scan alone: the committed checksum ledger makes
# edits to any already-reviewed migration visible before production is contacted.
subprocess.run(
    [sys.executable, str(ROOT / "scripts" / "validate-migration-integrity.py")],
    cwd=ROOT,
    check=True,
)


local = []
for path in sorted(MIGRATIONS.glob("*.sql")):
    match = re.fullmatch(r"(\d{14})_([A-Za-z0-9_]+)\.sql", path.name)
    if not match:
        abort(f"Invalid local migration: {path.name}")
    local.append((match.group(1), match.group(2), path))

local_versions = [version for version, _, _ in local]
remote_inventory = remote_migrations()
remote = [migration["version"] for migration in remote_inventory]
require_exact_prefix(remote_inventory, local_versions)

missing = local[len(remote) :]
missing_versions = [version for version, _, _ in missing]
audit_detail = (
    f"local={len(local_versions)} remote={len(remote)} missing={len(missing)}; "
    f"versions={','.join(missing_versions) or '-'}"
)
print(audit_detail)
github_summary(f"## Migration audit\n\n{audit_detail}")
github_annotation("notice", "Migration audit", audit_detail)
if len(missing) > 10:
    github_annotation("error", "Migration apply blocked", audit_detail)
    abort(
        "More than 10 migrations are missing; automatic apply is blocked for manual history reconciliation"
    )
if missing and not APPLY_MISSING:
    github_annotation("warning", "Unapplied migrations", audit_detail)
    abort("Production has unapplied repository migrations")

for version, name, path in missing:
    # Re-read before every write. This blocks a stale run if another operator
    # changes production after the initial audit.
    current = remote_versions()
    expected = local_versions[: local_versions.index(version)]
    if current != expected:
        abort(
            "Production migration history changed during synchronization; automatic apply is blocked"
        )
    print(f"Applying migration {version}_{name}")
    query(path.read_text(encoding="utf-8"), read_only=False)
    version_sql = version.replace("'", "''")
    name_sql = name.replace("'", "''")
    query(
        "insert into supabase_migrations.schema_migrations(version,name,statements) "
        f"select '{version_sql}','{name_sql}',array[]::text[] "
        "where not exists (select 1 from supabase_migrations.schema_migrations "
        f"where version='{version_sql}')",
        read_only=False,
    )
    recorded = remote_versions()
    if recorded != expected + [version]:
        abort(
            f"Production ledger readback failed after applying {version}; further apply is blocked"
        )

verified = remote_versions()
if verified != local_versions:
    abort(
        f"Migration verification failed after apply: local={len(local_versions)} remote={len(verified)}"
    )
print(f"Production migration ledger synchronized: {len(verified)} migrations")
github_annotation(
    "notice",
    "Migration ledger synchronized",
    f"Production and repository both contain {len(verified)} migrations",
)