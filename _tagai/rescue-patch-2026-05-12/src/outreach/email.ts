// Implements: ~/.claude/skills/rescue-pipeline/rescue-outreach/SKILL.md
import { Resend } from 'resend';
import { env, getFromDomain } from '../lib/env.js';
import {
  updateStatus,
  saveEmail,
  setContactEmail,
  isSuppressed,
  getTodaysSendCount,
  incrementTodaysSendCount,
  snoozeBusiness,
  getBusinessBySlug,
  getAuditByBusinessId,
} from '../lib/db.js';
import type { AuditResult } from '../lib/types.js';

const resend = new Resend(env.RESEND_API_KEY);

function pickCurrentStateHook(audit: AuditResult): string {
  // Priority 1: Mobile performance < 50 (skip if null / rate-limited)
  if (audit.performance.mobile.performance !== null && audit.performance.mobile.performance < 50) {
    const seconds = (audit.performance.mobile.lcp / 1000).toFixed(1);
    return `Right now, your site takes ${seconds}s to load on phones. Most visitors leave after 3.`;
  }
  // Priority 2: Missing page titles
  const missingTitles = audit.technical.missingMetaTitles.length;
  if (missingTitles > 0) {
    return `Right now, ${missingTitles} of your pages are invisible to Google. No titles, no rankings.`;
  }
  // Priority 3: No sitemap
  if (!audit.technical.hasSitemap) {
    return `Right now, Google can only find some of your pages. The rest don't exist to search.`;
  }
  // Priority 4: No structured data
  if (!audit.content.hasStructuredData) {
    return `Right now, when someone Googles you, your hours and reviews don't show up.`;
  }
  // Fallback: overall score
  const overall = audit.overallScore ?? Math.round(
    (audit.technicalScore + audit.contentScore
      + audit.localSeoScore + audit.aeoScore + audit.geoScore
      + (audit.performanceScore ?? audit.technicalScore)) / 6);
  return `Right now, your online presence is scoring ${overall}/100. That's costing you customers every day.`;
}

function pickGapQuestion(businessName: string): string {
  const gaps = [
    `Customers aren't just Googling anymore. They're asking ChatGPT and Perplexity for recommendations, and right now, those tools can't find ${businessName}.`,
    `The way people find local businesses is changing. AI assistants are recommending businesses directly, and ${businessName} isn't showing up in those conversations.`,
    `More people are asking AI for recommendations than typing into Google. Right now, ${businessName} isn't part of those answers.`,
  ];
  return gaps[businessName.length % 3];
}

function pickFutureStateVision(businessName: string, city: string, vertical: string): string {
  const c = city || 'your area';
  const v = vertical.toLowerCase();
  if (/dentist|dental/.test(v)) return `when someone asked an AI assistant for the best dentist near ${c}, your practice was the first name it gave`;
  if (/eye|optom|vision/.test(v)) return `when a patient asked ChatGPT for an eye doctor near ${c}, your office came up first`;
  if (/restaurant|food|dining/.test(v)) return `when someone asked AI for the best place to eat near ${c}, your restaurant was the top recommendation`;
  if (/law|attorney|legal/.test(v)) return `when someone asked AI for a lawyer in ${c}, your firm was the first referral`;
  if (/financ|account|cpa|tax/.test(v)) return `when someone asked AI for a financial advisor near ${c}, your firm was the top recommendation`;
  if (/it\b|msp|tech|software|cyber|cloud/.test(v)) return `when a business asked AI for an IT partner in ${c}, your company was the first answer`;
  if (/health|medical|doctor|physician|clinic/.test(v)) return `when a patient asked AI for a doctor near ${c} accepting new patients, your practice was the first recommendation`;
  if (/chiropract/.test(v)) return `when someone asked AI for a chiropractor near ${c}, your office came up first`;
  if (/spa|salon|wellness/.test(v)) return `when someone asked AI for the best salon near ${c}, your business was the first suggestion`;
  if (/plumb|hvac|electric/.test(v)) return `when a homeowner asked AI for an emergency plumber in ${c}, your company was the first call they made`;
  if (/construct|contract|roof/.test(v)) return `when someone asked AI for a contractor in ${c}, your company was the top recommendation`;
  if (/auto|mechanic|car/.test(v)) return `when someone asked AI for the best mechanic near ${c}, your shop was the first recommendation`;
  if (/hotel|hospitality/.test(v)) return `when a traveler asked AI where to stay in ${c}, your property was the top suggestion`;
  if (/senior|assisted|nursing/.test(v)) return `when a family asked AI for senior living near ${c}, your community was the first recommendation`;
  if (/veterinar/.test(v)) return `when a pet owner asked AI for the best vet near ${c}, your clinic was the first answer`;
  if (/real\s*estate/.test(v)) return `when someone asked AI for a real estate agent in ${c}, your name was the first one mentioned`;
  if (/fitness|gym/.test(v)) return `when someone asked AI for the best gym near ${c}, your facility was the top pick`;
  if (/landscap/.test(v)) return `when a homeowner asked AI for a landscaper in ${c}, your company came up first`;
  if (/clean/.test(v)) return `when someone asked AI for a cleaning service in ${c}, your business was the first recommendation`;
  if (/photograph/.test(v)) return `when someone asked AI for a photographer near ${c}, your portfolio was the first they saw`;
  if (/education|school|tutor/.test(v)) return `when a parent asked AI for the best school near ${c}, your name came up first`;
  if (/church|faith/.test(v)) return `when someone asked AI for a welcoming church near ${c}, your community was the first suggestion`;
  if (/nonprofit/.test(v)) return `when someone asked AI about nonprofits in ${c}, your organization was the first they recommended`;
  if (/warehouse|logistics|freight/.test(v)) return `when a business asked AI for logistics near ${c}, your company was the top result`;
  if (/retail/.test(v)) return `when someone asked AI for the best shop near ${c}, your store was the first recommendation`;
  return `when someone asked AI for the best ${vertical || 'business'} near ${c}, ${businessName} was the first answer`;
}

