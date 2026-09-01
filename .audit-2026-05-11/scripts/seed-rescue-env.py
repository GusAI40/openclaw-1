#!/usr/bin/env python3
"""
Seed /home/tagai/shared-projects/rescue-websites/.env from VPS-side sources.
- Reads RESEND_API_KEY, SUPABASE_URL from /home/tagai/openclaw/.env
- Reads FIRECRAWL_API_KEY, GEMINI_API_KEY from /home/tagai/.openclaw-shared.env
- Pulls SUPABASE_ACCESS_TOKEN from openclaw-openclaw-gateway-1 container env
- Calls Supabase Management API to retrieve the project's anon key
- Accepts GOOGLE_PLACES_API_KEY as argv[1]
- Writes .env with mode 600
- Applies website_rescue_*.sql schema via Mgmt API
- Reports last-6-char fingerprints only. No full secrets to stdout.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

PROJECT_REF = "bjhjqegqfieyekbffgij"
ENV_FILE = "/home/tagai/shared-projects/rescue-websites/.env"
SCHEMA_FILE = "/home/tagai/shared-projects/rescue-websites/src/lib/supabase-schema.sql"


def read_kv(path, key):
    try:
        with open(path) as f:
            for line in f:
                m = re.match(r"^\s*" + re.escape(key) + r"\s*=\s*(.+?)\s*$", line)
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return ""


def docker_env(container, key):
    r = subprocess.run(
        ["docker", "exec", container, "sh", "-c", f"echo ${key}"],
        capture_output=True, text=True
    )
    return r.stdout.strip()


def http_get(url, token):
    r = subprocess.run(
        ["curl", "-sS", "-f", "-H", f"Authorization: Bearer {token}", url],
        capture_output=True, text=True, timeout=20,
    )
    if r.returncode != 0:
        raise RuntimeError(f"curl GET {url} failed: {r.stderr.strip()}")
    return json.loads(r.stdout)


def http_post(url, token, body):
    r = subprocess.run(
        [
            "curl", "-sS", "-w", "\n__HTTP_CODE__%{http_code}", "-X", "POST", url,
            "-H", f"Authorization: Bearer {token}",
            "-H", "Content-Type: application/json",
            "--data", json.dumps(body),
        ],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0:
        raise RuntimeError(f"curl POST {url} failed: {r.stderr.strip()}")
    out = r.stdout
    code = 0
    body_text = out
    if "__HTTP_CODE__" in out:
        body_text, code_str = out.rsplit("__HTTP_CODE__", 1)
        try:
            code = int(code_str.strip())
        except ValueError:
            code = 0
    return code, body_text


def fp(s):
    return f"...{s[-6:]}" if s and len(s) >= 6 else "(empty)"


def main():
    if len(sys.argv) < 3:
        print("usage: seed-rescue-env.py <GOOGLE_PLACES_API_KEY> <FIRECRAWL_API_KEY> [--apply-schema]")
        sys.exit(2)
    places_key = sys.argv[1]
    firecrawl_override = sys.argv[2]
    apply_schema = "--apply-schema" in sys.argv

    print("=== Reading source keys ===")
    resend_key = read_kv("/home/tagai/openclaw/.env", "RESEND_API_KEY")
    supa_url = read_kv("/home/tagai/openclaw/.env", "SUPABASE_URL")
    firecrawl_key = firecrawl_override or read_kv("/home/tagai/.openclaw-shared.env", "FIRECRAWL_API_KEY")
    gemini_key = read_kv("/home/tagai/.openclaw-shared.env", "GEMINI_API_KEY")
    access_token = docker_env("openclaw-openclaw-gateway-1", "SUPABASE_ACCESS_TOKEN")

    missing = [n for n, v in [
        ("RESEND_API_KEY", resend_key),
        ("SUPABASE_URL", supa_url),
        ("FIRECRAWL_API_KEY", firecrawl_key),
        ("GEMINI_API_KEY", gemini_key),
        ("SUPABASE_ACCESS_TOKEN", access_token),
    ] if not v]
    if missing:
        print(f"MISSING SOURCE VALUES: {missing}", file=sys.stderr)
        sys.exit(3)

    print("=== Fetching anon key from Supabase Management API ===")
    keys = http_get(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/api-keys",
        access_token,
    )
    anon_key = next((k["api_key"] for k in keys if k.get("name") == "anon"), "")
    if not anon_key:
        print("Could not find anon key in mgmt API response", file=sys.stderr)
        sys.exit(4)

    print("=== Writing .env ===")
    lines = [
        "# /home/tagai/shared-projects/rescue-websites/.env",
        "# Seeded by .audit-2026-05-11/scripts/seed-rescue-env.py",
        "# DO NOT commit to git (also covered by repo's .gitignore).",
        "",
        "# Required",
        f"FIRECRAWL_API_KEY={firecrawl_key}",
        f"GOOGLE_PLACES_API_KEY={places_key}",
        f"RESEND_API_KEY={resend_key}",
        f"SUPABASE_URL={supa_url}",
        f"SUPABASE_ANON_KEY={anon_key}",
        "",
        "# Voice + AI",
        f"GEMINI_API_KEY={gemini_key}",
        "VOICE_PROXY_URL=wss://rescue-voice-proxy.jujusanchez413.workers.dev",
        "",
        "# Outreach identity",
        "RESEND_FROM=Julian Sanchez <julian@ubntag.com>",
        "CONTACT_EMAIL=julian@ubntag.com",
        "",
        "# Optional — Cloudflare Pages deploy (Step 5). Skip until ready.",
        "CLOUDFLARE_API_TOKEN=",
        "CLOUDFLARE_ACCOUNT_ID=",
        "REPORT_BASE_URL=https://rescue-websites.pages.dev",
        "",
        "# Optional — falls back to GOOGLE_PLACES_API_KEY if unset",
        "PAGESPEED_API_KEY=",
        "",
    ]
    with open(ENV_FILE, "w") as f:
        f.write("\n".join(lines))
    os.chmod(ENV_FILE, 0o600)

    print(f".env written: {len(lines)} lines, {os.path.getsize(ENV_FILE)} bytes, mode 600")
    print("Key fingerprints (last 6 chars):")
    print(f"  GOOGLE_PLACES_API_KEY  {fp(places_key)}")
    print(f"  RESEND_API_KEY         {fp(resend_key)}")
    print(f"  SUPABASE_URL           {supa_url}")
    print(f"  SUPABASE_ANON_KEY      {fp(anon_key)} (208 chars expected)")
    print(f"  FIRECRAWL_API_KEY      {fp(firecrawl_key)}")
    print(f"  GEMINI_API_KEY         {fp(gemini_key)}")

    if apply_schema:
        print("\n=== Applying schema via Mgmt API SQL endpoint ===")
        with open(SCHEMA_FILE) as f:
            sql = f.read()
        try:
            status, body = http_post(
                f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
                access_token,
                {"query": sql},
            )
            print(f"  HTTP {status}")
            print(f"  Response (first 400 chars): {body[:400]}")
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code}: {e.read().decode()[:400]}", file=sys.stderr)
            sys.exit(5)
    else:
        print("\n(schema NOT applied — pass --apply-schema to run it)")

    print("\nDone.")


if __name__ == "__main__":
    main()
