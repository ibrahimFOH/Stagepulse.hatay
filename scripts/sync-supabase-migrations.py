#!/usr/bin/env python3
import json
import os
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
APPLY_MISSING = os.environ.get("APPLY_MISSING", "false").lower() == "true"

if not TOKEN or not PROJECT_REF:
    raise SystemExit("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required")
if not re.fullmatch(r"[a-z0-9]{20}", PROJECT_REF):
    raise SystemExit("SUPABASE_PROJECT_REF is invalid")

API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"


def query(sql: str):
    request = urllib.request.Request(
        API_URL,
        data=json.dumps({"query": sql, "read_only": False}).encode("utf-8"),
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
        value = payload.get("result", payload.get("data", []))
        return value if isinstance(value, list) else []
    return []


def remote_versions():
    payload = query(
        "select version from supabase_migrations.schema_migrations order by version"
    )
    return [str(row["version"]) for row in rows(payload)]


local = []
for path in sorted(MIGRATIONS.glob("*.sql")):
    match = re.fullmatch(r"(\d{14})_([A-Za-z0-9_]+)\.sql", path.name)
    if not match:
        raise SystemExit(f"Invalid local migration: {path.name}")
    local.append((match.group(1), match.group(2), path))

local_versions = [version for version, _, _ in local]
remote = remote_versions()

if remote != local_versions[: len(remote)]:
    local_only = sorted(set(local_versions) - set(remote))
    remote_only = sorted(set(remote) - set(local_versions))
    print(
        f"local={len(local_versions)} remote={len(remote)} "
        f"local_only={len(local_only)} remote_only={len(remote_only)}"
    )
    raise SystemExit(
        "Production migration history is not an exact repository prefix; automatic apply is blocked"
    )

missing = local[len(remote) :]
print(f"local={len(local_versions)} remote={len(remote)} missing={len(missing)}")
if len(missing) > 10:
    raise SystemExit(
        "More than 10 migrations are missing; automatic apply is blocked for manual history reconciliation"
    )
if missing and not APPLY_MISSING:
    raise SystemExit("Production has unapplied repository migrations")

for version, name, path in missing:
    print(f"Applying migration {version}_{name}")
    query(path.read_text(encoding="utf-8"))
    version_sql = version.replace("'", "''")
    name_sql = name.replace("'", "''")
    query(
        "insert into supabase_migrations.schema_migrations(version,name,statements) "
        f"select '{version_sql}','{name_sql}',array[]::text[] "
        "where not exists (select 1 from supabase_migrations.schema_migrations "
        f"where version='{version_sql}')"
    )

verified = remote_versions()
if verified != local_versions:
    raise SystemExit(
        f"Migration verification failed after apply: local={len(local_versions)} remote={len(verified)}"
    )
print(f"Production migration ledger synchronized: {len(verified)} migrations")