function buildSubject(audit: AuditResult): string {
  const score = audit.overallScore ?? 50;
  if (score < 50) {
    const urgent = [
      `${audit.businessName} — your website is turning customers away`,
      `${audit.businessName} — you're losing leads right now`,
      `${audit.businessName} — your site scored ${score}/100`,
    ];
    return urgent[audit.businessName.length % 3];
  }
  if (score < 70) {
    const gap = [
      `${audit.businessName} — here's what you're leaving on the table`,
      `${audit.businessName} — a few fixes could change everything`,
      `${audit.businessName} — your site is close, but not there yet`,
    ];
    return gap[audit.businessName.length % 3];
  }
  const curiosity = [
    `${audit.businessName} — one gap you probably haven't noticed`,
    `${audit.businessName} — your site's good, but AI can't find you`,
    `${audit.businessName} — the blind spot most good sites have`,
  ];
  return curiosity[audit.businessName.length % 3];
}

function buildMockupLines(mockupUrls: string[] | undefined, mockupUrl: string | undefined, reportUrl: string, businessName: string): { text: string; html: string } {
  if (mockupUrls && mockupUrls.length >= 2) {
    const textLinks = mockupUrls.map((url, i) => `  Design Option ${i + 1}: ${url}`).join('\n');
    const htmlLinks = mockupUrls.map((url, i) =>
      `<a href="${url}" style="color:#2563eb;text-decoration:underline;">Design Option ${i + 1}</a>`
    ).join(' &nbsp;|&nbsp; ');
    return {
      text: `We redesigned your website ${mockupUrls.length} different ways using your real content — pick the one that fits:\n${textLinks}`,
      html: `We redesigned your website ${mockupUrls.length} different ways using your real content &mdash; pick the one that fits:<br>${htmlLinks}`,
    };
  }
  if (mockupUrl) {
    return {
      text: `I mocked up what your homepage could look like:\n${mockupUrl}`,
      html: `I mocked up what your homepage could look like:<br><a href="${mockupUrl}" style="color:#2563eb;text-decoration:underline;">View your mockup</a>`,
    };
  }
  return {
    text: `I put together a full breakdown for ${businessName}:\n${reportUrl}`,
    html: `I put together a full breakdown for ${businessName}:<br><a href="${reportUrl}" style="color:#2563eb;text-decoration:underline;">View your report</a>`,
  };
}

