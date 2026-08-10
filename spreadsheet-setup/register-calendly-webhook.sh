#!/bin/bash
#
# Tells Calendly where to send bookings — run this once.
#
# It looks up your Calendly organization, then subscribes your Apps Script
# web app to the "invitee.created" event, so every new booking is POSTed to
# it and lands in the sheet.
#
# USAGE (all three values are yours to fill in):
#
#   CALENDLY_TOKEN='paste-token'  \
#   EXEC_URL='https://script.google.com/macros/s/AAAA.../exec' \
#   WEBHOOK_SECRET='the-same-secret-you-put-in-the-script' \
#   bash spreadsheet-setup/register-calendly-webhook.sh
#
#   CALENDLY_TOKEN — create at calendly.com/integrations/api_webhooks
#                    ("Personal access token"). Treat it like a password.
#   EXEC_URL       — the /exec URL from Deploy -> New deployment -> Web app
#   WEBHOOK_SECRET — must match WEBHOOK_SECRET in apps-script.js

set -euo pipefail

for var in CALENDLY_TOKEN EXEC_URL WEBHOOK_SECRET; do
  if [ -z "${!var:-}" ]; then
    echo "Missing $var — see the usage notes at the top of this file." >&2
    exit 1
  fi
done

api() { curl -sS -H "Authorization: Bearer $CALENDLY_TOKEN" "$@"; }

echo "1/3  Looking up your Calendly account..."
me=$(api https://api.calendly.com/users/me)
org=$(printf '%s' "$me" | python3 -c 'import json,sys; print(json.load(sys.stdin)["resource"]["current_organization"])' 2>/dev/null || true)

if [ -z "$org" ]; then
  echo "Could not read your organization. Calendly said:" >&2
  printf '%s\n' "$me" >&2
  echo >&2
  echo "A 401 means the token is wrong or expired." >&2
  exit 1
fi
echo "     organization: $org"

echo "2/3  Subscribing your script to new bookings..."
response=$(api -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Content-Type: application/json" \
  -d "{
        \"url\": \"${EXEC_URL}?token=${WEBHOOK_SECRET}\",
        \"events\": [\"invitee.created\"],
        \"organization\": \"${org}\",
        \"scope\": \"organization\"
      }")

if printf '%s' "$response" | grep -q '"uri"'; then
  echo "     subscribed."
else
  echo "Calendly rejected the subscription:" >&2
  printf '%s\n' "$response" >&2
  echo >&2
  echo "A 403 usually means webhooks are not included in your Calendly plan." >&2
  echo "In that case use Zapier instead: Calendly (Invitee Created) -> Google Sheets (Create Row)." >&2
  exit 1
fi

echo "3/3  Current subscriptions:"
api "https://api.calendly.com/webhook_subscriptions?organization=${org}&scope=organization" \
  | python3 -c '
import json, sys
for hook in json.load(sys.stdin).get("collection", []):
    print("     ", hook["state"], hook["callback_url"].split("?")[0], hook["events"])
'

echo
echo "Done. Book a test slot on your own Calendly link — a row should appear"
echo "in the \"business web app\" tab within a few seconds."
