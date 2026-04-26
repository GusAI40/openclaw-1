#!/usr/bin/env bash
# Maya human-call simulator — exercises the live tool and webhook endpoints
# the same way VAPI does, so we can verify the conversation flow without
# actually picking up a phone.
#
# Runs on tagai-cloud. Sources /home/tagai/.tagai-env for the HMAC secret
# and posts to the local listener at 127.0.0.1:18792.

set -euo pipefail

ENV_FILE="/home/tagai/.tagai-env"
ENDPOINT="http://127.0.0.1:18792"
TOOL_URL="$ENDPOINT/vapi/tool"
WH_URL="$ENDPOINT/vapi/webhook"
SECRET="$(grep '^VAPI_WEBHOOK_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
ASSISTANT_ID="701efa30-304b-4ddd-b6ec-a4818770389d"

if [[ -z "$SECRET" ]]; then
  echo "FATAL: VAPI_WEBHOOK_SECRET missing from $ENV_FILE" >&2
  exit 1
fi

sign() {
  # stdin = body, stdout = hex sha256 hmac
  openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $NF}'
}

post() {
  local url="$1" body="$2" label="$3"
  local sig
  sig="$(printf '%s' "$body" | sign)"
  echo
  echo "===== $label ====="
  echo "URL: $url"
  echo "Body: $body"
  local resp http_code
  resp="$(curl -sS -o /tmp/maya_resp.txt -w '%{http_code}' \
    -X POST "$url" \
    -H 'Content-Type: application/json' \
    -H "x-vapi-signature: sha256=$sig" \
    --data-binary "$body" || echo CURL_FAIL)"
  http_code="$resp"
  echo "HTTP: $http_code"
  echo "Response: $(cat /tmp/maya_resp.txt)"
}

# Caller context — pretend the same buyer "Sarah Mitchell" is on the line
CALL_ID="sim-$(date +%s)-$$"
CALLER_PHONE="+12145559421"
CALLER_NAME="Sarah Mitchell"

# ---- Scenario 1: clean lookup, Lantana TX ------------------------------
B1=$(cat <<JSON
{"message":{"type":"tool-calls","call":{"id":"$CALL_ID","assistantId":"$ASSISTANT_ID"},"toolCallList":[{"id":"call_001","function":{"name":"lookup_listing","arguments":{"query":"Kingbird Lane Lantana"}}}]}}
JSON
)
post "$TOOL_URL" "$B1" "1. Clean lookup — Kingbird Lane Lantana"

# ---- Scenario 2: ambiguous "Giles Texas" -------------------------------
B2=$(cat <<JSON
{"message":{"type":"tool-calls","call":{"id":"$CALL_ID","assistantId":"$ASSISTANT_ID"},"toolCallList":[{"id":"call_002","function":{"name":"lookup_listing","arguments":{"query":"Giles Texas"}}}]}}
JSON
)
post "$TOOL_URL" "$B2" "2. Ambiguous — Giles Texas (the bug we just fixed)"

# ---- Scenario 3: genuine empty result ----------------------------------
B3=$(cat <<JSON
{"message":{"type":"tool-calls","call":{"id":"$CALL_ID","assistantId":"$ASSISTANT_ID"},"toolCallList":[{"id":"call_003","function":{"name":"lookup_listing","arguments":{"query":"9999 Atlantis Boulevard, Mars TX"}}}]}}
JSON
)
post "$TOOL_URL" "$B3" "3. Empty result — 9999 Atlantis Blvd Mars TX (should be found:false, no error)"

# ---- Scenario 4: notify_michelle escalation ----------------------------
B4=$(cat <<JSON
{"message":{"type":"tool-calls","call":{"id":"$CALL_ID","assistantId":"$ASSISTANT_ID"},"toolCallList":[{"id":"call_004","function":{"name":"notify_michelle","arguments":{"caller_name":"$CALLER_NAME","caller_phone":"$CALLER_PHONE","property":"5208 Kingbird Ln, Lantana TX","reason":"Wants to schedule a tour this weekend, asked specifically for Michelle"}}}]}}
JSON
)
post "$TOOL_URL" "$B4" "4. Escalation — notify_michelle Telegram alert"

# ---- Scenario 5: bad signature (security check) ------------------------
echo
echo "===== 5. Security check — bad HMAC signature ====="
BAD=$(curl -sS -o /tmp/maya_resp.txt -w '%{http_code}' \
  -X POST "$TOOL_URL" \
  -H 'Content-Type: application/json' \
  -H "x-vapi-signature: sha256=deadbeef" \
  --data-binary "$B1" || echo CURL_FAIL)
echo "HTTP: $BAD (expect 401)"
echo "Response: $(cat /tmp/maya_resp.txt)"

# ---- Scenario 6: end-of-call-report -> Supabase + Telegram digest -----
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START="$(date -u -d '-3 minutes' +%Y-%m-%dT%H:%M:%SZ)"
TX='User: Hi, this is Sarah, I saw a listing on Kingbird Lane in Lantana?\nAssistant: Hi Sarah, sure, let me pull that up for you. (looks up) I have a 4 bedroom on Kingbird Lane listed at $625,000, 2,847 square feet, built 2018. Want me to have Michelle reach out to schedule a tour?\nUser: Yes please, this weekend if possible.\nAssistant: Perfect, I have your number as 214-555-9421, I will let Michelle know right now.'
SUMMARY="Sarah Mitchell called about Kingbird Lane in Lantana. Maya pulled the listing details and confirmed the house. Caller wants a weekend tour. Michelle has been alerted via Telegram."

B6=$(cat <<JSON
{"message":{"type":"end-of-call-report","call":{"id":"$CALL_ID","assistantId":"$ASSISTANT_ID","startedAt":"$START","endedAt":"$NOW","customer":{"number":"$CALLER_PHONE","name":"$CALLER_NAME"}},"endedReason":"customer-ended-call","cost":0.0421,"summary":"$SUMMARY","transcript":"$TX"}}
JSON
)
post "$WH_URL" "$B6" "6. End-of-call report — Supabase row + Telegram digest"

echo
echo "===== Sim complete. Call ID: $CALL_ID ====="
