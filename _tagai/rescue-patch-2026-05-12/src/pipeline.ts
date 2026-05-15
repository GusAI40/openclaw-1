// Implements: ~/.claude/skills/rescue-pipeline/rescue-orchestrate/SKILL.md
import { env } from './lib/env.js';
import { discoverBusinesses } from './discover/discover.js';
import { auditWebsite } from './audit/audit.js';
import { getReportUrl, getAuditData } from './audit/report.js';
import { sendOutreachEmail } from './outreach/email.js';
import { extractContactEmail } from './outreach/extract-email.js';
import { uploadReport, deployReport } from './audit/upload-report.js';
import { generateMockup } from './audit/mockup.js';
import { generateAllMockups } from './audit/template-engine.js';
import { getBusinessesByStatus, getStats, getDb, updateStatus, wakeReadySnoozes } from './lib/db.js';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
mkdirSync(resolve(__dirname, '..', 'data'), { recursive: true });

interface PipelineOptions {
  lat: number;
  lng: number;
  radiusMiles: number;
  verticalSlugs?: string[];
  maxDiscover?: number;
  maxAudit?: number;
  maxEmail?: number;
  dryRun?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export async function runPipeline(options: PipelineOptions): Promise<void> {
  const {
    lat,
    lng,
    radiusMiles,
    verticalSlugs,
    maxDiscover = 20,
    maxAudit = 10,
    maxEmail = 10,
    dryRun = false,
  } = options;

  console.log('='.repeat(60));
  console.log('  RESCUE WEBSITES PIPELINE');
  console.log(`  Location: [${lat}, ${lng}] | Radius: ${radiusMiles} miles`);
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Tenant: ${env.TENANT_ID}`);
  console.log('='.repeat(60));

  // --- STEP 0: Wake ready snoozes ---
  // Pulls back any leads whose snooze_until has passed and flips
  // them from 'snoozed' to 'report_generated' so step 4 retries.
  // Added 2026-05-12 with migration 001 (blindspot #2 soft side).
  if (!dryRun) {
    const woken = await wakeReadySnoozes();
    if (woken > 0) {
      console.log(`\n[0/4] Woke ${woken} snoozed lead(s) — re-eligible for outreach`);
    }
  }

  // --- STEP 1: Discover ---
  console.log('\n[1/4] DISCOVERING BUSINESSES...\n');
  await discoverBusinesses({
    lat,
    lng,
    radiusMiles,
    verticalSlugs,
    maxPerVertical: maxDiscover,
  });

  // --- STEP 2: Audit ---
  console.log('\n[2/4] AUDITING WEBSITES...\n');
  const toAudit = (await getBusinessesByStatus('discovered', maxAudit))
    .filter((b: any) => b.website); // Only audit businesses with websites

  console.log(`  ${toAudit.length} businesses to audit`);

  for (const business of toAudit) {
    try {
      if (dryRun) {
        console.log(`  [DRY RUN] Would audit: ${business.name} (${business.website})`);
        continue;
      }
      const auditResult = await auditWebsite({
        id: business.id,
        slug: business.slug,
        name: business.name,
        website: business.website,
      });
      // Generate mockup(s) (non-fatal — report works without it)
      let mockupVariants: { name: string; htmlPath: string; pngPath: string }[] | undefined;
      try {
        const isDentistry = /dentist|dental/i.test((business.vertical || '') + ' ' + (business.category || ''));
        if (isDentistry) {
          mockupVariants = await generateAllMockups(business.id);
          console.log(`  ${mockupVariants.length} mockup(s) generated for ${business.name}`);
        } else {
          await generateMockup(business.id);
          console.log(`  Mockup generated for ${business.name}`);
        }
      } catch (mockupErr) {
        console.error(`  Mockup failed for ${business.name} (continuing):`, mockupErr);
      }
      // Save report JSON + mockup files to website for hosting
      await uploadReport(auditResult, business.city, business.category, mockupVariants);
      // Deploy to Cloudflare Pages (live URLs for prospect emails)
      try {
        const deployUrl = await deployReport(business.slug, business.name, mockupVariants);
        if (deployUrl) {
          console.log(`  Live at: ${deployUrl}`);
        } else {
          console.warn(`  Deploy failed for ${business.name}. Links may 404.`);
        }
      } catch (deployErr) {
        console.warn(`  Deploy failed for ${business.name} (continuing):`, deployErr);
      }
      await updateStatus(business.id, 'report_generated');
      // Rate limit between audits
      await sleep(2000);
    } catch (err) {
      console.error(`  Failed to audit ${business.name}:`, err);
    }
  }

  // --- STEP 3: Extract emails + prepare reports ---
  console.log('\n[3/4] EXTRACTING CONTACT EMAILS...\n');
  const audited = await getBusinessesByStatus('report_generated', maxEmail);
  console.log(`  ${audited.length} audited businesses to process`);

  for (const business of audited) {
    if (!business.contact_email) {
      try {
        if (dryRun) {
          console.log(`  [DRY RUN] Would extract email from: ${business.website}`);
          continue;
        }
        console.log(`  Extracting email from ${business.website}...`);
        const email = await extractContactEmail(business.website);
        if (email) {
          console.log(`  Found: ${email}`);
          const supabase = getDb();
          await supabase.from('website_rescue_businesses')
            .update({ contact_email: email })
            .eq('id', business.id)
            .eq('tenant_id', env.TENANT_ID);
          business.contact_email = email;
        } else {
          console.log(`  No email found for ${business.name} — skipping`);
        }
        await sleep(1000);
      } catch (err) {
        console.error(`  Error extracting email for ${business.name}:`, err);
      }
    }
  }

  // --- STEP 4: Send outreach emails ---
  console.log('\n[4/4] SENDING OUTREACH EMAILS...\n');
  const readyToEmail = (await getBusinessesByStatus('report_generated', maxEmail))
    .filter((b: any) => b.contact_email);

  console.log(`  ${readyToEmail.length} businesses ready for outreach`);

  let emailsSent = 0;
  let emailsSuppressed = 0;
  let emailsCapped = 0;
  for (const business of readyToEmail) {
    try {
      const audit = await getAuditData(business.id);
      if (!audit) {
        console.log(`  No audit data for ${business.name} — skipping`);
        continue;
      }

      const reportUrl = getReportUrl(business.slug);
      const mockupUrl = `${env.REPORT_BASE_URL}/mockups/${business.slug}.html`;

      // Build multiple mockup URLs for dentistry verticals — gate on file existence
      const isDentistryEmail = /dentist|dental/i.test((business.vertical || '') + ' ' + (business.category || ''));
      let mockupUrls: string[] | undefined;
      if (isDentistryEmail) {
        // Check which mockup variant files actually exist
        const { readdirSync } = await import('fs');
        const { resolve: r, basename: b } = await import('path');
        const mockupsDir = r(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'mockups');
        try {
          const files = readdirSync(mockupsDir).filter(f => f.startsWith(business.slug + '-') && f.endsWith('.html'));
          if (files.length > 1) {
            mockupUrls = files.map(f => `${env.REPORT_BASE_URL}/mockups/${f}`);
          }
        } catch {}
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would email ${business.contact_email} for ${business.name} (score: ${audit.overallScore})`);
        continue;
      }

      const result = await sendOutreachEmail({
        businessId: business.id,
        businessName: business.name,
        contactEmail: business.contact_email,
        audit,
        reportUrl,
        mockupUrl,
        mockupUrls,
        city: business.city,
        vertical: business.category,
      });

      if (result.success) {
        emailsSent++;
      } else if (result.skipped === 'suppressed') {
        emailsSuppressed++;
      } else if (result.skipped === 'capped') {
        emailsCapped++;
        // Once the cap is hit for this tenant/domain/day, every subsequent
        // send in this loop will also hit it. Break early.
        console.log(`  Daily cap reached on ${env.RESEND_FROM} — stopping send loop.`);
        break;
      }

      // Rate limit between emails
      await sleep(500);
    } catch (err) {
      console.error(`  Error emailing ${business.name}:`, err);
    }
  }

  // --- Summary ---
  const stats = await getStats();
  console.log('\n' + '='.repeat(60));
  console.log('  PIPELINE COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Businesses discovered: ${stats.total}`);
  console.log(`  Websites audited:      ${stats.audited}`);
  console.log(`  Emails sent:           ${emailsSent}`);
  console.log(`  Emails suppressed:     ${emailsSuppressed}`);
  console.log(`  Emails snoozed (cap):  ${emailsCapped}`);
  console.log(`  Pending audit:         ${stats.discovered}`);
  console.log('='.repeat(60));
}

// --- CLI ---
// Gate the CLI block so it only fires when pipeline.ts is the entry point,
// not when it's imported by a launcher script (e.g. run-julian-test.mjs).
// Without this gate, importing pipeline.ts auto-runs a second pipeline with
// default Dallas coords + all verticals — which is what burned us on
// 2026-05-12 (3 unintended emails to Dallas construction companies).
if (process.argv[1]?.endsWith('pipeline.ts')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Parse CLI args: pipeline.ts <lat> <lng> <radius> [--dry-run] [--verticals=a,b,c]
  // Note: lng can be negative (e.g. -96.7970), so we can't just filter out args starting with '-'
  const positional = args.filter(a => !a.startsWith('--'));
  const lat = parseFloat(positional[0] || '32.7767');  // Default: Dallas, TX
  const lng = parseFloat(positional[1] || '-96.7970');
  const radius = parseFloat(positional[2] || '10');

  const verticalArg = args.find(a => a.startsWith('--verticals='));
  const verticalSlugs = verticalArg ? verticalArg.split('=')[1].split(',') : undefined;

  runPipeline({
    lat,
    lng,
    radiusMiles: radius,
    verticalSlugs,
    dryRun,
  }).catch(err => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}
