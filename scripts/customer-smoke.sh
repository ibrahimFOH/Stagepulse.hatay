#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-https://stagepulse.com.tr}"
UA="Stagepulse-Guardian/1.0"

check_url() {
  local path="$1" status
  status="$(curl -sS -L --connect-timeout 10 --max-time 30 -A "$UA" -o /tmp/stagepulse-customer-body -w '%{http_code}' "$DOMAIN$path" || true)"
  echo "$path -> HTTP $status"
  case "$status" in
    2??|3??) ;;
    *) echo "::error::Customer route $path failed with HTTP $status"; return 1 ;;
  esac
}

for path in / /hizmetler.html /muhendislik.html /galeri.html /referanslar.html /teklif.html; do
  check_url "$path"
done

home="$(curl -sS -L --connect-timeout 10 --max-time 30 -A "$UA" "$DOMAIN/" )"
offer="$(curl -sS -L --connect-timeout 10 --max-time 30 -A "$UA" "$DOMAIN/teklif.html")"

printf '%s' "$home" | grep -qi 'Stagepulse' || { echo '::error::Customer homepage branding missing'; exit 1; }
printf '%s' "$home" | grep -q 'teklif.html' || { echo '::error::Customer homepage offer route missing'; exit 1; }
printf '%s' "$home" | grep -q 'wa.me/905320683012' || { echo '::error::Customer WhatsApp CTA missing'; exit 1; }
printf '%s' "$offer" | grep -q 'id="offerForm"' || { echo '::error::Customer offer form missing'; exit 1; }
printf '%s' "$offer" | grep -q 'name="email"' || { echo '::error::Customer offer email field missing'; exit 1; }
printf '%s' "$offer" | grep -q 'name="phone"' || { echo '::error::Customer offer phone field missing'; exit 1; }
printf '%s' "$offer" | grep -q 'name="event_type"' || { echo '::error::Customer event type field missing'; exit 1; }

echo 'Customer-facing route and conversion smoke checks passed.'
