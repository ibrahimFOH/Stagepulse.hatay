#!/usr/bin/env python3
import pathlib
import re
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: validate-migration-list.py MIGRATION_LIST_OUTPUT")

text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
drift = []
for line in text.splitlines():
    if "|" not in line:
        continue
    cells = [cell.strip() for cell in line.split("|")]
    if len(cells) < 2:
        continue
    local = cells[0] if re.fullmatch(r"\d{14}", cells[0]) else ""
    remote = cells[1] if re.fullmatch(r"\d{14}", cells[1]) else ""
    if (local or remote) and local != remote:
        drift.append((local or "missing", remote or "missing"))

if drift:
    print("Production migration history drift detected; database push remains blocked.")
    for local, remote in drift[:100]:
        print(f"local={local} remote={remote}")
    if len(drift) > 100:
        print(f"... {len(drift) - 100} more")
    raise SystemExit(1)
print("Local and production migration versions match.")