function buildEmailText(audit: AuditResult, reportUrl: string, mockupUrl: string | undefined, mockupUrls: string[] | undefined, firstName: string | null, city: string, vertical: string): string {
  const greeting = firstName ? `Hi ${firstName},` : `Hi ${audit.businessName} team,`;
  const hook = pickCurrentStateHook(audit);
  const gap = pickGapQuestion(audit.businessName);
  const vision = pickFutureStateVision(audit.businessName, city, vertical);

  const { text: mockupLine } = buildMockupLines(mockupUrls, mockupUrl, reportUrl, audit.businessName);

  const auditLine = `That link also has your full audit — ${audit.technical.pageCount} pages analyzed, every issue mapped, plus what AI search engines see when they look at ${audit.businessName}.`;

  const toolsNote = `P.S. Our voice agent, chatbot, and booking system are also available as standalone add-ons to your existing website — no full redesign required.`;

  const signOff = `— Julian Sanchez\nTAG AI | Website Rescue`;

  return `${greeting}

${hook}

${gap}

What if ${vision}?

${mockupLine}

${auditLine}

Hit reply and I'll walk you through it — 15 minutes, no pitch, just the data.

${toolsNote}

${signOff}`;
}

function buildEmailHtml(audit: AuditResult, reportUrl: string, mockupUrl: string | undefined, mockupUrls: string[] | undefined, firstName: string | null, city: string, vertical: string): string {
  const greeting = firstName ? `Hi ${firstName},` : `Hi ${audit.businessName} team,`;
  const hook = pickCurrentStateHook(audit);
  const gap = pickGapQuestion(audit.businessName);
  const vision = pickFutureStateVision(audit.businessName, city, vertical);

  const { html: mockupLine } = buildMockupLines(mockupUrls, mockupUrl, reportUrl, audit.businessName);

  const auditLine = `That link also has your full audit &mdash; ${audit.technical.pageCount} pages analyzed, every issue mapped, plus what AI search engines see when they look at ${audit.businessName}.`;

  const toolsNote = `<p style="font-size:13px;color:#888;margin-top:24px;">P.S. Our voice agent, chatbot, and booking system are also available as standalone add-ons to your existing website &mdash; no full redesign required.</p>`;

  const signOff = `&mdash; Julian Sanchez<br>TAG AI | Website Rescue`;

  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;">
<p>${greeting}</p>
<p>${hook}</p>
<p>${gap}</p>
<p>What if ${vision}?</p>
<p>${mockupLine}</p>
<p>${auditLine}</p>
<p>Hit reply and I'll walk you through it &mdash; 15 minutes, no pitch, just the data.</p>
${toolsNote}
<p>${signOff}</p>
</div>`;
}

export async function sendOutreachEmail(options: {
  businessId: string;
  businessName: string;
  contactEmail: string;
  contactFirstName?: string | null;
  audit: AuditResult;
  reportUrl: string;
  mockupUrl?: string;
  mockupUrls?: string[];
  city?: string;
  vertical?: string;
}): Promise<{ success: boolean; resendId?: string; error?: string; skipped?: 'suppressed' | 'capped' }> {
  const { businessId, businessName, contactEmail, contactFirstName, audit, reportUrl, mockupUrl, mockupUrls } = options;

  // ============================================================
  // GATE 1 — Suppression check (Migration 001, blindspot #2)
  // ============================================================
  // Once a recipient says stop (unsub, bounce-hard, complaint), no
  // tenant in the org may ever email them again. Fail SAFE: if the
  // suppression lookup errors, we treat them as suppressed.
  if (await isSuppressed(contactEmail)) {
    console.log(`  Skip ${businessName} (${contactEmail}) — suppression list hit. Marking 'unsubbed'.`);
    await updateStatus(businessId, 'unsubbed');
    return { success: false, skipped: 'suppressed', error: 'recipient on suppression list' };
  }

  // ============================================================
  // GATE 2 — Daily send cap (Migration 001, blindspot #3)
  // ============================================================
  // Self-throttle BEFORE Resend's reputation throttle kicks in.
  // Cap is per-(tenant, from_domain, UTC day). Over-cap = snooze
  // the lead 24h and exit cleanly.
  const fromDomain = getFromDomain();
  const sentToday = await getTodaysSendCount(fromDomain);
  if (sentToday >= env.DAILY_SEND_CAP) {
    const wakeAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log(`  Cap hit (${sentToday}/${env.DAILY_SEND_CAP} on ${fromDomain}). Snoozing ${businessName} until ${wakeAt.toISOString()}.`);
    await snoozeBusiness({
      businessId,
      snoozeUntil: wakeAt,
      reason: `daily_cap_${fromDomain}_${env.DAILY_SEND_CAP}`,
    });
    return { success: false, skipped: 'capped', error: `daily cap reached (${env.DAILY_SEND_CAP})` };
  }

  // ============================================================
  // ACTUAL SEND
  // ============================================================
  const subject = buildSubject(audit);
  const text = buildEmailText(audit, reportUrl, mockupUrl, mockupUrls, contactFirstName ?? null, options.city || '', options.vertical || '');
  const html = buildEmailHtml(audit, reportUrl, mockupUrl, mockupUrls, contactFirstName ?? null, options.city || '', options.vertical || '');

  try {
    const result = await resend.emails.send({
      from: env.RESEND_FROM,
      to: contactEmail,
      replyTo: env.CONTACT_EMAIL,
      subject,
      text,
      html,
      tags: [
        { name: 'type', value: 'rescue-audit' },
        { name: 'business', value: businessId },
        { name: 'tenant', value: env.TENANT_ID },
      ],
    });

    if (result.error) {
      console.error(`  Email failed for ${businessName}:`, result.error);
      return { success: false, error: result.error.message };
    }

    // Post-send bookkeeping: persist, increment quota, flip status.
    await setContactEmail(businessId, contactEmail);
    await saveEmail(businessId, contactEmail, subject, reportUrl, result.data?.id);
    await incrementTodaysSendCount(fromDomain);
    await updateStatus(businessId, 'emailed');
    console.log(`  Email sent to ${contactEmail} for ${businessName} (${sentToday + 1}/${env.DAILY_SEND_CAP} today on ${fromDomain})`);

    return { success: true, resendId: result.data?.id };
  } catch (err: any) {
    console.error(`  Email error for ${businessName}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Preview send. Render a prospect email for a known business slug
 * using its real audit data, but redirect the delivery to a chosen
 * address (e.g. the operator's own inbox) so the email can be
 * inspected before any further live wave. NO database writes.
 *
 * Added 2026-05-12 after the first live wave revealed targeting +
 * extraction bugs; Gus asked to see the prospect email before any
 * additional sends.
 */
export async function previewOutreachEmail(slug: string, redirectTo: string, deployUrlBaseOverride?: string): Promise<{
  ok: boolean;
  to?: string;
  subject?: string;
  reportUrl?: string;
  mockupUrl?: string;
  resendId?: string;
  error?: string;
}> {
  const business = await getBusinessBySlug(slug);
  if (!business) return { ok: false, error: `No business with slug ${slug}` };

  const audit = await getAuditByBusinessId(business.id);
  if (!audit) return { ok: false, error: `No audit for business ${slug}` };

  let auditObj: AuditResult;
  try {
    auditObj = typeof audit.report_data === 'string' ? JSON.parse(audit.report_data) : audit.report_data;
  } catch (e: any) {
    return { ok: false, error: `Cannot parse audit JSON: ${e.message}` };
  }

  // Each CF Pages deploy lands on its own unique URL (e.g. 3dd78ea0.rescue-websites.pages.dev).
  // The canonical rescue-websites.pages.dev only serves the most-recent deploy, which is why
  // older businesses' files 404 there. Caller passes the working per-business deploy URL.
  const base = deployUrlBaseOverride || env.REPORT_BASE_URL;
  const reportUrl = `${base}/reports/${business.slug}.html`;
  const mockupUrl = `${base}/mockups/${business.slug}.html`;

  const subject = buildSubject(auditObj);
  const text = buildEmailText(auditObj, reportUrl, mockupUrl, undefined, null, business.city || '', business.category || '');
  const html = buildEmailHtml(auditObj, reportUrl, mockupUrl, undefined, null, business.city || '', business.category || '');

  const banner = `[PREVIEW] real prospect would be ${business.name}, contact: ${business.contact_email ?? '(unknown)'}, tenant: ${env.TENANT_ID}`;

  const result = await resend.emails.send({
    from: env.RESEND_FROM,
    to: redirectTo,
    replyTo: env.CONTACT_EMAIL,
    subject: `[PREVIEW] ${subject}`,
    text: `${banner}\n\n${text}`,
    html: `<div style="background:#fffae6;border:1px solid #f5c443;padding:10px 14px;margin-bottom:16px;border-radius:6px;font-family:sans-serif;font-size:13px;color:#7a5500;"><strong>PREVIEW MODE</strong>. Real prospect would be <b>${business.name}</b>, contact: <code>${business.contact_email ?? '(unknown)'}</code>. Tenant: <code>${env.TENANT_ID}</code>. No DB writes performed.</div>${html}`,
    tags: [
      { name: 'type', value: 'rescue-audit-preview' },
      { name: 'business', value: business.id },
      { name: 'tenant', value: env.TENANT_ID },
    ],
  });

  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  return {
    ok: true,
    to: redirectTo,
    subject,
    reportUrl,
    mockupUrl,
    resendId: result.data?.id,
  };
}
