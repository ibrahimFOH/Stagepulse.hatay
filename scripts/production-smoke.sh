#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://stagepulse.com.tr}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fetch() {
  local path="$1"
  local expected="$2"
  local out="$TMP/$(echo "$path" | tr '/?' '__')"

  curl --fail --silent --show-error --location --max-time 20 \
    -H 'Cache-Control: no-cache' \
    "$BASE_URL$path" -o "$out"
  test -s "$out"
  grep -Fq "$expected" "$out"
  echo "PASS $path"
}

fetch "/" "STAGEPULSE"
fetch "/hizmetler.html" "Hizmetler"
fetch "/muhendislik.html" "Mühendislik"
fetch "/galeri.html" "Galeri"
fetch "/dokumanlar.html" "Dokümanlar"
fetch "/teklif.html" "Teklif"
fetch "/robots.txt" "Sitemap"
fetch "/sitemap.xml" "stagepulse.com.tr"
fetch "/manifest.webmanifest" "start_url"
fetch "/admin/" "STAGEPULSE YÖNETİM"

admin_headers="$(curl --fail --silent --show-error --location --max-time 20 -I "$BASE_URL/admin/")"
grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' <<< "$admin_headers"
grep -Eiq '^referrer-policy:' <<< "$admin_headers"

echo "Production public smoke checks passed for $BASE_URL"
