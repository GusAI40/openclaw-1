// CLI entry. Parses flags, spins up one Simulator per requested
// lock strategy, drives the day-by-day loop, then hands off to
// the analyzer and reporter.

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Rng } from './distributions.ts';
import { Ledger } from './ledger.ts';
import { Simulator, type LockStrategy } from './pipeline-mock.ts';
import { tenantById, type TenantConfig } from './tenants.ts';
import { analyze } from './analyzer.ts';
import { renderHtmlReport, renderComparisonReport } from './report.ts';

interface CliOpts {
  interactions: number;
  tenants: string[];
  industries: string[]; // currently informational; territories are baked into tenants.ts
  days: number;
  locks: LockStrategy[];
  seed: number;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {
    interactions: 100,
    tenants: ['gus', 'julian'],
    industries: ['dentistry', 'construction'],
    days: 90,
    locks: ['none'],
    seed: 1,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    switch (flag) {
      case '--interactions': opts.interactions = parseInt(val!, 10); i++; break;
      case '--tenants':      opts.tenants = val!.split(','); i++; break;
      case '--industries':   opts.industries = val!.split(','); i++; break;
      case '--days':         opts.days = parseInt(val!, 10); i++; break;
      case '--lock':         opts.locks = val === 'all' ? ['none', 'advisory', 'race'] : [val as LockStrategy]; i++; break;
      case '--seed':         opts.seed = parseInt(val!, 10); i++; break;
      case '--help': case '-h':
        printHelp(); process.exit(0);
      default:
        if (flag?.startsWith('--')) { console.error(`Unknown flag: ${flag}`); process.exit(2); }
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: tsx src/run.ts [flags]
  --interactions <N>   Total discover_won cap across all tenants (default: 100)
  --tenants <list>     Comma-separated tenant ids (default: gus,julian)
  --industries <list>  Informational; territories are baked into tenants.ts
  --days <N>           Simulated days to run (default: 90)
  --lock <strategy>    none | advisory | race | all  (default: none)
  --seed <N>           RNG seed (default: 1)
`);
}

function runId(seed: number): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
  return `${ts}-seed${seed}`;
}

interface SubrunArtifacts {
  lock: LockStrategy;
  ledgerPath: string;
  summaryPath: string;
  reportPath: string;
}

function runOne(
  lock: LockStrategy,
  tenants: TenantConfig[],
  opts: CliOpts,
  parentDir: string,
): SubrunArtifacts {
  const subdir = join(parentDir, lock);
  mkdirSync(subdir, { recursive: true });
  const ledgerPath = join(subdir, 'events.jsonl');
  const summaryPath = join(subdir, 'summary.json');
  const reportPath = join(subdir, 'report.html');

  const ledger = new Ledger(ledgerPath);
  const rng = new Rng(opts.seed);
  const sim = new Simulator({ ledger, rng, lockStrategy: lock });

  const cap = opts.interactions;

  for (let day = 0; day < opts.days; day++) {
    if (sim.countDiscoveredInteractions() < cap) {
      for (const tenant of tenants) {
        if (sim.countDiscoveredInteractions() >= cap) break;
        if (day % tenant.discoverEveryDays === 0) {
          sim.runDiscoverBatch(tenant, day);
        }
      }
    }
    sim.processSnoozeQueue(day);
    sim.processScheduledSends(day, tenants);
  }

  ledger.close();
  const summary = analyze(ledgerPath, lock);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  writeFileSync(reportPath, renderHtmlReport(summary, opts));

  console.log(`[${lock}] interactions=${sim.countDiscoveredInteractions()}  events_path=${ledgerPath}`);
  console.log(`[${lock}]   ${summary.headline}`);
  return { lock, ledgerPath, summaryPath, reportPath };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const tenants = opts.tenants.map(tenantById);

  const parentDir = join(process.cwd(), 'sim-runs', runId(opts.seed));
  mkdirSync(parentDir, { recursive: true });

  console.log(`Run dir: ${parentDir}`);
  console.log(`Tenants: ${opts.tenants.join(', ')}  | Days: ${opts.days}  | Cap: ${opts.interactions}  | Lock(s): ${opts.locks.join(', ')}  | Seed: ${opts.seed}`);
  console.log('');

  const subruns: SubrunArtifacts[] = [];
  for (const lock of opts.locks) {
    subruns.push(runOne(lock, tenants, opts, parentDir));
  }

  if (subruns.length > 1) {
    const summaries = subruns.map(s => JSON.parse(readFileSync(s.summaryPath, 'utf8')));
    const comparePath = join(parentDir, 'compare.html');
    writeFileSync(comparePath, renderComparisonReport(summaries, opts));
    console.log('');
    console.log(`Comparison: ${comparePath}`);
  }
}

main();
