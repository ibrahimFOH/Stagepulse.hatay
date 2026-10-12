#!/usr/bin/env python3
"""Calculate Stagepulse's production version and monotonic Android versionCode."""

from __future__ import annotations

import re
import sys


def next_version(current: str) -> tuple[str, int]:
    match = re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", current.strip())
    if not match:
        raise ValueError("version must be MAJOR.MINOR.PATCH")
    major, minor, patch = map(int, match.groups())

    # The versionCode layout reserves three decimal digits each for minor and patch.
    if minor > 999 or patch > 999:
        raise ValueError("MINOR and PATCH components must be between 0 and 999")

    if patch < 999:
        patch += 1
    elif minor < 999:
        minor += 1
        patch = 0
    else:
        major += 1
        minor = 0
        patch = 0

    name = f"{major}.{minor}.{patch}"
    code = major * 1_000_000 + minor * 1_000 + patch
    if code > 2_147_483_647:
        raise ValueError("next versionCode exceeds Android's integer limit")
    return name, code


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: next-stagepulse-version.py MAJOR.MINOR.PATCH")
    try:
        name, code = next_version(sys.argv[1])
    except ValueError as error:
        raise SystemExit(str(error)) from error
    print(name)
    print(code)


if __name__ == "__main__":
    main()