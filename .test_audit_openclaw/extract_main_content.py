"""Extract main article/page content from saved HTML files.
Uses BeautifulSoup if available, falls back to a regex stripper.
Saves cleaned markdown-ish text alongside each .html as a .md."""
import os, re, sys, html, json

HTML_FILES = [
    (r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\03-substack-101\article.html",
     r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\03-substack-101\article.md",
     "substack-101"),
    (r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\04-virustotal-partnership\post.html",
     r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\04-virustotal-partnership\post.md",
     "virustotal-partnership"),
    (r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\04-virustotal-partnership\homepage.html",
     r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\04-virustotal-partnership\homepage.md",
     "openclaw-homepage"),
    (r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\04-virustotal-partnership\blog-index.html",
     r"C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw\04-virustotal-partnership\blog-index.md",
     "openclaw-blog-index"),
]

try:
    from bs4 import BeautifulSoup
    HAVE_BS4 = True
except ImportError:
    HAVE_BS4 = False

def to_text_bs4(html_str):
    soup = BeautifulSoup(html_str, "html.parser")
    # drop noise
    for tag in soup(["script", "style", "noscript", "iframe", "svg", "form", "nav", "footer"]):
        tag.decompose()
    # try article/main first
    main = soup.find("article") or soup.find("main") or soup.find(attrs={"class": re.compile(r"(content|post|article|body)", re.I)}) or soup.body or soup
    out = []
    title_tag = soup.find("title")
    if title_tag:
        out.append(f"# {title_tag.get_text(strip=True)}\n")
    h1 = soup.find("h1")
    if h1 and (not title_tag or h1.get_text(strip=True) != title_tag.get_text(strip=True)):
        out.append(f"# {h1.get_text(strip=True)}\n")
    # collect headings + paragraphs in document order under main
    for el in main.find_all(["h1","h2","h3","h4","h5","h6","p","li","blockquote","pre","code"]):
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        name = el.name
        if name.startswith("h"):
            level = int(name[1])
            out.append(f"\n{'#'*level} {text}")
        elif name == "li":
            out.append(f"- {text}")
        elif name == "blockquote":
            out.append(f"> {text}")
        elif name == "pre" or name == "code":
            out.append(f"```\n{text}\n```")
        else:
            out.append(text)
    # also collect link list (URL inventory)
    out.append("\n\n## All links on page\n")
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue
        if href in seen: continue
        seen.add(href)
        text = a.get_text(" ", strip=True)[:120]
        out.append(f"- [{text or '(no text)'}]({href})")
    return "\n".join(out)

def to_text_regex(html_str):
    s = html_str
    # remove scripts/styles
    s = re.sub(r"<script[^>]*>.*?</script>", "", s, flags=re.S|re.I)
    s = re.sub(r"<style[^>]*>.*?</style>", "", s, flags=re.S|re.I)
    s = re.sub(r"<noscript[^>]*>.*?</noscript>", "", s, flags=re.S|re.I)
    # title
    title_m = re.search(r"<title[^>]*>(.*?)</title>", s, flags=re.S|re.I)
    title = (title_m.group(1).strip() if title_m else "").strip()
    # convert headings/paragraphs
    s = re.sub(r"<h([1-6])[^>]*>", lambda m: "\n" + "#"*int(m.group(1)) + " ", s, flags=re.I)
    s = re.sub(r"</h[1-6]>", "\n", s, flags=re.I)
    s = re.sub(r"<p[^>]*>", "\n\n", s, flags=re.I)
    s = re.sub(r"</p>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "\n- ", s, flags=re.I)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    head = f"# {title}\n\n" if title else ""
    return head + s.strip()

manifest = []
for src, dst, name in HTML_FILES:
    if not os.path.exists(src):
        print(f"SKIP missing: {src}")
        continue
    raw = open(src, "r", encoding="utf-8", errors="ignore").read()
    if HAVE_BS4:
        text = to_text_bs4(raw)
        method = "bs4"
    else:
        text = to_text_regex(raw)
        method = "regex"
    open(dst, "w", encoding="utf-8").write(text)
    manifest.append({"name": name, "src": src, "dst": dst, "method": method,
                     "src_bytes": os.path.getsize(src), "dst_bytes": os.path.getsize(dst)})
    print(f"  {name}: {os.path.getsize(src)} -> {os.path.getsize(dst)} bytes ({method})")

print()
print(json.dumps(manifest, indent=2))
