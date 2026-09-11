#!/usr/bin/env python3
"""Daily production guardian for Stagepulse public and protected endpoints."""
from __future__ import annotations

import sys
import urllib.error
import urllib.request

BASE = 'https://stagepulse.com.tr'
PATHS = ('/', '/teklif.html', '/admin/', '/portal/', '/latest.json', '/firebase-messaging-sw.js', '/portal/fcm-config.js', '/robots.txt', '/sitemap.xml')
PROTECTED = ('/admin/', '/portal/')


def check(path: str) -> None:
    request = urllib.request.Request(BASE + path, headers={'User-Agent': 'Stagepulse-Production-Guardian/1.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        allowed = 200 <= response.status < 400 or (path in PROTECTED and response.status in (401, 403))
        if not allowed:
            raise RuntimeError(f'{path} -> HTTP {response.status}')
        print(f'{path} -> HTTP {response.status}')


def main() -> int:
    try:
        for path in PATHS:
            check(path)
    except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
        print(f'Production guardian failed: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
