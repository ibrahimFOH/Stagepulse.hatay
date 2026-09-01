#!/usr/bin/env bash
# Optional: regenerate shared/runtime-config.js from environment (CI secrets).
# Public client values only — never inject service_role here.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/shared/runtime-config.js"
: "${SUPABASE_URL:?}"
: "${SUPABASE_PUBLISHABLE_KEY:?}"
python3 - <<'PY'
import json, os, pathlib
out = pathlib.Path(os.environ["OUT"] if "OUT" in os.environ else pathlib.Path.cwd() / "shared/runtime-config.js")
# OUT passed via env below
PY
OUT_PATH="$OUT" \
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_PUBLISHABLE_KEY="$SUPABASE_PUBLISHABLE_KEY" \
FIREBASE_API_KEY="${FIREBASE_API_KEY:-}" \
FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN:-}" \
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-}" \
FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-}" \
FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID:-}" \
FIREBASE_APP_ID="${FIREBASE_APP_ID:-}" \
FIREBASE_MEASUREMENT_ID="${FIREBASE_MEASUREMENT_ID:-}" \
FIREBASE_VAPID_KEY="${FIREBASE_VAPID_KEY:-}" \
python3 - <<'PY'
import json, os, pathlib
def j(k, default=""):
    return json.dumps(os.environ.get(k, default))
out = pathlib.Path(os.environ["OUT_PATH"])
js = f"""(function (global) {{
  'use strict';
  var runtime = Object.freeze({{
    supabaseUrl: {j('SUPABASE_URL')},
    supabasePublishableKey: {j('SUPABASE_PUBLISHABLE_KEY')},
    siteAiUrl: null,
    fcm: Object.freeze({{
      apiKey: {j('FIREBASE_API_KEY')},
      authDomain: {j('FIREBASE_AUTH_DOMAIN')},
      projectId: {j('FIREBASE_PROJECT_ID')},
      storageBucket: {j('FIREBASE_STORAGE_BUCKET')},
      messagingSenderId: {j('FIREBASE_MESSAGING_SENDER_ID')},
      appId: {j('FIREBASE_APP_ID')},
      measurementId: {j('FIREBASE_MEASUREMENT_ID')},
      vapidKey: {j('FIREBASE_VAPID_KEY')}
    }})
  }});
  global.STAGEPULSE_RUNTIME = runtime;
  global.STAGEPULSE_FCM_CONFIG = Object.freeze(Object.assign({{}}, runtime.fcm));
}})(typeof globalThis !== 'undefined' ? globalThis : window);
"""
out.write_text(js, encoding="utf-8")
print("Wrote", out)
PY
