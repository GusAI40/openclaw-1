// Append-only JSONL event ledger.
//
// One file per simulator run. Every state transition writes one
// line. Reading is `for each line: JSON.parse`. No DB, no schema
// migration, no partial-write recovery — just a flat log we
// post-process with the analyzer.

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type Severity = 'info' | 'warn' | 'error';

export type Action =
  | 'discover_attempt'
  | 'discover_won'
  | 'discover_lost'         // friendly fire: another tenant already claimed
  | 'discover_collision'    // discovered same place_id multiple tenants would have wanted
  | 'audit'
  | 'audit_no_email'        // contact email not extractable
  | 'mockup_generated'
  | 'mockup_no_template'    // vertical has no built templates
  | 'deploy_success'
  | 'deploy_failure'
  | 'email_send'
  | 'email_skipped_suppressed'
  | 'email_skipped_quota'
  | 'email_bounce'
  | 'email_reply'
  | 'email_unsub'
  | 'email_snooze'
  | 'email_complaint'
  | 'snooze_woken'
  | 'sequence_exhausted'
  | 'tenant_day_summary';

export interface Event {
  ts: string;              // wall-clock when the event was recorded (ISO)
  sim_day: number;         // simulated day index (0-based)
  sim_ts: string;          // simulated wall-clock (ISO)
  tenant_id: string;
  business_id: string;     // 'n/a' for tenant-level events
  vertical?: string;
  zip?: string;
  action: Action;
  prev_state?: string;
  new_state?: string;
  outcome?: string;
  severity: Severity;
  lock_strategy?: 'none' | 'advisory' | 'race';
  details?: Record<string, unknown>;
}

export class Ledger {
  private path: string;
  private buffer: string[] = [];
  private bufferSize = 0;
  private readonly flushAt = 64 * 1024; // flush every 64KB

  constructor(filepath: string) {
    this.path = filepath;
    mkdirSync(dirname(filepath), { recursive: true });
    if (!existsSync(filepath)) writeFileSync(filepath, '');
  }

  write(event: Event): void {
    const line = JSON.stringify(event) + '\n';
    this.buffer.push(line);
    this.bufferSize += line.length;
    if (this.bufferSize >= this.flushAt) this.flush();
  }

  flush(): void {
    if (this.buffer.length === 0) return;
    appendFileSync(this.path, this.buffer.join(''));
    this.buffer = [];
    this.bufferSize = 0;
  }

  close(): void {
    this.flush();
  }

  filepath(): string {
    return this.path;
  }
}

// Convenience: build the simulated-clock ISO string from a day index.
export function simIso(epochMs: number, dayIndex: number, hourOfDay = 9): string {
  const ms = epochMs + dayIndex * 86_400_000 + hourOfDay * 3_600_000;
  return new Date(ms).toISOString();
}
