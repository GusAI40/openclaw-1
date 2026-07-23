#!/bin/bash
sleep 50
echo "=== gateway ==="
docker inspect openclaw-openclaw-gateway-1 --format 'Status={{.State.Status}} Health={{.State.Health.Status}} Started={{.State.StartedAt}}'

echo
echo "=== telegram + ready log lines since restart ==="
docker logs --since 120s openclaw-openclaw-gateway-1 2>&1 | grep -iE 'telegram|grammy|gateway.*ready|provider' | tail -25

echo
echo "=== pending updates from Telegram side ==="
T=$(docker exec openclaw-openclaw-gateway-1 printenv TELEGRAM_BOT_TOKEN)
curl -sS --max-time 8 "https://api.telegram.org/bot${T}/getWebhookInfo" | python3 -c 'import sys,json; d=json.load(sys.stdin)["result"]; print("pending_count=", d["pending_update_count"], " webhook_url=", repr(d["url"]))'
