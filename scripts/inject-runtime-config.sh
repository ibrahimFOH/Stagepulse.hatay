#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/shared/runtime-config.js"
: "${SUPABASE_URL:?}"
: "${SUPABASE_PUBLISHABLE_KEY:?}"
printf '%s\n' "runtime config generated for $OUT"
