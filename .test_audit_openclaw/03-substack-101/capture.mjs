// capture.mjs — Substack article screenshotter + extractor
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const URL = 'https://sidsaladi.substack.com/p/openclaw-101-2026-march-29-the-complete';
const OUT_DIR = path.resolve('C:/Users/gsanc/TAG-Projects-2026/openclaw/.test_audit_openclaw/03-substack-101');
const SHOTS_DIR = path.join(OUT_DIR, 'screenshots');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('[1/5] Navigating to article...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Dismiss subscribe modal / paywall overlay if present
  console.log('[2/5] Dismissing modals...');
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const closeBtns = await page.$$('button[aria-label*="close" i], button[aria-label*="dismiss" i], .close, [class*="close" i]');
    for (const btn of closeBtns) {
      try { await btn.click({ timeout: 1000 }); } catch {}
    }
    await page.waitForTimeout(500);
  } catch (e) {
    console.log('  (no modal or could not close)');
  }

  // Full-page screenshot
  console.log('[3/5] Taking full-page screenshot...');
  await page.screenshot({ path: path.join(SHOTS_DIR, '00-fullpage.png'), fullPage: true });

  // Get total page height
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = 900;
  const steps = Math.ceil(totalHeight / (viewportHeight * 0.8));
  console.log(`[4/5] Capturing ${steps} viewport screenshots (totalHeight=${totalHeight})...`);

  for (let i = 0; i < steps; i++) {
    const y = Math.floor(i * viewportHeight * 0.8);
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(400);
    const fname = `section-${String(i + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(SHOTS_DIR, fname), fullPage: false });
  }

  // Extract article text
  console.log('[5/5] Extracting article text...');
  const data = await page.evaluate(() => {
    const out = { title: '', author: '', date: '', body: [] };
    out.title = document.querySelector('h1')?.innerText || document.title || '';

    // Substack author/date selectors vary
    const authorEl = document.querySelector('[class*="byline"] a, [class*="author"] a, a[href*="/profile/"]');
    out.author = authorEl?.innerText || '';
    const dateEl = document.querySelector('time');
    out.date = dateEl?.getAttribute('datetime') || dateEl?.innerText || '';

    // Try Substack content body
    const article = document.querySelector('article') || document.querySelector('[class*="post-content"]') || document.querySelector('main') || document.body;
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_ELEMENT, null);
    let node;
    while (node = walker.nextNode()) {
      const tag = node.tagName.toLowerCase();
      const text = (node.innerText || '').trim();
      if (!text) continue;
      if (['h1','h2','h3','h4','h5','h6'].includes(tag)) {
        out.body.push({ type: tag, text });
      } else if (tag === 'p') {
        // skip nested duplicates: only push if direct child of article-ish
        out.body.push({ type: 'p', text });
      } else if (tag === 'pre' || tag === 'code') {
        out.body.push({ type: 'code', text });
      } else if (tag === 'li') {
        out.body.push({ type: 'li', text });
      } else if (tag === 'blockquote') {
        out.body.push({ type: 'quote', text });
      }
    }

    // Detect paywall
    out.paywall = !!document.querySelector('[class*="paywall" i], [class*="subscribe" i][class*="prompt" i], .paywall');
    out.paywallText = document.querySelector('[class*="paywall" i]')?.innerText || '';

    return out;
  });

  // Dedupe consecutive identical entries (TreeWalker double-counts nested p/h)
  const dedup = [];
  for (const item of data.body) {
    const last = dedup[dedup.length - 1];
    if (!last || last.text !== item.text) dedup.push(item);
  }

  // Write article.md
  let md = `# ${data.title}\n\n`;
  md += `**Author:** ${data.author}\n`;
  md += `**Date:** ${data.date}\n`;
  md += `**URL:** ${URL}\n`;
  md += `**Paywall detected:** ${data.paywall ? 'YES' : 'NO'}\n`;
  if (data.paywallText) md += `**Paywall text:** ${data.paywallText}\n`;
  md += `\n---\n\n`;
  for (const item of dedup) {
    if (item.type === 'h1') md += `\n# ${item.text}\n\n`;
    else if (item.type === 'h2') md += `\n## ${item.text}\n\n`;
    else if (item.type === 'h3') md += `\n### ${item.text}\n\n`;
    else if (item.type === 'h4') md += `\n#### ${item.text}\n\n`;
    else if (item.type === 'p') md += `${item.text}\n\n`;
    else if (item.type === 'code') md += `\n\`\`\`\n${item.text}\n\`\`\`\n\n`;
    else if (item.type === 'li') md += `- ${item.text}\n`;
    else if (item.type === 'quote') md += `> ${item.text}\n\n`;
  }

  fs.writeFileSync(path.join(OUT_DIR, 'article.md'), md);
  fs.writeFileSync(path.join(OUT_DIR, 'article.json'), JSON.stringify({ ...data, body: dedup }, null, 2));

  console.log(`Done. Screenshots: ${steps + 1}, body items: ${dedup.length}, paywall: ${data.paywall}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
