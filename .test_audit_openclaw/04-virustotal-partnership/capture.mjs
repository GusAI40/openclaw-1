// Capture script for openclaw.ai marketing site
// - VirusTotal partnership post
// - Blog index + each post
// - Homepage

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = 'C:/Users/gsanc/TAG-Projects-2026/openclaw/.test_audit_openclaw/04-virustotal-partnership';
const SHOTS = path.join(OUT, 'screenshots');
const POSTS = path.join(OUT, 'posts');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(POSTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safeGoto(page, url, opts = {}) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000, ...opts });
  } catch (e) {
    console.log(`networkidle timeout for ${url}, falling back to domcontentloaded`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e2) {
      console.log(`hard fail on ${url}: ${e2.message}`);
      return false;
    }
  }
  return true;
}

async function extractArticle(page) {
  // Try common article selectors
  const text = await page.evaluate(() => {
    const sels = ['article', 'main', '[role="main"]', '.prose', '.post-content', '.blog-post'];
    let best = '';
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.innerText && el.innerText.length > best.length) best = el.innerText;
    }
    if (!best) best = document.body.innerText;
    return best;
  });
  const meta = await page.evaluate(() => {
    const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || '';
    const name = (n) => document.querySelector(`meta[name="${n}"]`)?.content || '';
    return {
      title: document.title,
      ogTitle: og('og:title'),
      description: name('description') || og('og:description'),
      ogImage: og('og:image'),
      publishedTime: og('article:published_time') || name('date'),
      url: location.href,
    };
  });
  return { meta, text };
}

async function scrollScreenshots(page, prefix) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  const vh = await page.evaluate(() => window.innerHeight);
  let idx = 0;
  for (let y = 0; y < height; y += vh) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await sleep(400);
    idx++;
    await page.screenshot({ path: path.join(SHOTS, `${prefix}-section-${String(idx).padStart(2, '0')}.png`) });
    if (idx > 20) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  });
  const page = await context.newPage();

  const results = {
    virustotal: null,
    homepage: null,
    blogIndex: null,
    posts: [],
  };

  // -------- 1. VirusTotal partnership post --------
  console.log('--- VirusTotal partnership post ---');
  const vtUrl = 'https://openclaw.ai/blog/virustotal-partnership';
  const vtOk = await safeGoto(page, vtUrl);
  if (vtOk) {
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, '00-virustotal-partnership-fullpage.png'), fullPage: true });
    await scrollScreenshots(page, '00-vt');
    const { meta, text } = await extractArticle(page);
    fs.writeFileSync(path.join(OUT, 'article.md'), `# ${meta.title}\n\nURL: ${meta.url}\nPublished: ${meta.publishedTime}\nDescription: ${meta.description}\n\n---\n\n${text}\n`);
    results.virustotal = { meta, ok: true };
  } else {
    results.virustotal = { ok: false };
  }

  // -------- 2. Homepage --------
  console.log('--- Homepage ---');
  const homeOk = await safeGoto(page, 'https://openclaw.ai/');
  if (homeOk) {
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, '01-homepage-fullpage.png'), fullPage: true });
    await scrollScreenshots(page, '01-home');
    const { meta, text } = await extractArticle(page);
    fs.writeFileSync(path.join(OUT, 'homepage.md'), `# ${meta.title}\n\nURL: ${meta.url}\nDescription: ${meta.description}\n\n---\n\n${text}\n`);
    results.homepage = { meta, ok: true };
  }

  // -------- 3. Blog index --------
  console.log('--- Blog index ---');
  const idxOk = await safeGoto(page, 'https://openclaw.ai/blog');
  let postLinks = [];
  if (idxOk) {
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, '02-blog-index-fullpage.png'), fullPage: true });
    await scrollScreenshots(page, '02-blog');
    postLinks = await page.evaluate(() => {
      const set = new Map();
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        // resolve to absolute
        let abs;
        try { abs = new URL(href, location.href).href; } catch { continue; }
        if (!abs.includes('openclaw.ai/blog/')) continue;
        if (abs.endsWith('/blog') || abs.endsWith('/blog/')) continue;
        // dedupe by URL
        if (!set.has(abs)) {
          set.set(abs, { url: abs, text: (a.innerText || '').trim().slice(0, 200) });
        }
      }
      return Array.from(set.values());
    });
    const { meta, text } = await extractArticle(page);
    fs.writeFileSync(path.join(OUT, 'blog-index.md'), `# ${meta.title}\n\nURL: ${meta.url}\n\n---\n\n${text}\n\n---\n\n## Discovered Post Links\n${postLinks.map((p) => `- ${p.url} :: ${p.text}`).join('\n')}\n`);
    results.blogIndex = { meta, ok: true, count: postLinks.length };
  }

  // -------- 4. Each post (cap 30) --------
  console.log(`--- Posts (${Math.min(postLinks.length, 30)}) ---`);
  const cap = postLinks.slice(0, 30);
  for (let i = 0; i < cap.length; i++) {
    const p = cap[i];
    const slug = p.url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').slice(-80);
    const idx = String(i + 1).padStart(2, '0');
    console.log(`  [${idx}] ${p.url}`);
    const ok = await safeGoto(page, p.url);
    if (!ok) {
      results.posts.push({ url: p.url, ok: false });
      continue;
    }
    await sleep(1200);
    try {
      await page.screenshot({ path: path.join(SHOTS, `post-${idx}-${slug}.png`), fullPage: true });
    } catch (e) {
      console.log(`    screenshot failed: ${e.message}`);
    }
    const { meta, text } = await extractArticle(page);
    fs.writeFileSync(path.join(POSTS, `post-${idx}-${slug}.md`), `# ${meta.title}\n\nURL: ${meta.url}\nPublished: ${meta.publishedTime}\nDescription: ${meta.description}\n\n---\n\n${text}\n`);
    // 1-2 line summary heuristic: meta description if present, else first ~280 chars
    const summary = (meta.description || text).replace(/\s+/g, ' ').trim().slice(0, 280);
    results.posts.push({ url: p.url, title: meta.title, ogTitle: meta.ogTitle, publishedTime: meta.publishedTime, summary, ok: true });
  }

  fs.writeFileSync(path.join(OUT, 'capture-results.json'), JSON.stringify(results, null, 2));
  console.log('DONE');
  await browser.close();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
