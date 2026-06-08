# Risk Register — Delta 2026-06-08

**Scope:** TAG-owned layers (`_tagai/`, active firecrawl work, business-box). Builds on `_tagai/audit-2026-05-27/RISK_REGISTER.md` — read that for full history. This doc re-statuses the open risks and adds what's new since 05-29.

Severity: **Critical** (active outage / silent revenue loss) · **High** (one incident away) · **Medium** (drift) · **Low** (cleanup).

---

## New since the 05-29 audit

### R-17 — Firecrawl Agent start-endpoint may not match the async contract — **High** (needs live verification)

- **What.** New uncommitted code POSTs to `POST /v2/agent` but treats it as the async "start → poll → fetch" pattern. Live docs also document `POST /v2/agent/start` as the async variant. If `/v2/agent` is synchronous, the 60s default start-timeout will kill multi-minute agent jobs after credits are already spent.
- **Cost.** Paid-for jobs that time out and return nothing; an agent that thinks it has a job ticket that the endpoint never issued.
- **Fix.** One live test with a real `fc-` key. Point start at `/v2/agent/start` if that's the async path; raise start-timeout to a realistic agent runtime. Add the live behavior to `firecrawl.md`.
- **Reference.** `_tagai/audit-2026-06-08/PROVIDER_VALIDATION.md` Conflict 1.

### R-18 — `firecrawl_agent` has no built-in credit cap — **Medium**

- **What.** `maxCredits` is optional; when omitted, Firecrawl applies its **server default of 2,500 credits**. An autonomous agent can call this tool unsupervised.
- **Cost.** A runaway agent loop can drain the Firecrawl balance one 2,500-credit job at a time, silently.
- **Fix.** Set a conservative client-side default (e.g. 100–250) and require an explicit override to go higher.
- **Reference.** PROVIDER_VALIDATION Conflict 2.

### R-19 — Firecrawl Agent work is uncommitted on `tagai-main` — **Low** (process)

- **What.** `firecrawl-agent-tools.ts` (new), plus diffs to `index.ts`, `config.ts`, `firecrawl-client.ts`, `openclaw.plugin.json`, `docs/tools/firecrawl.md`, and a 181-line test block — all unstaged. 29/29 firecrawl tests pass locally.
- **Cost.** Good work that's one `git stash` accident away from being lost; also touches an **upstream** file (`extensions/firecrawl/`), so it must be a clean, upstream-quality commit (the repo's rule: only modify upstream files when contributing back).
- **Fix.** Commit it via `scripts/committer` once R-17 is settled. Decide: contribute upstream, or keep as a TAG patch. If it's TAG-only, that's a standing rebase-conflict surface to track.

---

## Re-status of prior open risks

| ID | Title | 05-29 status | **06-08 status** | Note |
|---|---|---|---|---|
| R-5 | Single-VPS, no warm standby | High, open | **High, partially mitigated** | Paid preflight now checks backup existence + tar validity + sqlite integrity + age key. Still no warm standby / no full restore drill. |
| R-7 | Device-pair auto-approve = single-factor | High, open | **High, guarded not fixed** | `preflight-paid-tenant.sh` now **warns** if the auto-approve cron is present before a paid deploy. Root cause (no real per-device challenge) still unsolved — warn ≠ block. |
| R-3 | Schema clobber on image upgrade | Medium, open | **Medium, open** | Unchanged. Still relies on operator pre-flight discipline. |
| R-11 | Stale `rescue-patch-2026-05-12/` | Medium, open | **Medium, still open** | Directory still present (`src/`, smoke/test mjs). No README of intent. |
| R-12 | Duplicate webhook handlers | Low, open | **Resolved (uncommitted)** | `webhook-handler.mjs` deleted in working tree; only `webhook-handler-current.mjs` remains. Commit the deletion. |
| R-14 | Coolify/Traefik in `.env.tagai.example` | Low, open | **Low, mostly fixed** | Top now carries the correct "Caddy + plain compose, no Coolify/Traefik" disclaimer. But **line 120 still says "Set them in Coolify's"** — one stale line left. |
| R-15 | Multiple `diag-telegram*.sh` | Low, open | **Resolved** | v1–v3 moved to `_tagai/archive/`, v4 kept as canonical. Exactly the prescribed fix. |
| R-16 | Orphaned Maya files | Low, open | **Low, still open** | `maya-human-sim.sh`, `maya-test-harness.py`, `patch-maya-tools.py` still in `_tagai/`. Belong in `voice-agent-demo`. |
| R-13 follow-up | Restrict Google key by 2026-06-19 | open | **OPEN — deadline in 11 days** | Restrict the Gemini key to the Generative Language API before **2026-06-19** or it gets auto-blocked like the old one. |

---

## Severity rollup (06-08)

| Severity | Open IDs |
|---|---|
| Critical | none |
| High | R-5, R-7, R-17 |
| Medium | R-3, R-11, R-18 |
| Low | R-14 (1 line), R-16, R-19 |
| Resolved since 05-29 | R-12, R-15 |

## Highest-leverage next actions, ranked

1. **R-13 follow-up — restrict the Google/Gemini key before 2026-06-19** (hard deadline, 11 days out; silent image/video outage if missed). ~10 min.
2. **R-17 — live-test the Firecrawl Agent start path** before committing/relying on it. ~20 min with a key.
3. **R-7 — replace auto-approve cron with a real per-device challenge.** This is still the gate that blocks selling paid Jarvis seats. The preflight warn buys safety; it doesn't unlock the product.
4. **R-5 — run one backup-restore drill** to a throwaway VPS. The preflight proves backups *exist and are valid*; it doesn't prove you can *restore* one in under an hour.
5. **Cleanup sweep** — commit R-12 deletion, fix R-14 line 120, resolve R-11 + R-16, commit R-19.
