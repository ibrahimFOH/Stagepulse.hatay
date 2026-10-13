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

    # Stagepulse uses one decimal digit per MINOR and PATCH component.
    # Normalize older releases produced by the previous 0..999 patch scheme:
    # e.g. 7.4.16 -> 7.5.0, preserving a strictly increasing Android versionCode.
    if minor > 999 or patch > 999:
        raise ValueError("Legacy MINOR and PATCH components must not exceed 999")

    if minor > 9:
        major += 1
        minor = 0
        patch = 0
    elif patch > 9:
        if minor < 9:
            minor += 1
            patch = 0
        else:
            major += 1
            minor = 0
            patch = 0
    elif patch < 9:
        patch += 1
    elif minor < 9:
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