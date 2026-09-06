#!/usr/bin/env python3
"""Stagepulse Self-Healing Agent.

Guarded automatic repair engine for CI failures. Only explicitly allow-listed,
low-risk repairs are applied, followed by the full JavaScript syntax gate.
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def syntax_files() -> list[Path]:
    files = []
    for path in sorted(Path('.').rglob('*.js')):
        if any(part in {'.git', 'node_modules', 'supabase'} for part in path.parts):
            continue
        files.append(path)
    for extra in (Path('sw.js'), Path('portal/app-update.js')):
        if extra.exists() and extra not in files:
            files.append(extra)
    return files


def validate_syntax() -> None:
    for path in syntax_files():
        run(['node', '--check', str(path)])


def repair_known_site_ai() -> bool:
    path = Path('site-ai.js')
    if not path.exists():
        return False
    text = path.read_text(encoding='utf-8')
    old = "WhatsApp'a gider"
    new = 'WhatsApp&#39;a gider'
    if old not in text:
        return False
    path.write_text(text.replace(old, new), encoding='utf-8')
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--log', default='', help='Failed workflow log to inspect')
    args = parser.parse_args()
    log = Path(args.log).read_text(encoding='utf-8', errors='ignore') if args.log else ''

    if not ('site-ai.js' in log and "SyntaxError: Unexpected identifier 'a'" in log):
        print('Stagepulse Self-Healing Agent: no safe allow-listed repair matched.')
        return 0
    if not repair_known_site_ai():
        print('Stagepulse Self-Healing Agent: expected repair target not present.')
        return 0

    validate_syntax()
    print('Stagepulse Self-Healing Agent: repair applied and full JS syntax gate passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
