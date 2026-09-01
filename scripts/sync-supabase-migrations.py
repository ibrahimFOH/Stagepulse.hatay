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
    chunk_size = 150
    chunk_count = (len(entries) + chunk_size - 1) // chunk_size
    for index in range(0, len(entries), chunk_size):
        chunk = entries[index : index + chunk_size]
        github_annotation(
            "warning",
            f"Production migration inventory {index // chunk_size + 1}/{chunk_count}",
            ",".join(chunk),
        )


def extract_touched_objects(local_only):
    patterns = {
        "relation": (
            r"\b(?:create\s+(?:or\s+replace\s+)?view|create\s+table"
            r"(?:\s+if\s+not\s+exists)?|alter\s+table|drop\s+(?:table|view)"
            r"(?:\s+if\s+exists)?)\s+(?:only\s+)?(?:public\.|private\.)?"
            r'"?([a-z_][a-z0-9_]*)'
        ),
        "routine": (
            r"\b(?:create\s+(?:or\s+replace\s+)?function|alter\s+function|"
            r"drop\s+function(?:\s+if\s+exists)?)\s+"
            r"(?:public\.|private\.)?\"?([a-z_][a-z0-9_]*)"
        ),
        "policy": r'\b(?:create|alter|drop)\s+policy\s+(?:if\s+exists\s+)?["\']?([a-z_][a-z0-9_]*)',
        "trigger": r'\b(?:create|drop)\s+trigger\s+(?:if\s+exists\s+)?["\']?([a-z_][a-z0-9_]*)',
        "index": (
            r'\b(?:create\s+(?:unique\s+)?index(?:\s+if\s+not\s+exists)?|'
            r'drop\s+index(?:\s+if\s+exists)?)\s+["\']?([a-z_][a-z0-9_]*)'
        ),
    }
    touched = {kind: set() for kind in patterns}
    for _, _, path in local_only:
        sql = path.read_text(encoding="utf-8").lower()
        for kind, pattern in patterns.items():
            touched[kind].update(re.findall(pattern, sql))
    return touched


def sql_text_list(values):
    return ",".join("'" + value.replace("'", "''") + "'" for value in sorted(values))


def emit_production_state_inventory(local_only):
    touched = extract_touched_objects(local_only)
    selects = []
    if touched["relation"]:
        values = sql_text_list(touched["relation"])
        selects.append(
            "select 'relation' as kind, n.nspname||'.'||c.relname as identity, "
            "md5(coalesce(pg_get_viewdef(c.oid, true), '')||'|'||c.relkind::text) as definition_hash "
            "from pg_class c join pg_namespace n on n.oid=c.relnamespace "
            f"where n.nspname in ('public','private') and c.relname in ({values})"
        )
    if touched["routine"]:
        values = sql_text_list(touched["routine"])
        selects.append(
            "select 'routine' as kind, n.nspname||'.'||p.proname||'('||"
            "pg_get_function_identity_arguments(p.oid)||')' as identity, "
            "md5(pg_get_functiondef(p.oid)) as definition_hash "
            "from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
            f"where n.nspname in ('public','private') and p.proname in ({values})"
        )
    if touched["policy"]:
        values = sql_text_list(touched["policy"])
        selects.append(
            "select 'policy' as kind, schemaname||'.'||tablename||'.'||policyname as identity, "
            "md5(coalesce(cmd,'')||'|'||coalesce(qual,'')||'|'||coalesce(with_check,'')||"
            "'|'||coalesce(array_to_string(roles,','),'')) as definition_hash "
            f"from pg_policies where policyname in ({values})"
        )
    if touched["trigger"]:
        values = sql_text_list(touched["trigger"])
        selects.append(
            "select 'trigger' as kind, n.nspname||'.'||c.relname||'.'||t.tgname as identity, "
            "md5(pg_get_triggerdef(t.oid, true)) as definition_hash "
            "from pg_trigger t join pg_class c on c.oid=t.tgrelid "
            "join pg_namespace n on n.oid=c.relnamespace "
            f"where not t.tgisinternal and t.tgname in ({values})"
        )
    if touched["index"]:
        values = sql_text_list(touched["index"])
        selects.append(
            "select 'index' as kind, n.nspname||'.'||c.relname as identity, "
            "md5(pg_get_indexdef(c.oid)) as definition_hash "
            "from pg_class c join pg_namespace n on n.oid=c.relnamespace "
            f"where c.relkind='i' and c.relname in ({values})"
        )
    if not selects:
        return
    payload = query(
        "select kind, identity, definition_hash from ("
        + " union all ".join(selects)
        + ") inventory order by kind, identity",
        read_only=True,
    )
    entries = [
        f"{row['kind']}|{row['identity']}|{row['definition_hash']}"
        for row in rows(payload)
    ]
    chunk_size = 150
    chunk_count = (len(entries) + chunk_size - 1) // chunk_size
    for index in range(0, len(entries), chunk_size):
        github_annotation(
            "warning",
            f"Production schema state {index // chunk_size + 1}/{chunk_count}",
            ",".join(entries[index : index + chunk_size]),
        )


def require_exact_prefix(remote, local):
    local_versions = [version for version, _, _ in local]
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
        local_only_migrations = [
            migration for migration in local if migration[0] not in set(remote_versions)
        ]
        emit_production_state_inventory(local_only_migrations)
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
require_exact_prefix(remote_inventory, local)

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