#!/bin/bash
# Pull token from gateway env, validate against Telegram API, never echo the token itself.

TOKEN=$(docker exec openclaw-openclaw-gateway-1 printenv TELEGRAM_BOT_TOKEN 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "TELEGRAM_BOT_TOKEN env var is empty on gateway"
  exit 1
fi
LEN=${#TOKEN}
ID="${TOKEN%%:*}"
echo "Token present: bot_id=$ID  total_len=$LEN"

echo
echo "=== getMe (does Telegram accept this token?) ==="
curl -sS --max-time 10 "https://api.telegram.org/bot${TOKEN}/getMe" | python3 -m json.tool 2>&1 | head -20

echo
echo "=== getWebhookInfo (is a webhook set, blocking polling?) ==="
curl -sS --max-time 10 "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | python3 -m json.tool 2>&1 | head -30

echo
echo "=== getUpdates (does anyone need to send messages? non-blocking) ==="
curl -sS --max-time 5 "https://api.telegram.org/bot${TOKEN}/getUpdates?limit=1&timeout=0" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok=',d.get('ok'),' result_count=',len(d.get('result',[])),' description=',d.get('description'))"

echo
echo "=== last 5 lines of gateway log mentioning telegram or grammy (any time) ==="
docker logs openclaw-openclaw-gateway-1 2>&1 | grep -iE 'telegram|grammy|@grammy' | tail -10

echo
echo "=== current update-offset state ==="
cat /home/tagai/.openclaw/telegram/update-offset-default.json 2>/dev/null
echo
echo "=== gateway uptime ==="
docker inspect openclaw-openclaw-gateway-1 --format 'StartedAt={{.State.StartedAt}} Status={{.State.Status}} Health={{.State.Health.Status}}'
