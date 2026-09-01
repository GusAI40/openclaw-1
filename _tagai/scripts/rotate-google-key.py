#!/usr/bin/env python3
"""
Rotate the Google AI (Gemini) API key across all tenants.

Both tenants (Gus main + Julian) carry the SAME google key in their own
auth-profiles.json. The old key (AIzaSy...5Nmg) expired 2026-05-28, killing
image generation (gemini-3.1-flash-image-preview). The shared-env GEMINI/GOOGLE
vars are empty, so auth-profiles.json is the source of truth.

Usage (run ON the VPS):
    python3 rotate-google-key.py <NEW_GOOGLE_AI_KEY>

Then restart both gateways (the script prints the exact commands).
Idempotent-ish: it swaps whatever google key it finds, backs up first.
"""
import json
import shutil
import sys
import time

PROFILES = [
    "/home/tagai/.openclaw/agents/main/agent/auth-profiles.json",
    "/home/tagai/tenants/julian/.openclaw/agents/main/agent/auth-profiles.json",
]


def mask(k):
    return (k[:6] + "..." + k[-4:]) if len(k) > 12 else "(short)"


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith("AIza"):
        print("usage: python3 rotate-google-key.py <NEW_GOOGLE_AI_KEY>")
        print("  (a Google AI Studio key starts with 'AIza')")
        return 2
    new_key = sys.argv[1].strip()

    changed = 0
    for path in PROFILES:
        try:
            d = json.load(open(path))
        except FileNotFoundError:
            print(f"SKIP (not found): {path}")
            continue
        hit = False
        for name, prof in d.get("profiles", {}).items():
            if prof.get("provider") == "google" and prof.get("key") != new_key:
                print(f"  {path} :: {name}: {mask(prof.get('key',''))} -> {mask(new_key)}")
                prof["key"] = new_key
                hit = True
        if hit:
            shutil.copy2(path, f"{path}.bak-gkey-{time.strftime('%Y%m%d-%H%M%S')}")
            tmp = f"{path}.tmp"
            json.dump(d, open(tmp, "w"), indent=2)
            shutil.move(tmp, path)
            changed += 1
        else:
            print(f"  {path}: no google profile changed (already new?)")

    if changed:
        print(f"\nUPDATED {changed} file(s). Now restart both gateways:")
        print("  cd /home/tagai/openclaw && docker compose restart openclaw-gateway")
        print("  cd /home/tagai/tenants/julian/openclaw && docker compose restart")
        print("\nThen verify the key is live:")
        print('  curl -s -o /dev/null -w "HTTP %{http_code}\\n" '
              '"https://generativelanguage.googleapis.com/v1beta/models?key=' + new_key + '"')
    else:
        print("\nNO-OP: nothing changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
