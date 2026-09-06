#!/usr/bin/env python3
"""Weekly autonomous repository health checks."""
from __future__ import annotations

import subprocess


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> int:
    run(['python3', 'scripts/validate-canonical-layout.py'])
    run(['python3', 'scripts/validate-update-manifests.py'])
    run(['python3', 'scripts/production_guardian.py'])
    print('Weekly autonomous health: all checks passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
