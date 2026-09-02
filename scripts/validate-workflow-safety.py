#!/usr/bin/env python3
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

errors = []
known_action_commits = {
    "actions/checkout": {
        "11d5960a326750d5838078e36cf38b85af677262",
        "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09",
    },
    "actions/setup-node": {"49933ea5288caeca8642d1e84afbd3f7d6820020"},
    "actions/setup-java": {"cf277c60eb25467037889841efdb72551f06f6c3"},
    "android-actions/setup-android": {"9fc6c4e9069bf8d3d10b2204b1fb8f6ef7065407"},
    "gradle/actions/setup-gradle": {"ed408507eac070d1f99cc633dbcf757c94c7933a"},
    "denoland/setup-deno": {"22d081ff2d3a40755e97629de92e3bcbfa7cf2ed"},
    "actions/configure-pages": {"983d7736d9b0ae728b81ab479565c72886d7745b"},
    "actions/upload-pages-artifact": {"56afc609e74202658d3ffba0e8f6dda462b719fa"},
    "actions/deploy-pages": {"d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e"},
    "softprops/action-gh-release": {"3bb12739c298aeb8a4eeaf626c5b8d85266b0e65"},
}
for path in sorted(WORKFLOWS.glob("*.yml")):
    text = path.read_text(encoding="utf-8")
    for line_number, line in enumerate(text.splitlines(), 1):
        match = re.search(r"\buses:\s*([^@\s]+)@([^\s#]+)", line)
        if match and not re.fullmatch(r"[0-9a-f]{40}", match.group(2)):
            errors.append(
                f"{path.relative_to(ROOT)}:{line_number}: action {match.group(1)} is not pinned to a commit SHA"
            )
        elif match and match.group(2) not in known_action_commits.get(match.group(1), set()):
            errors.append(
                f"{path.relative_to(ROOT)}:{line_number}: action {match.group(1)} uses an unverified or mismatched commit"
            )

canonical = WORKFLOWS / "stagepulse-ci.yml"
if not canonical.exists():
    errors.append("Canonical Stagepulse CI workflow is missing")
else:
    ci = canonical.read_text(encoding="utf-8")
    if not re.search(r"apply_missing:\s*\n\s*description:.*\n\s*required:\s*true\s*\n\s*default:\s*false\b", ci):
        errors.append("Supabase migration apply must default to false in canonical CI")
    if "environment: production" not in ci:
        errors.append("Production Supabase operations must retain environment protection")
    if "Manual Supabase Migration Audit" not in ci:
        errors.append("Canonical CI must retain the migration audit gate")

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
