#!/usr/bin/env python3
"""
Restore Gus main tenant Telegram service.

Root cause (2026-05-28): agent:main:main and the Telegram slash session carry
modelOverride=deepseek-v4-pro. That variant is not servable on this account
(runtime routes it through the openrouter provider, which has no API key), so
every message fails its first attempt and the agent lane jams.

Fix: revert the broken overrides to deepseek-v4-flash (the working primary).
Idempotent. Backs up before writing.
"""
import json
import shutil
import sys
import time

SESSIONS = "/home/tagai/.openclaw/agents/main/sessions/sessions.json"
GOOD = "deepseek-v4-flash"
BAD_TOKENS = ("deepseek-v4-pro", "openrouter")

# Session keys known to carry the bad override. We also scan all keys defensively.
TARGET_KEYS = [
    "agent:main:main",
    "agent:main:telegram:slash:8603473262",
]


def is_bad(val):
    return isinstance(val, str) and any(t in val for t in BAD_TOKENS)


def fix_node(node, path, changes):
    """Fix model/modelOverride fields one level deep inside a session entry."""
    if not isinstance(node, dict):
        return
    for field in ("model", "modelOverride"):
        if field in node and is_bad(node[field]):
            changes.append(f"{path}.{field}: {node[field]} -> {GOOD}")
            node[field] = GOOD
    spr = node.get("systemPromptReport")
    if isinstance(spr, dict) and is_bad(spr.get("model")):
        changes.append(f"{path}.systemPromptReport.model: {spr['model']} -> {GOOD}")
        spr["model"] = GOOD


def main():
    with open(SESSIONS) as f:
        data = json.load(f)

    changes = []

    # Targeted fix on the known-bad lanes.
    for key in TARGET_KEYS:
        if key in data:
            fix_node(data[key], key, changes)

    # Defensive sweep: catch any other session that picked up the bad override.
    for key, node in data.items():
        if key in TARGET_KEYS:
            continue
        fix_node(node, key, changes)

    if not changes:
        print("NO-OP: no bad model overrides found. Already clean.")
        return 0

    backup = f"{SESSIONS}.bak-modelfix-{time.strftime('%Y%m%d-%H%M%S')}"
    shutil.copy2(SESSIONS, backup)
    tmp = f"{SESSIONS}.tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    shutil.move(tmp, SESSIONS)

    print(f"BACKUP: {backup}")
    print(f"FIXED {len(changes)} field(s):")
    for c in changes:
        print(f"  - {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
