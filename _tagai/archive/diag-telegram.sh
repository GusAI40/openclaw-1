#!/bin/bash
echo "=== credentials / secrets / telegram dirs ==="
ls -la /home/tagai/.openclaw/credentials/ 2>&1 | head -20
echo "---"
ls -la /home/tagai/.openclaw/secrets/ 2>&1 | head -20
echo "---"
ls -la /home/tagai/.openclaw/telegram/ 2>&1 | head -20

echo
echo "=== files on host containing a telegram-shaped token ==="
grep -rliE '[0-9]{8,12}:[A-Za-z0-9_-]{30}' /home/tagai/.openclaw/ 2>/dev/null | head -20

echo
echo "=== last-good telegram block ==="
python3 <<'PY'
import json
c = json.load(open("/home/tagai/.openclaw/openclaw.json.last-good"))
print("channels.telegram:")
print(json.dumps(c.get("channels",{}).get("telegram"), indent=2))
print("plugins.entries.telegram:")
print(json.dumps(c.get("plugins",{}).get("entries",{}).get("telegram"), indent=2))
PY

echo
echo "=== current openclaw.json telegram block ==="
python3 <<'PY'
import json
c = json.load(open("/home/tagai/.openclaw/openclaw.json"))
print("channels.telegram:")
print(json.dumps(c.get("channels",{}).get("telegram"), indent=2))
print("plugins.entries.telegram:")
print(json.dumps(c.get("plugins",{}).get("entries",{}).get("telegram"), indent=2))
PY

echo
echo "=== broken-config (today's pre-fix) telegram block ==="
python3 <<'PY'
import json, glob, os
candidates = sorted(glob.glob("/home/tagai/.openclaw/openclaw.json.broken*") +
                    glob.glob("/home/tagai/.openclaw/openclaw.json.bak.20260506*"))
for f in candidates:
    try:
        c = json.load(open(f))
        print(f"--- {f} ---")
        print("channels.telegram:")
        print(json.dumps(c.get("channels",{}).get("telegram"), indent=2))
    except Exception as e:
        print(f"{f}: parse error {e}")
PY

echo
echo "=== docker env on gateway ==="
docker exec openclaw-openclaw-gateway-1 env | grep -iE 'telegram|grammy' | sed -E 's/=.+/=REDACTED/'

echo
echo "=== gateway telegram log (last 60min) ==="
docker logs --since 60m openclaw-openclaw-gateway-1 2>&1 | grep -iE 'telegram|grammy' | tail -30
