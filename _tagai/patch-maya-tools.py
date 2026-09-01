#!/usr/bin/env python3
import json, os, sys, urllib.request

API = "https://api.vapi.ai/assistant/701efa30-304b-4ddd-b6ec-a4818770389d"
KEY = os.environ["VAPI_PRIVATE_KEY"]
SERVER = {"url": "https://openclaw.ubntag.com/vapi/tool", "timeoutSeconds": 20}

def http(method, url, body=None):
    headers = {
        "Authorization": f"Bearer {KEY}",
        "User-Agent": "curl/8.5.0",
        "Accept": "*/*",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} on {method} {url}", file=sys.stderr)
        print(e.read().decode("utf-8", "replace")[:500], file=sys.stderr)
        raise

cur = http("GET", API)
model = cur.get("model") or {}
tools = list(model.get("tools") or [])
existing = {t.get("function", {}).get("name") for t in tools}
print("existing tools:", existing)

new_tools = []

if "request_showing" not in existing:
    new_tools.append({
        "type": "function",
        "server": SERVER,
        "function": {
            "name": "request_showing",
            "description": "Tentatively schedule an in-person showing for a specific property. Captures the buyer's preferred day and time, fires an instant Telegram alert to Michelle with confirm/decline buttons, and writes the request to Supabase. Use ONLY after the buyer asks to see a specific home and you have their name, phone, and a day/time. The booking is tentative until Michelle taps confirm.",
            "parameters": {
                "type": "object",
                "required": ["property_address", "caller_phone", "requested_date_time"],
                "properties": {
                    "property_address": {"type": "string", "description": "Full street address of the property the buyer wants to tour."},
                    "caller_name": {"type": "string", "description": "Caller's first and last name if given."},
                    "caller_phone": {"type": "string", "description": "Best callback number, E.164 if possible."},
                    "requested_date_time": {"type": "string", "description": "Day and time the buyer asked for, in their own words. Examples: 'tomorrow at 5pm', 'Saturday morning', 'Friday at 2'."},
                    "mls_number": {"type": "string", "description": "MLS id if known from a prior lookup_listing result."},
                    "listing_id": {"type": "string", "description": "Internal listing id if known."},
                    "notes": {"type": "string", "description": "Anything Michelle should know before confirming. Buyer's must-haves, kids, dogs, financing status, etc."}
                }
            }
        },
        "messages": [
            {"type": "request-start", "content": "Let me pencil that in for you."}
        ]
    })

if "comp_analysis" not in existing:
    new_tools.append({
        "type": "function",
        "server": SERVER,
        "function": {
            "name": "comp_analysis",
            "description": "Pull a quick comparable-market summary for an area: active listings and the last 12 months of closed sales, with median and average price, price per square foot, and days on market. Returns 3 most recent closed comps. Use when a seller asks what their home is worth or a buyer asks what's typical for an area. Never quote it as a formal CMA, only as a directional snapshot.",
            "parameters": {
                "type": "object",
                "required": ["area"],
                "properties": {
                    "area": {"type": "string", "description": "City name like 'Argyle' or 5-digit ZIP code like '76226'. Strip Texas/TX before passing."},
                    "beds": {"type": "number", "description": "Minimum bedrooms to filter on."},
                    "baths_min": {"type": "number", "description": "Minimum bathrooms."},
                    "sqft_min": {"type": "number", "description": "Minimum square footage."},
                    "sqft_max": {"type": "number", "description": "Maximum square footage."},
                    "year_built_min": {"type": "number", "description": "Earliest year built to include."}
                }
            }
        },
        "messages": [
            {"type": "request-start", "content": "Let me grab a quick market snapshot."}
        ]
    })

if not new_tools:
    print("nothing to add, both tools already present")
    sys.exit(0)

tools.extend(new_tools)

msgs = list(model.get("messages") or [])
sys_idx = next((i for i, m in enumerate(msgs) if m.get("role") == "system"), None)
APPENDIX = (
    "\n\n13. request_showing: ONLY when buyer asks to tour a specific home. "
    "Confirm property address, get name + callback number, and ask for a day and time in their own words. "
    "Pass it through verbatim. Tell them Michelle will text within 30 minutes to lock in the exact time.\n"
    "14. comp_analysis: ONLY when caller explicitly asks what homes sell for in an area or what their place is worth. "
    "Pass area as a city name or ZIP, no Texas suffix. Quote the result as a quick directional snapshot, not a formal CMA, and offer to have Michelle prepare a real CMA."
)
if sys_idx is not None:
    sp = msgs[sys_idx].get("content", "")
    if "request_showing: ONLY when buyer asks to tour" not in sp:
        msgs[sys_idx]["content"] = sp + APPENDIX
        print("appended system prompt instructions")
    else:
        print("system prompt already has new instructions")

patch_body = {"model": {**model, "tools": tools, "messages": msgs}}
res = http("PATCH", API, patch_body)
out_tools = [t.get("function", {}).get("name") for t in res.get("model", {}).get("tools", [])]
print("after patch tools:", out_tools)
print("isServerUrlSecretSet:", res.get("isServerUrlSecretSet"))
