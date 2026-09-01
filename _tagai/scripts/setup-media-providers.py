#!/usr/bin/env python3
"""
Configure media generation across all tenants (images + video).

Grounded in live docs validated 2026-05-28:
  - Images primary: openai/gpt-image-2 (current model, best text/4K). Fallbacks:
    google/gemini-3.1-flash-image (GA), google/gemini-2.5-flash-image.
  - Video primary: google/veo-3.1-fast-generate-preview ($0.12/s 1080p).
    Fallback: google/veo-3.0-fast-generate-001 (stable).

Auth reality (the part earlier missed): OpenClaw media providers resolve the
Google key from GEMINI_API_KEY / GOOGLE_API_KEY env vars, sourced from
.openclaw-shared.env (mounted into every tenant) — NOT only auth-profiles.json.
The shared env still held the OLD expired Google key, and OPENAI_API_KEY was
absent. This syncs all env auth to the working keys so provider resolution can't
miss, regardless of env-vs-authprofile precedence.

Config shape validated against docs/tools/{image,video}-generation.md (v2026.4.25):
  agents.defaults.imageGenerationModel = { primary, fallbacks }
  agents.defaults.videoGenerationModel = { primary, fallbacks }
  Model refs: "<provider>/<model>".

Usage (on the VPS):  python3 setup-media-providers.py <NEW_GOOGLE_KEY>
Env changes require RECREATE (docker compose up -d), not restart.
"""
import json
import shutil
import sys
import time

SHARED_ENV = "/home/tagai/.openclaw-shared.env"
GUS_AUTH = "/home/tagai/.openclaw/agents/main/agent/auth-profiles.json"
CONFIGS = [
    "/home/tagai/.openclaw/openclaw.json",
    "/home/tagai/tenants/julian/.openclaw/openclaw.json",
]

IMAGE = {
    "primary": "openai/gpt-image-2",
    "fallbacks": ["google/gemini-3.1-flash-image", "google/gemini-2.5-flash-image"],
}
VIDEO = {
    "primary": "google/veo-3.1-fast-generate-preview",
    "fallbacks": ["google/veo-3.0-fast-generate-001"],
}


def stamp():
    return time.strftime("%Y%m%d-%H%M%S")


def read_openai_key():
    d = json.load(open(GUS_AUTH))
    keys = [p["key"] for p in d.get("profiles", {}).values() if p.get("provider") == "openai"]
    return keys[0] if keys else None


def update_env(new_google, openai_key):
    desired = {"GEMINI_API_KEY": new_google, "GOOGLE_API_KEY": new_google}
    if openai_key:
        desired["OPENAI_API_KEY"] = openai_key
    lines = open(SHARED_ENV).read().splitlines()
    seen = set()
    out = []
    for ln in lines:
        key = ln.split("=", 1)[0].strip() if "=" in ln and not ln.lstrip().startswith("#") else None
        if key in desired:
            out.append(f"{key}={desired[key]}")
            seen.add(key)
        else:
            out.append(ln)
    for k, v in desired.items():
        if k not in seen:
            out.append(f"{k}={v}")
    shutil.copy2(SHARED_ENV, f"{SHARED_ENV}.bak-media-{stamp()}")
    open(SHARED_ENV, "w").write("\n".join(out) + "\n")
    print(f"  env updated: {', '.join(f'{k}={v[:6]}...{v[-4:]}' for k, v in desired.items())}")


def update_config(path):
    try:
        d = json.load(open(path))
    except FileNotFoundError:
        print(f"  SKIP (not found): {path}")
        return
    defaults = d.setdefault("agents", {}).setdefault("defaults", {})
    defaults["imageGenerationModel"] = IMAGE
    defaults["videoGenerationModel"] = VIDEO
    shutil.copy2(path, f"{path}.bak-media-{stamp()}")
    tmp = f"{path}.tmp"
    json.dump(d, open(tmp, "w"), indent=2)
    shutil.move(tmp, path)
    print(f"  config set: {path}")


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith("AIza"):
        print("usage: python3 setup-media-providers.py <NEW_GOOGLE_KEY>")
        return 2
    new_google = sys.argv[1].strip()
    openai_key = read_openai_key()
    if not openai_key:
        print("WARNING: no OpenAI key found in auth-profiles; OPENAI_API_KEY not set.")

    print("== Syncing shared env auth ==")
    update_env(new_google, openai_key)
    print("== Setting media config on tenants ==")
    print(f"  image: {json.dumps(IMAGE)}")
    print(f"  video: {json.dumps(VIDEO)}")
    for p in CONFIGS:
        update_config(p)

    print("\nRECREATE (env change needs up -d, not restart):")
    print("  cd /home/tagai/openclaw && docker compose up -d")
    print("  cd /home/tagai/tenants/julian/openclaw && docker compose up -d")
    return 0


if __name__ == "__main__":
    sys.exit(main())
