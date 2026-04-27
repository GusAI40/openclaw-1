// Capture full-page screenshots of selective high-value OpenClaw pages.
// Runs from main-context Bash (network OK). Uses globally-installed Playwright.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = String.raw`C:\Users\gsanc\TAG-Projects-2026\openclaw\.test_audit_openclaw`;

// (URL, output dir, slug, optional viewport)
const TARGETS = [
  // Docs - high-value pages only (full content already on disk via mirror)
  ['https://docs.openclaw.ai/',                           '01-docs-openclaw-ai/screenshots', '00-home'],
  ['https://docs.openclaw.ai/start/lore',                 '01-docs-openclaw-ai/screenshots', '01-start-lore'],
  ['https://docs.openclaw.ai/start/wizard',               '01-docs-openclaw-ai/screenshots', '02-start-wizard'],
  ['https://docs.openclaw.ai/concepts/agent',             '01-docs-openclaw-ai/screenshots', '03-concepts-agent'],
  ['https://docs.openclaw.ai/concepts/multi-agent',       '01-docs-openclaw-ai/screenshots', '04-concepts-multi-agent'],
  ['https://docs.openclaw.ai/concepts/architecture',      '01-docs-openclaw-ai/screenshots', '05-concepts-architecture'],
  ['https://docs.openclaw.ai/concepts/delegate-architecture', '01-docs-openclaw-ai/screenshots', '06-concepts-delegate'],
  ['https://docs.openclaw.ai/channels',                   '01-docs-openclaw-ai/screenshots', '07-channels-index'],
  ['https://docs.openclaw.ai/channels/telegram',          '01-docs-openclaw-ai/screenshots', '08-channels-telegram'],
  ['https://docs.openclaw.ai/channels/whatsapp',          '01-docs-openclaw-ai/screenshots', '09-channels-whatsapp'],
  ['https://docs.openclaw.ai/channels/bluebubbles',       '01-docs-openclaw-ai/screenshots', '10-channels-bluebubbles'],
  ['https://docs.openclaw.ai/tools/index',                '01-docs-openclaw-ai/screenshots', '11-tools-index'],
  ['https://docs.openclaw.ai/tools/skills',               '01-docs-openclaw-ai/screenshots', '12-tools-skills'],
  ['https://docs.openclaw.ai/tools/lobster',              '01-docs-openclaw-ai/screenshots', '13-tools-lobster'],
  ['https://docs.openclaw.ai/providers/litellm',          '01-docs-openclaw-ai/screenshots', '14-providers-litellm'],
  ['https://docs.openclaw.ai/gateway/health',             '01-docs-openclaw-ai/screenshots', '15-gateway-health'],
  ['https://docs.openclaw.ai/gateway/security',           '01-docs-openclaw-ai/screenshots', '16-gateway-security'],
  ['https://docs.openclaw.ai/plugins/architecture',       '01-docs-openclaw-ai/screenshots', '17-plugins-architecture'],
  ['https://docs.openclaw.ai/automation/cron-jobs',       '01-docs-openclaw-ai/screenshots', '18-automation-cron'],
  ['https://docs.openclaw.ai/automation/standing-orders', '01-docs-openclaw-ai/screenshots', '19-automation-standing-orders'],
  ['https://docs.openclaw.ai/cli/setup',                  '01-docs-openclaw-ai/screenshots', '20-cli-setup'],
  ['https://docs.openclaw.ai/cli/cron',                   '01-docs-openclaw-ai/screenshots', '21-cli-cron'],
  ['https://docs.openclaw.ai/nodes/index',                '01-docs-openclaw-ai/screenshots', '22-nodes-index'],
  ['https://docs.openclaw.ai/concepts/memory-search',     '01-docs-openclaw-ai/screenshots', '23-memory-search'],
  ['https://docs.openclaw.ai/concepts/context-engine',    '01-docs-openclaw-ai/screenshots', '24-context-engine'],
  ['https://docs.openclaw.ai/security/CONTRIBUTING-THREAT-MODEL', '01-docs-openclaw-ai/screenshots', '25-security-threat-model'],
  ['https://docs.openclaw.ai/reference/templates/AGENTS', '01-docs-openclaw-ai/screenshots', '26-templates-agents'],
  ['https://docs.openclaw.ai/reference/templates/SOUL',   '01-docs-openclaw-ai/screenshots', '27-templates-soul'],
  ['https://docs.openclaw.ai/reference/templates/IDENTITY','01-docs-openclaw-ai/screenshots', '28-templates-identity'],
  ['https://docs.openclaw.ai/reference/templates/BOOT',   '01-docs-openclaw-ai/screenshots', '29-templates-boot'],
  // Substack 101
  ['https://sidsaladi.substack.com/p/openclaw-101-2026-march-29-the-complete', '03-substack-101/screenshots', '00-fullpage'],
  // VirusTotal post + marketing site
  ['https://openclaw.ai/blog/virustotal-partnership',  '04-virustotal-partnership/screenshots', '00-virustotal-post'],
  ['https://openclaw.ai',                              '04-virustotal-partnership/screenshots', '01-homepage'],
  ['https://openclaw.ai/blog',                         '04-virustotal-partnership/screenshots', '02-blog-index'],
];

async function dismissOverlays(page) {
  // Substack subscribe modal etc.
  try { await page.keyboard.press('Escape'); } catch {}
  for (const sel of ['button[aria-label="Close"]', 'button:has-text("No thanks")', '.modal-close', '[aria-label="close"]']) {
    try {
      const btn = await page.$(sel);
      if (btn) { await btn.click({ timeout: 800 }).catch(()=>{}); }
    } catch {}
  }
}

async function captureBlogPostList(page) {
  // For openclaw.ai/blog (SPA), wait for hydration and dump links
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(2000);
    const data = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'))
        .map(a => ({ href: a.href, text: (a.textContent||'').trim().slice(0, 200) }))
        .filter(x => x.href && /\/blog\//.test(x.href) && !x.href.endsWith('/blog'));
      const dedup = new Map();
      for (const l of links) if (!dedup.has(l.href)) dedup.set(l.href, l);
      return Array.from(dedup.values());
    });
    return data;
  } catch (e) { return []; }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  });
  const summary = [];
  for (const [url, dir, slug] of TARGETS) {
    const outDir = path.join(ROOT, dir);
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${slug}.png`);
    const page = await ctx.newPage();
    try {
      console.log(`-> ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
      await dismissOverlays(page);
      await page.waitForTimeout(800);
      // For substack, scroll to force lazy content
      if (url.includes('substack.com')) {
        for (let i = 0; i < 6; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight*0.85));
          await page.waitForTimeout(400);
        }
        await page.evaluate(() => window.scrollTo(0,0));
        await page.waitForTimeout(400);
      }
      await page.screenshot({ path: out, fullPage: true });
      let extra = {};
      if (url.endsWith('/blog')) {
        const posts = await captureBlogPostList(page);
        fs.writeFileSync(path.join(outDir, '..', 'blog-posts.json'), JSON.stringify(posts, null, 2));
        extra = { blog_posts_found: posts.length };
      }
      summary.push({ url, out, ok: true, ...extra });
    } catch (e) {
      console.error(`   FAIL ${url}: ${e.message}`);
      summary.push({ url, out, ok: false, error: e.message });
    } finally {
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'screenshots-summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nDONE. ${summary.filter(s=>s.ok).length}/${summary.length} succeeded.`);
  console.log(`Summary: ${path.join(ROOT, 'screenshots-summary.json')}`);
})();
