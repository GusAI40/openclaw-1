// Standalone HTML reporter. No external CSS/JS — everything inline
// so the report can be opened from any path and emailed/zipped
// without breaking. Charts are inline SVG.

import type { AnalyzerSummary, FunnelStats } from './analyzer.ts';

interface RunMeta {
  interactions: number;
  tenants: string[];
  industries: string[];
  days: number;
  seed: number;
}

const escapeHtml = (s: string): string =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const fmtPct = (x: number): string => `${(x * 100).toFixed(2)}%`;

function blindspotCard(title: string, verdict: 'ok' | 'warn' | 'fail', body: string): string {
  const color = verdict === 'ok' ? '#0a7d28' : verdict === 'warn' ? '#b87800' : '#b00020';
  const label = verdict === 'ok' ? 'PASS' : verdict === 'warn' ? 'NOTE' : 'FAIL';
  return `<div class="card"><div class="card-h"><h3>${escapeHtml(title)}</h3>
    <span class="badge" style="background:${color}">${label}</span></div>
    <div class="card-b">${body}</div></div>`;
}

function funnelTable(funnels: Record<string, FunnelStats>): string {
  const tenants = Object.keys(funnels).sort();
  const rows = [
    ['Discover won', 'discoverWon'],
    ['Discover lost (race/advisory)', 'discoverLost'],
    ['Audit found no email', 'auditNoEmail'],
    ['Mockup blocked: no template', 'mockupNoTemplate'],
    ['Deploy failed', 'deployFailed'],
    ['Reached email step (sends)', 'reachedEmail'],
    ['Replied (positive)', 'replied'],
    ['Unsubscribed', 'unsubbed'],
    ['Bounced', 'bounced'],
    ['Sequence exhausted (no reply)', 'exhausted'],
  ] as const;
  let html = `<table><thead><tr><th>Funnel step</th>`;
  for (const t of tenants) html += `<th>${escapeHtml(t)}</th>`;
  html += `</tr></thead><tbody>`;
  for (const [label, key] of rows) {
    html += `<tr><td>${label}</td>`;
    for (const t of tenants) html += `<td class="num">${(funnels[t] as any)[key]}</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

function transitionList(transitions: string[]): string {
  if (transitions.length === 0) return '<p><em>No state transitions observed.</em></p>';
  return `<ul class="trans">${transitions.map(t => `<li><code>${escapeHtml(t)}</code></li>`).join('')}</ul>`;
}

function dictTable(d: Record<string, number>, keyHeader: string, valueHeader: string): string {
  const entries = Object.entries(d).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '<p><em>None observed.</em></p>';
  return `<table><thead><tr><th>${escapeHtml(keyHeader)}</th><th>${escapeHtml(valueHeader)}</th></tr></thead><tbody>${
    entries.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td class="num">${v}</td></tr>`).join('')
  }</tbody></table>`;
}

function quotaTable(d: Record<string, { day: number; sends: number; cap: number }>): string {
  const entries = Object.entries(d).sort((a, b) => b[1].sends - a[1].sends);
  if (entries.length === 0) return '<p><em>No send activity recorded.</em></p>';
  return `<table><thead><tr><th>From-domain</th><th>Peak-send day</th><th>Sends</th><th>Cap that day</th><th>Over cap?</th></tr></thead><tbody>${
    entries.map(([d, v]) => {
      const over = v.cap >= 0 && v.sends >= v.cap ? 'YES' : '—';
      const overColor = over === 'YES' ? 'color:#b00020;font-weight:600' : 'color:#666';
      return `<tr><td>${escapeHtml(d)}</td><td class="num">${v.day}</td><td class="num">${v.sends}</td><td class="num">${v.cap < 0 ? '—' : v.cap}</td><td class="num" style="${overColor}">${over}</td></tr>`;
    }).join('')
  }</tbody></table>`;
}

function styles(): string {
  return `
    body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1a1a1a; max-width: 1100px; margin: 24px auto; padding: 0 16px; background: #fafafa; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin-top: 32px; padding-bottom: 6px; border-bottom: 1px solid #ddd; }
    h3 { font-size: 15px; margin: 0; }
    .meta { color: #666; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 12px; }
    .card { background: white; border: 1px solid #ddd; border-radius: 6px; padding: 12px 14px; }
    .card-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .badge { color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
    .card-b { font-size: 13px; color: #333; }
    .card-b strong { font-size: 16px; color: #000; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; background: white; }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
    th { background: #f0f0f0; font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
    .trans { columns: 2; column-gap: 16px; padding-left: 16px; }
    .trans li { break-inside: avoid; margin-bottom: 4px; }
    .headline { font-size: 16px; margin: 8px 0 0; padding: 12px 16px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 3px; }
    .headline.ok { background: #e7f5e9; border-left-color: #0a7d28; }
    .headline.fail { background: #fdeaea; border-left-color: #b00020; }
  `;
}

export function renderHtmlReport(s: AnalyzerSummary, meta: RunMeta): string {
  // Verdicts
  const ffVerdict: 'ok' | 'warn' | 'fail' =
    s.collisions === 0 && s.doubleSendsToSameEmail === 0 ? 'ok'
    : s.doubleSendsToSameEmail > 0 ? 'fail' : 'warn';
  const usVerdict: 'ok' | 'warn' | 'fail' =
    s.postSuppressionLeaks > 0 ? 'fail'
    : s.snoozesEntered > 0 || s.emailsSkippedSuppressed > 0 ? 'ok' : 'warn';
  const repVerdict: 'ok' | 'warn' | 'fail' =
    s.bounceRate >= 0.05 || s.complaintRate >= 0.001 ? 'fail'
    : s.daysExceededCap > 0 ? 'warn' : 'ok';
  const tplVerdict: 'ok' | 'warn' | 'fail' =
    s.mockupNoTemplateEvents > 0 ? 'warn' : 'ok';

  const headlineClass = s.lock === 'none' && ffVerdict === 'fail' ? 'fail'
    : s.collisions === 0 && s.bounceRate < 0.05 ? 'ok' : '';

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Sim Report — lock=${escapeHtml(s.lock)}</title>
<style>${styles()}</style></head><body>

<h1>Rescue-Websites Simulator — Report</h1>
<div class="meta">Lock strategy: <strong>${escapeHtml(s.lock)}</strong> &nbsp;·&nbsp; Tenants: ${escapeHtml(meta.tenants.join(', '))} &nbsp;·&nbsp; Days: ${meta.days} &nbsp;·&nbsp; Cap: ${meta.interactions} &nbsp;·&nbsp; Seed: ${meta.seed}</div>
<div class="headline ${headlineClass}">${escapeHtml(s.headline)}</div>

<h2>The three blindspots</h2>
<div class="grid">
${blindspotCard('1. Friendly Fire', ffVerdict, `
  <div><strong>${s.collisions}</strong> place_ids successfully <em>claimed</em> by &gt; 1 tenant.</div>
  <div><strong>${s.doubleSendsToSameEmail}</strong> email addresses targeted by &gt; 1 tenant.</div>
  <div style="color:#666;margin-top:4px"><strong>${s.discoveryContention}</strong> place_ids <em>attempted</em> by &gt; 1 tenant (informational — normal with overlap territories).</div>
  ${ffVerdict === 'fail' ? '<div style="color:#b00020;margin-top:6px"><em>Same business owner is receiving outreach from multiple TAG senders. Apply migration 001.</em></div>' : ''}
`)}
${blindspotCard('2. Unsubscribe / Snooze', usVerdict, `
  <div><strong>${s.hardSuppressions}</strong> hard suppressions added.</div>
  <div><strong>${s.snoozesEntered}</strong> snoozes entered, <strong>${s.snoozesWoken}</strong> woken.</div>
  <div><strong>${s.emailsSkippedSuppressed}</strong> sends correctly blocked by suppression.</div>
  <div><strong>${s.postSuppressionLeaks}</strong> sends LEAKED through suppression list.</div>
`)}
${blindspotCard('3. Reputation Burn', repVerdict, `
  <div><strong>${s.totalSends}</strong> sends total &nbsp; · &nbsp; bounce rate <strong>${fmtPct(s.bounceRate)}</strong> &nbsp; · &nbsp; complaint rate <strong>${fmtPct(s.complaintRate)}</strong></div>
  <div><strong>${s.daysExceededCap}</strong> day×domain combos hit the warm-up cap.</div>
  ${s.bounceRate >= 0.05 ? '<div style="color:#b00020;margin-top:6px"><em>Resend would warn at &gt;5% bounce rate.</em></div>' : ''}
`)}
</div>

<h2>4th blindspot: Vertical without templates</h2>
${blindspotCard('Mockup blocked at step 4', tplVerdict, `
  <div><strong>${s.mockupNoTemplateEvents}</strong> businesses dropped because their vertical has no built mockup templates.</div>
  ${s.mockupNoTemplateEvents > 0 ? `<div style="margin-top:6px">Per vertical:</div>${dictTable(s.noTemplateByVertical, 'Vertical', 'Drops')}` : ''}
`)}

<h2>Per-tenant funnel</h2>
${funnelTable(s.funnelByTenant)}

<h2>Reputation: peak daily sends per from-domain</h2>
${quotaTable(s.peakDailySendsByDomain)}

<h2>Email outcome distribution</h2>
${dictTable(s.emailOutcomes, 'Outcome', 'Count')}

<h2>Friendly-fire by (zip, vertical)</h2>
${dictTable(s.collisionsByZipVertical, 'zip|vertical', 'Collision events')}

<h2>CRM spec: observed state transitions</h2>
<p>Every (action, prev → new) tuple seen during this run. The CRM must support all of these as first-class state changes.</p>
${transitionList(s.observedTransitions)}

<h2>Run totals</h2>
<table><tbody>
<tr><td>Total events</td><td class="num">${s.totalEvents}</td></tr>
<tr><td>Unique place_ids touched</td><td class="num">${s.uniquePlaceIds}</td></tr>
<tr><td>Total sends</td><td class="num">${s.totalSends}</td></tr>
<tr><td>Total bounces</td><td class="num">${s.totalBounces}</td></tr>
<tr><td>Total complaints</td><td class="num">${s.totalComplaints}</td></tr>
<tr><td>Sends skipped (suppression)</td><td class="num">${s.emailsSkippedSuppressed}</td></tr>
<tr><td>Sends skipped (quota)</td><td class="num">${s.emailsSkippedQuota}</td></tr>
</tbody></table>

</body></html>`;
}

export function renderComparisonReport(summaries: AnalyzerSummary[], meta: RunMeta): string {
  const sorted = [...summaries].sort((a, b) => a.lock.localeCompare(b.lock));
  const cols = sorted.map(s => `<th>${escapeHtml(s.lock)}</th>`).join('');
  const row = (label: string, fn: (s: AnalyzerSummary) => string) =>
    `<tr><td>${escapeHtml(label)}</td>${sorted.map(s => `<td class="num">${fn(s)}</td>`).join('')}</tr>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Sim Comparison — lock strategies</title>
<style>${styles()}</style></head><body>

<h1>Rescue-Websites Simulator — Lock Strategy Comparison</h1>
<div class="meta">Tenants: ${escapeHtml(meta.tenants.join(', '))} &nbsp;·&nbsp; Days: ${meta.days} &nbsp;·&nbsp; Cap: ${meta.interactions} &nbsp;·&nbsp; Seed: ${meta.seed}</div>

<h2>Blindspots side-by-side</h2>
<table><thead><tr><th>Metric</th>${cols}</tr></thead><tbody>
${row('Place_ids CLAIMED by > 1 tenant (friendly fire)', s => String(s.collisions))}
${row('Place_ids ATTEMPTED by > 1 tenant (contention)', s => String(s.discoveryContention))}
${row('Email addresses double-targeted', s => String(s.doubleSendsToSameEmail))}
${row('Post-suppression leaks', s => String(s.postSuppressionLeaks))}
${row('Hard suppressions added', s => String(s.hardSuppressions))}
${row('Sends correctly blocked', s => String(s.emailsSkippedSuppressed))}
${row('Snoozes entered', s => String(s.snoozesEntered))}
${row('Snoozes woken', s => String(s.snoozesWoken))}
${row('Total sends', s => String(s.totalSends))}
${row('Bounce rate', s => fmtPct(s.bounceRate))}
${row('Complaint rate', s => fmtPct(s.complaintRate))}
${row('Day×domain over cap', s => String(s.daysExceededCap))}
${row('Mockup no-template drops', s => String(s.mockupNoTemplateEvents))}
${row('Total events', s => String(s.totalEvents))}
${row('Unique place_ids touched', s => String(s.uniquePlaceIds))}
</tbody></table>

<h2>Per-strategy headlines</h2>
<ul>
${sorted.map(s => `<li><strong>${escapeHtml(s.lock)}:</strong> ${escapeHtml(s.headline)}</li>`).join('')}
</ul>

<p style="margin-top:24px;color:#666;font-size:12px">Open each strategy's full report at <code>./&lt;strategy&gt;/report.html</code>.</p>
</body></html>`;
}
