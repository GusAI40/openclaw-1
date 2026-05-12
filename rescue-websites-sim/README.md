# rescue-websites-sim

Pure-mock simulator for the [rescue-websites](https://github.com/GusAI40/rescue-websites) outbound pipeline.

**Goal:** surface three blindspots before any live send, and produce data that informs the TAG-AI CRM design.

1. **Friendly Fire** — Gus + Julian share a Supabase project. Without tenant isolation, both can run discovery against the same ZIP+vertical and double-email the same business owner from the same `ubntag.com` domain.
2. **Unsubscribe vs Snooze** — Hard "stop" requests must persist forever (CAN-SPAM, GDPR). Soft "email me next Tuesday" is a defer, not a kill. The pipeline currently has no schema for either.
3. **Reputation Burn** — All outbound traffic shares one sender domain. A 1,000-email blast in week one would torch deliverability for every TAG service that mails from `ubntag.com`.

## What this simulator does NOT do

- Hit any real APIs. Google Places, Firecrawl, Resend, Cloudflare are all mocked.
- Touch the real Supabase project. The simulator's "DB" is in-memory + a JSONL ledger on disk.
- Modify the upstream `rescue-websites` code. The simulator mirrors the conceptual pipeline (7 steps, 7-part email sequence) without importing from it.

## Quickstart

```bash
npm install
npm run sim:smoke    # 10 interactions, 1 tenant, 1 vertical, 30 days
npm run sim:full     # 1000 interactions, 2 tenants, 5 verticals, 90 days, all 3 lock strategies
```

After a run, the artifact lives at `sim-runs/<run-id>/`:

```
sim-runs/2026-05-13T18-22-04Z-seed42/
├── events.jsonl   # every state transition, append-only
├── summary.json   # analyzer output: collisions, double-sends, etc.
└── report.html    # human-readable report (open in a browser)
```

## CLI flags

| Flag | Default | Notes |
|---|---|---|
| `--interactions <N>` | 100 | Number of business discoveries to attempt across all tenants |
| `--tenants <list>` | `gus,julian` | Comma-separated tenant ids |
| `--industries <list>` | `dentistry,construction` | Industries to draw from |
| `--days <N>` | 90 | Simulated days to run |
| `--lock <strategy>` | `none` | `none`, `advisory`, `race`, or `all` (run all three and compare) |
| `--seed <N>` | 1 | RNG seed for deterministic replay |

## Design

See `migrations/001-add-tenant-isolation.sql` for the proposed schema this simulator validates. The migration is **NOT applied to Supabase** until the simulator signs off.

The simulator is intentionally standalone — no dependency on the upstream `rescue-websites` source tree. This means:
- Upstream pipeline changes don't break the simulator.
- The simulator can model schema/state-machine designs that don't exist in upstream yet.
- The simulator can be deleted (or rewritten in another language) without touching the pipeline.

The trade-off: the conceptual pipeline (7 steps, 7-part email cadence) is hand-mirrored from the upstream README. If upstream re-orders steps, the simulator drifts. That's an acceptable cost for a design-stage tool.
