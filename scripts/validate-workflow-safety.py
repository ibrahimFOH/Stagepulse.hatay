#!/usr/bin/env python3
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

errors = []
for path in sorted(WORKFLOWS.glob("*.yml")):
    text = path.read_text(encoding="utf-8")
    for line_number, line in enumerate(text.splitlines(), 1):
        match = re.search(r"\buses:\s*([^@\s]+)@([^\s#]+)", line)
        if match and not re.fullmatch(r"[0-9a-f]{40}", match.group(2)):
            errors.append(
                f"{path.relative_to(ROOT)}:{line_number}: action {match.group(1)} is not pinned to a commit SHA"
            )

migration = (WORKFLOWS / "supabase-migration-audit.yml").read_text(encoding="utf-8")
if not re.search(r"apply_missing:.*?\n(?:.*\n){0,6}\s+default:\s+false\b", migration):
    errors.append("Supabase migration apply must default to false")
if "environment: production" not in migration:
    errors.append("Supabase migration apply must retain production environment protection")

release = (WORKFLOWS / "apk-release.yml").read_text(encoding="utf-8")
if not re.search(r"publish:.*?\n(?:.*\n){0,6}\s+default:\s+false\b", release):
    errors.append("Android publishing must default to false")
for step in (
    "Upload verified assets to a non-latest prerelease",
    "Publish verified manifest",
    "Sync verified release metadata and notifications",
    "Promote verified prerelease to latest release",
):
    pattern = rf"- name: {re.escape(step)}\n\s+if: \${{{{ inputs\.publish }}}}"
    if not re.search(pattern, release):
        errors.append(f"Android publishing step is not explicitly guarded: {step}")

if "draft: false" not in release or "prerelease: true" not in release:
    errors.append("Android assets must first be published as a non-latest prerelease")

ordered_steps = (
    "Upload verified assets to a non-latest prerelease",
    "Verify release downloads before publishing manifest",
    "Publish verified manifest",
    "Sync verified release metadata and notifications",
    "Promote verified prerelease to latest release",
)
positions = [release.find(f"- name: {step}") for step in ordered_steps]
if -1 in positions or positions != sorted(positions):
    errors.append("Android release must become latest only after manifest and production sync")

if errors:
    raise SystemExit("\n".join(errors))
print("Workflow action pins and destructive-operation defaults are safe")