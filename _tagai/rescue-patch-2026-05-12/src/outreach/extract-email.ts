import FirecrawlApp from '@mendable/firecrawl-js';
import { env } from '../lib/env.js';

const firecrawl = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });

/**
 * Reject obviously-non-human-inbox emails BEFORE we send to them.
 *
 * Added 2026-05-12 after a live run sent to
 * `frame-{32hex}@mhtml.blink` — an artifact from the Firecrawl HTML
 * containing MIME multipart frame headers, not a real address.
 *
 * Defensive rules (any one match = junk):
 *  1. Non-routable TLDs: .blink (MHTML), .local, .localhost, .invalid,
 *     .test, .example, .internal
 *  2. System / auto / role prefixes that should never receive cold
 *     outreach: frame-*, cid-*, noreply, no-reply, donotreply,
 *     mailer-daemon, postmaster
 *  3. Local-part > 40 chars (real human inboxes are short; long
 *     local-parts are hash-like artifacts)
 *  4. Contains @cdn., @assets., @static. — CDN-served sample emails
 */
function isJunkEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const at = lower.indexOf('@');
  if (at < 1 || at === lower.length - 1) return true;

  const localPart = lower.slice(0, at);
  const domainPart = lower.slice(at + 1);

  // Rule 1: bad TLDs
  if (/\.(blink|local|localhost|invalid|test|example|internal)$/.test(domainPart)) return true;

  // Rule 2: system/role prefixes
  if (/^(frame-|cid-|noreply|no-reply|donotreply|mailer-daemon|postmaster)/.test(localPart)) return true;

  // Rule 3: suspiciously long local-part (hash-like)
  if (localPart.length > 40) return true;

  // Rule 4: CDN-served sample addresses
  if (/^(cdn|assets|static|img|images|media)\./.test(domainPart)) return true;

  return false;
}

/**
 * Extract the "registrable" hostname from a website URL.
 *   https://www.dpr.com/foo -> dpr.com
 *   https://shop.dpr.co.uk  -> dpr.co.uk   (best-effort, not a PSL parser)
 *
 * Used by the domain-match guard so we only return emails whose
 * domain ends in the same registrable hostname as the business site.
 */
function registrableHost(website: string): string {
  try {
    const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.toLowerCase();
    const stripped = host.replace(/^www\./, '');
    // Best-effort: take the last 2 labels (foo.com) or last 3 if the
    // second-to-last is a known 2-letter ccTLD-style hint. Good enough
    // for 99% of US small-business domains without pulling in the PSL.
    const parts = stripped.split('.');
    if (parts.length <= 2) return stripped;
    const last2 = parts.slice(-2).join('.');
    const last3 = parts.slice(-3).join('.');
    // crude: if the second-to-last is 2 chars (co, com, ac, org pattern), keep 3 labels
    if (parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length === 2) {
      return last3;
    }
    return last2;
  } catch {
    return '';
  }
}

/**
 * Domain-match guard.
 *
 * Reject emails whose domain doesn't share the registrable hostname
 * with the business website. This catches the WORST scraper artifact:
 * third-party scripts (Experian verify widgets, CDN beacons, embed
 * codes) leaving their support@ addresses in the rendered HTML.
 *
 * 2026-05-12 incident: extractor returned verify.support@experian.com
 * for "DPR Construction" (dpr.com). With this guard active, that hit
 * is rejected because experian.com != dpr.com.
 */
function emailMatchesBusinessDomain(email: string, businessHost: string): boolean {
  if (!businessHost) return true; // can't check -> don't block (extractor degrades gracefully)
  const emailDomain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!emailDomain) return false;
  return emailDomain === businessHost || emailDomain.endsWith('.' + businessHost);
}

// Extract contact email from a website by scraping contact/about pages
export async function extractContactEmail(website: string): Promise<string | null> {
  let domain = website;
  if (!domain.startsWith('http')) domain = `https://${domain}`;
  domain = domain.replace(/\/+$/, '');

  const businessHost = registrableHost(domain);

  // Common contact page paths
  const contactPaths = [
    '/contact',
    '/contact-us',
    '/about',
    '/about-us',
    '/',
  ];

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const foundEmails = new Set<string>();

  for (const path of contactPaths) {
    try {
      const url = `${domain}${path}`;
      const result = await firecrawl.scrapeUrl(url, { formats: ['html'] });
      if (!result.success) continue;

      const html = result.html ?? '';
      const matches = html.match(emailRegex) ?? [];

      for (const email of matches) {
        const lower = email.toLowerCase();
        // Skip common non-contact emails (asset paths, CMS noise)
        if (lower.includes('wix.com') || lower.includes('wordpress') || lower.includes('example.com') || lower.includes('sentry.io') || lower.includes('.png') || lower.includes('.jpg')) continue;
        // Skip junk addresses (frame artifacts, .blink TLD, system prefixes, hash-like)
        if (isJunkEmail(lower)) continue;
        // Skip third-party scraper artifacts (experian.com on dpr.com etc.)
        if (!emailMatchesBusinessDomain(lower, businessHost)) continue;
        foundEmails.add(lower);
      }

      if (foundEmails.size > 0) break; // Got what we need
    } catch {
      continue;
    }
  }

  if (foundEmails.size === 0) return null;

  // Prefer info@, contact@, hello@, then anything
  const preferred = ['info@', 'contact@', 'hello@', 'sales@', 'admin@'];
  const emails = [...foundEmails];
  for (const prefix of preferred) {
    const match = emails.find(e => e.startsWith(prefix));
    if (match) return match;
  }

  return emails[0];
}
