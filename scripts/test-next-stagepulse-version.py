#!/usr/bin/env python3
"""Regression tests for Stagepulse semantic version and Android versionCode sequencing."""
from __future__ import annotations

import importlib.util
import pathlib

SCRIPT = pathlib.Path(__file__).with_name("next-stagepulse-version.py")
SPEC = importlib.util.spec_from_file_location("stagepulse_version", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise SystemExit("Could not load next-stagepulse-version.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

CASES = {
    "7.4.9": ("7.4.10", 7_004_010),
    "7.4.999": ("7.5.0", 7_005_000),
    "7.999.999": ("8.0.0", 8_000_000),
    "9.999.999": ("10.0.0", 10_000_000),
    "100.0.0": ("100.0.1", 100_000_001),
}

for current, expected in CASES.items():
    actual = MODULE.next_version(current)
    assert actual == expected, f"{current}: expected {expected}, got {actual}"
    parts = [int(part) for part in current.split(".")]
    current_code = parts[0] * 1_000_000 + parts[1] * 1_000 + parts[2]
    assert actual[1] > current_code, f"versionCode must increase for {current}"

for invalid in ("", "7.04.9", "7.1000.0", "7.4.1000", "v7.4.9", "-1.0.0"):
    try:
        MODULE.next_version(invalid)
    except ValueError:
        continue
    raise AssertionError(f"Expected invalid version to fail: {invalid}")

print(f"Stagepulse version sequence checks passed ({len(CASES)} valid cases plus invalid inputs).")
