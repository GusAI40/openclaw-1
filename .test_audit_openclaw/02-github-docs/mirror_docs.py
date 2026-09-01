"""Mirror github.com/openclaw/openclaw docs/ tree as raw markdown to disk."""
import os, json, urllib.request, sys, time

OUT_BASE = r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\02-github-docs\source"
os.makedirs(OUT_BASE, exist_ok=True)

# 1) Fetch full recursive tree (one API call)
TREE_URL = "https://api.github.com/repos/openclaw/openclaw/git/trees/main?recursive=1"
req = urllib.request.Request(TREE_URL, headers={"User-Agent": "openclaw-audit/1.0"})
with urllib.request.urlopen(req, timeout=30) as r:
    tree = json.load(r)

print(f"Total tree entries: {len(tree.get('tree', []))}")
print(f"Truncated: {tree.get('truncated', False)}")

# 2) Filter to docs/ paths
docs_entries = [e for e in tree["tree"] if e["path"].startswith("docs/") and e["type"] == "blob"]
print(f"Files under docs/: {len(docs_entries)}")

md_entries = [e for e in docs_entries if e["path"].endswith((".md", ".mdx"))]
config_entries = [e for e in docs_entries if e["path"].endswith((".json", ".yaml", ".yml", ".css", ".js"))]
print(f"  Markdown: {len(md_entries)}")
print(f"  Config/code: {len(config_entries)}")

manifest = {
    "tree_truncated": tree.get("truncated", False),
    "total_files": len(docs_entries),
    "markdown_files": [],
    "config_files": [],
    "skipped_binaries": [],
}

def fetch_raw(path):
    raw_url = f"https://raw.githubusercontent.com/openclaw/openclaw/main/{path}"
    req = urllib.request.Request(raw_url, headers={"User-Agent": "openclaw-audit/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def save(path_rel, content_bytes):
    # path_rel starts with "docs/", strip and remap under OUT_BASE
    rel = path_rel[len("docs/"):]
    full = os.path.join(OUT_BASE, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as f:
        f.write(content_bytes)
    return full

# 3) Mirror markdown
for i, e in enumerate(md_entries, 1):
    p = e["path"]
    try:
        b = fetch_raw(p)
        save(p, b)
        manifest["markdown_files"].append({"path": p, "size": e["size"]})
        if i % 25 == 0:
            print(f"  [{i}/{len(md_entries)}] {p}")
        time.sleep(0.05)  # gentle on raw.gh
    except Exception as ex:
        print(f"  FAILED {p}: {ex}", file=sys.stderr)

# 4) Mirror config/code (small, structural)
for e in config_entries:
    p = e["path"]
    if e["size"] > 200_000:  # skip huge bundles
        manifest["skipped_binaries"].append({"path": p, "size": e["size"], "reason": "too_large"})
        continue
    try:
        b = fetch_raw(p)
        save(p, b)
        manifest["config_files"].append({"path": p, "size": e["size"]})
        time.sleep(0.05)
    except Exception as ex:
        print(f"  FAILED {p}: {ex}", file=sys.stderr)

# 5) Save manifest
with open(os.path.join(OUT_BASE, "..", "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)

print()
print(f"Mirrored: {len(manifest['markdown_files'])} markdown + {len(manifest['config_files'])} config")
print(f"Manifest: {os.path.join(OUT_BASE, '..', 'manifest.json')}")
