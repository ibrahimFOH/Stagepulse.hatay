#!/usr/bin/env python3
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
APPLY_MISSING_INPUT = os.environ.get("APPLY_MISSING", "false").strip().lower()

if APPLY_MISSING_INPUT not in {"true", "false"}:
    raise SystemExit("APPLY_MISSING must be exactly true or false")
APPLY_MISSING = APPLY_MISSING_INPUT == "true"

if not TOKEN or not PROJECT_REF:
    raise SystemExit("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required")
if not re.fullmatch(r"[a-z0-9]{20}", PROJECT_REF):
    raise SystemExit("SUPABASE_PROJECT_REF is invalid")

API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"


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


def query(sql: str, *, read_only: bool):
    request = urllib.request.Request(
        API_URL,
        data=json.dumps({"query": sql, "read_only": read_only}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", "replace")
        raise SystemExit(f"Supabase database query failed with HTTP {error.code}: {body[:500]}") from None


def rows(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if "result" in payload:
            value = payload["result"]
        elif "data" in payload:
            value = payload["data"]
        else:
            raise SystemExit("Supabase database query returned no result rows")
        if isinstance(value, list):
            return value
    raise SystemExit("Supabase database query returned an unexpected response")


def remote_versions():
    payload = query(
        "select version from supabase_migrations.schema_migrations order by version",
        read_only=True,
    )
    versions = []
    for row in rows(payload):
        if not isinstance(row, dict) or not re.fullmatch(r"\d{14}", str(row.get("version", ""))):
            raise SystemExit("Production migration history contains an invalid version")
        versions.append(str(row["version"]))
    if versions != sorted(versions) or len(versions) != len(set(versions)):
        raise SystemExit("Production migration versions must be unique and strictly ordered")
    return versions


def require_exact_prefix(remote, local_versions):
    if len(remote) > len(local_versions) or remote != local_versions[: len(remote)]:
        local_only = sorted(set(local_versions) - set(remote))
        remote_only = sorted(set(remote) - set(local_versions))
        detail = (
            f"local={len(local_versions)} remote={len(remote)}; "
            f"local_only={','.join(local_only) or '-'}; "
            f"remote_only={','.join(remote_only) or '-'}"
        )
        print(detail)
        github_summary(f"## Migration audit blocked\n\n{detail}")
        github_annotation("error", "Migration history drift", detail)
        raise SystemExit(
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
        raise SystemExit(f"Invalid local migration: {path.name}")
    local.append((match.group(1), match.group(2), path))

local_versions = [version for version, _, _ in local]
remote = remote_versions()
require_exact_prefix(remote, local_versions)

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
    raise SystemExit(
        "More than 10 migrations are missing; automatic apply is blocked for manual history reconciliation"
    )
if missing and not APPLY_MISSING:
    github_annotation("warning", "Unapplied migrations", audit_detail)
    raise SystemExit("Production has unapplied repository migrations")

for version, name, path in missing:
    # Re-read before every write. This blocks a stale run if another operator
    # changes production after the initial audit.
    current = remote_versions()
    expected = local_versions[: local_versions.index(version)]
    if current != expected:
        raise SystemExit(
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
        raise SystemExit(
            f"Production ledger readback failed after applying {version}; further apply is blocked"
        )

verified = remote_versions()
if verified != local_versions:
    raise SystemExit(
        f"Migration verification failed after apply: local={len(local_versions)} remote={len(verified)}"
    )
print(f"Production migration ledger synchronized: {len(verified)} migrations")
github_annotation(
    "notice",
    "Migration ledger synchronized",
    f"Production and repository both contain {len(verified)} migrations",
)