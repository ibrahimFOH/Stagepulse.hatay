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

    if minor == 9 and patch == 9:
        if major >= 9:
            major += 1
        else:
            major, minor, patch = major + 1, 0, 0
    elif patch == 9:
        minor += 1
    else:
        patch += 1

    name = f"{major}.{minor}.{patch}"
    return name, major * 1_000_000 + minor * 1_000 + patch


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