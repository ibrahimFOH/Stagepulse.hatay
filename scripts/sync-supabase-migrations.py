#!/usr/bin/env python3
import json
import hashlib
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
BASELINE_PATH = ROOT / "supabase" / "migration-baseline.json"
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
        "coalesce(statements, array[]::text[]) as statements "
        "from supabase_migrations.schema_migrations order by version",
        read_only=True,
    )
    migrations = []
    for row in rows(payload):
        if not isinstance(row, dict) or not re.fullmatch(r"\d{14}", str(row.get("version", ""))):
            abort("Production migration history contains an invalid version")
        name = str(row.get("name", ""))
        statements = row.get("statements", [])
        if not re.fullmatch(r"[A-Za-z0-9_]*", name):
            abort("Production migration history contains an invalid name")
        if not isinstance(statements, list) or not all(
            isinstance(statement, str) for statement in statements
        ):
            abort("Production migration history contains invalid statements")
        statement_hash = hashlib.sha256(
            json.dumps(
                statements,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
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


def load_baseline():
    try:
        baseline_bytes = BASELINE_PATH.read_bytes()
        baseline = json.loads(baseline_bytes)
    except (OSError, json.JSONDecodeError) as exc:
        abort(f"Migration baseline manifest is unreadable: {exc}")
    required = {
        "format_version",
        "migration_count",
        "first_version",
        "last_version",
        "cutoff_version",
        "ledger_sha256",
    }
    if not isinstance(baseline, dict) or not required.issubset(baseline):
        abort("Migration baseline manifest is invalid")
    if baseline["format_version"] != 1:
        abort("Migration baseline format is unsupported")
    if not re.fullmatch(r"\d{14}", str(baseline["cutoff_version"])):
        abort("Migration baseline cutoff is invalid")
    if not re.fullmatch(r"[0-9a-f]{64}", str(baseline["ledger_sha256"])):
        abort("Migration baseline ledger hash is invalid")
    baseline["_manifest_sha256"] = hashlib.sha256(baseline_bytes).hexdigest()
    return baseline


def migration_fingerprint(migrations):
    digest = hashlib.sha256()
    for migration in migrations:
        digest.update(
            (
                f"{migration['version']}|{migration['name']}|"
                f"{migration['statement_hash']}\n"
            ).encode("utf-8")
        )
    return digest.hexdigest()


def sql_statement_hash_expression():
    return (
        "encode(extensions.digest(convert_to("
        "to_json(coalesce(statements, array[]::text[]))::text,"
        "'UTF8'),'sha256'),'hex')"
    )


def sql_ledger_fingerprint_expression():
    return (
        "encode(extensions.digest(convert_to(coalesce(string_agg("
        "version::text||'|'||coalesce(name,'')||'|'||"
        f"{sql_statement_hash_expression()}||E'\\n','' order by version),''),"
        "'UTF8'),'sha256'),'hex')"
    )


def require_sealed_baseline(remote, baseline):
    historical = [
        migration
        for migration in remote
        if migration["version"] <= baseline["cutoff_version"]
    ]
    detail = (
        f"expected_count={baseline['migration_count']} actual_count={len(historical)}; "
        f"expected_hash={baseline['ledger_sha256']} "
        f"actual_hash={migration_fingerprint(historical)}"
    )
    if (
        len(historical) != baseline["migration_count"]
        or not historical
        or historical[0]["version"] != baseline["first_version"]
        or historical[-1]["version"] != baseline["last_version"]
        or migration_fingerprint(historical) != baseline["ledger_sha256"]
    ):
        github_annotation("error", "Sealed migration baseline drift", detail)
        abort("Production migration baseline no longer matches the sealed repository snapshot")
    github_annotation("notice", "Sealed migration baseline verified", detail)


def require_sql_canonical_fingerprint(baseline):
    payload = query(
        "select count(*)::integer as migration_count, "
        "min(version)::text as first_version, max(version)::text as last_version, "
        f"{sql_ledger_fingerprint_expression()} as ledger_sha256 "
        "from supabase_migrations.schema_migrations "
        f"where version <= '{baseline['cutoff_version']}'",
        read_only=True,
    )
    result_rows = rows(payload)
    if len(result_rows) != 1 or not isinstance(result_rows[0], dict):
        abort("SQL canonical migration fingerprint query returned an invalid result")
    result = result_rows[0]
    if (
        result.get("migration_count") != baseline["migration_count"]
        or str(result.get("first_version", "")) != baseline["first_version"]
        or str(result.get("last_version", "")) != baseline["last_version"]
        or str(result.get("ledger_sha256", "")) != baseline["ledger_sha256"]
    ):
        abort(
            "SQL canonical migration fingerprint does not match the sealed baseline"
        )


def production_baseline_guard():
    payload = query(
        "select coalesce("
        "obj_description('supabase_migrations.schema_migrations'::regclass),"
        "'') as baseline_guard",
        read_only=True,
    )
    result_rows = rows(payload)
    if len(result_rows) != 1 or not isinstance(result_rows[0], dict):
        abort("Production migration baseline guard query returned an invalid result")
    return str(result_rows[0].get("baseline_guard", ""))


def require_production_baseline_guard(baseline, *, allow_initialize):
    expected = f"stagepulse-migration-baseline:{baseline['_manifest_sha256']}"
    actual = production_baseline_guard()
    if actual == expected:
        return
    if not actual and allow_initialize:
        query(
            "comment on table supabase_migrations.schema_migrations is "
            f"'{expected}'",
            read_only=False,
        )
        if production_baseline_guard() != expected:
            abort("Production migration baseline guard initialization readback failed")
        github_annotation(
            "notice",
            "Production migration baseline guard initialized",
            baseline["_manifest_sha256"],
        )
        return
    if actual:
        abort(
            "Production migration baseline guard does not match the repository manifest; "
            "automatic rotation is forbidden"
        )
    abort(
        "Production migration baseline guard is not initialized; rerun once with "
        "apply_missing=true after production approval"
    )


def require_exact_prefix(remote_versions, local_versions):
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
subprocess.run(
    [sys.executable, str(ROOT / "scripts" / "validate-migration-atomic-guard.py")],
    cwd=ROOT,
    check=True,
)


local = []
for path in sorted(MIGRATIONS.glob("*.sql")):
    match = re.fullmatch(r"(\d{14})_([A-Za-z0-9_]+)\.sql", path.name)
    if not match:
        abort(f"Invalid local migration: {path.name}")
    local.append((match.group(1), match.group(2), path))

baseline = load_baseline()
active = [
    migration for migration in local if migration[0] > baseline["cutoff_version"]
]
active_versions = [version for version, _, _ in active]
remote_inventory = remote_migrations()
require_sealed_baseline(remote_inventory, baseline)
require_sql_canonical_fingerprint(baseline)
require_production_baseline_guard(baseline, allow_initialize=APPLY_MISSING)
remote_active = [
    migration["version"]
    for migration in remote_inventory
    if migration["version"] > baseline["cutoff_version"]
]
require_exact_prefix(remote_active, active_versions)

missing = active[len(remote_active) :]
missing_versions = [version for version, _, _ in missing]
audit_detail = (
    f"baseline={baseline['migration_count']} active_local={len(active_versions)} "
    f"active_remote={len(remote_active)} missing={len(missing)}; "
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
    # Re-read before every write. The same expected state is checked again after
    # taking an advisory lock and an exclusive ledger-table lock in the atomic
    # transaction below.
    current_inventory = remote_migrations()
    require_sealed_baseline(current_inventory, baseline)
    require_production_baseline_guard(baseline, allow_initialize=False)
    current = [
        migration["version"]
        for migration in current_inventory
        if migration["version"] > baseline["cutoff_version"]
    ]
    expected = active_versions[: active_versions.index(version)]
    if current != expected:
        abort(
            "Production migration history changed during synchronization; automatic apply is blocked"
        )
    print(f"Applying migration {version}_{name}")
    migration_sql = path.read_text(encoding="utf-8")
    if re.search(r"(?im)^\s*(begin|commit|rollback)\s*;|create\s+index\s+concurrently", migration_sql):
        abort(
            f"Migration {version} cannot be wrapped in the required atomic transaction"
        )
    version_sql = version.replace("'", "''")
    name_sql = name.replace("'", "''")
    cutoff_sql = baseline["cutoff_version"].replace("'", "''")
    baseline_count = baseline["migration_count"]
    baseline_first = baseline["first_version"]
    baseline_last = baseline["last_version"]
    baseline_hash = baseline["ledger_sha256"]
    baseline_guard = f"stagepulse-migration-baseline:{baseline['_manifest_sha256']}"
    expected_sql = ",".join(f"'{item}'" for item in expected)
    query(
        "begin;\n"
        "select pg_advisory_xact_lock(hashtextextended("
        "'stagepulse-production-migration-ledger', 0));\n"
        "lock table supabase_migrations.schema_migrations in exclusive mode;\n"
        "do $migration_guard$\n"
        "declare\n"
        "  actual_active text[];\n"
        "  actual_historical_count integer;\n"
        "  actual_historical_first text;\n"
        "  actual_historical_last text;\n"
        "  actual_historical_hash text;\n"
        "  actual_baseline_guard text;\n"
        "begin\n"
        "  select coalesce(array_agg(version::text order by version), array[]::text[])\n"
        "    into actual_active\n"
        "    from supabase_migrations.schema_migrations\n"
        f"   where version > '{cutoff_sql}';\n"
        f"  if actual_active is distinct from array[{expected_sql}]::text[] then\n"
        "    raise exception 'post-cutoff migration history changed before atomic apply';\n"
        "  end if;\n"
        "  select count(*)::integer, min(version)::text, max(version)::text,\n"
        f"         {sql_ledger_fingerprint_expression()}\n"
        "    into actual_historical_count, actual_historical_first,\n"
        "         actual_historical_last, actual_historical_hash\n"
        "    from supabase_migrations.schema_migrations\n"
        f"   where version <= '{cutoff_sql}';\n"
        f"  if actual_historical_count <> {baseline_count}\n"
        f"     or actual_historical_first <> '{baseline_first}'\n"
        f"     or actual_historical_last <> '{baseline_last}'\n"
        f"     or actual_historical_hash <> '{baseline_hash}' then\n"
        "    raise exception 'sealed migration baseline changed before atomic apply';\n"
        "  end if;\n"
        "  select coalesce(obj_description("
        "'supabase_migrations.schema_migrations'::regclass),'')\n"
        "    into actual_baseline_guard;\n"
        f"  if actual_baseline_guard <> '{baseline_guard}' then\n"
        "    raise exception 'production migration baseline guard changed before atomic apply';\n"
        "  end if;\n"
        "  if exists (\n"
        "    select 1 from supabase_migrations.schema_migrations\n"
        f"     where version = '{version_sql}'\n"
        "  ) then\n"
        "    raise exception 'migration version already recorded before atomic apply';\n"
        "  end if;\n"
        "end\n"
        "$migration_guard$;\n"
        f"{migration_sql.rstrip()}\n"
        "insert into supabase_migrations.schema_migrations(version,name,statements)\n"
        f"values ('{version_sql}','{name_sql}',array[]::text[]);\n"
        "commit;",
        read_only=False,
    )
    recorded_inventory = remote_migrations()
    require_sealed_baseline(recorded_inventory, baseline)
    recorded = [
        migration["version"]
        for migration in recorded_inventory
        if migration["version"] > baseline["cutoff_version"]
    ]
    if recorded != expected + [version]:
        abort(
            f"Production ledger readback failed after applying {version}; further apply is blocked"
        )

verified_inventory = remote_migrations()
require_sealed_baseline(verified_inventory, baseline)
verified = [
    migration["version"]
    for migration in verified_inventory
    if migration["version"] > baseline["cutoff_version"]
]
if verified != active_versions:
    abort(
        f"Migration verification failed after apply: "
        f"active_local={len(active_versions)} active_remote={len(verified)}"
    )
total_verified = baseline["migration_count"] + len(verified)
print(f"Production migration ledger synchronized: {total_verified} migrations")
github_annotation(
    "notice",
    "Migration ledger synchronized",
    f"Production and repository share the sealed {baseline['migration_count']}-migration "
    f"baseline plus {len(verified)} active migrations",
)