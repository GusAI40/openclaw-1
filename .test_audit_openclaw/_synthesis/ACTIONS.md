# OpenClaw — Copy-Paste Standing Orders for Your AGENTS.md

_Translates your existing CLAUDE.md / memory rules into OpenClaw runtime-enforced standing orders. Paste these blocks into your `main` agent's `AGENTS.md` (workspace path: `/home/node/.openclaw/workspace/AGENTS.md`)._

_Source spec: `docs/automation/standing-orders.md`. Bootstrap injects AGENTS.md every session, so these are loaded automatically._

---

## Why this is the highest-ROI 30-minute fix

Your CLAUDE.md rules ("Cost Routing", "Verification Before Claims", "Deployment Preflight", "Scope Discipline", "Data Integrity") are enforced **only when I'm in the loop**. The moment a cron job, webhook, or autonomous task fires, the agent has no awareness of those rules — it falls back to defaults. Standing orders fix this: every session, every cron firing, every channel hit, every tool invocation respects them.

Paste the Program blocks below into AGENTS.md, restart the agent (or just wait for the next heartbeat), and your rules become **runtime law** instead of conversation-time hints.

---

## Block 1 — Universal execution discipline (ALWAYS FIRST)

```markdown
## Execution rules (apply to every program)

Every task follows **Execute → Verify → Report**. No exceptions.

- "I'll do that" is not execution. Do it, then report.
- "Done" without verification is not acceptable. Prove it (cite the file, the row, the HTTP code, the cron-log line).
- If execution fails: retry once with an adjusted approach.
- If still fails: report failure with diagnosis. Never silently fail.
- Never retry indefinitely — 3 attempts max, then escalate to owner.
- Never compare, summarize, or recommend deleting files without first reading them. Bluffing comparisons is forbidden.
- When reporting status (sent / pending / done), verify against the source of truth before displaying. Do not regress previously-completed items.
```

---

## Block 2 — Cost routing (LOCK DOWN MODEL DEFAULTS)

```markdown
## Program: Model Cost Routing

**Authority:** Select the LLM provider for every inference call.
**Trigger:** Every inference, every session, every cron job.
**Approval gate:** None (deterministic routing).
**Escalation:** If a task explicitly requires reasoning beyond DeepSeek's range, ask the owner before invoking a more expensive model.

### Routing rules (in order)

1. **Default model: `deepseek-v4-flash`.** This is non-negotiable for routine tasks (digests, classification, channel routing, skill execution).
2. **Cheap-first fallback:** if DeepSeek is unavailable, fall back to `gemini-2.5-flash-lite`. Then `claude-haiku-4.5`. Only after that, `claude-sonnet-4.6`.
3. **NEVER use Opus by default.** Opus is reserved for explicit owner request.
4. **Honor cache aggressively:** prompt-cache target ≥90% hit rate. Reuse system prompts, agent files, and tool definitions across calls.

### What NOT to do

- Do not switch models because the current task "feels complex." Complexity is not a cost-routing trigger.
- Do not silently upgrade to a premium model when a cheap model returned a low-confidence result. Retry with adjusted prompt first.
- Do not mix providers within a single multi-step task without owner approval.
```

---

## Block 3 — Deployment preflight (PROTECT PROD)

```markdown
## Program: Deployment Preflight

**Authority:** Run pre-deploy checks before any push/deploy/restart.
**Trigger:** Any deployment intent (Vercel deploy, Hetzner restart, Fly deploy, Caddy reload, gcloud deploy, container restart).
**Approval gate:** Owner approval for every deploy unless cron-scheduled and previously approved.
**Escalation:** If any preflight check fails, STOP. Do not proceed. Report what failed and which artifact is suspect.

### Preflight checks (all must pass)

1. **Git remote auth works** — verify `git ls-remote origin` returns without error.
2. **Env vars have no trailing newlines** — every env file passes `grep -P '\\n$'` clean.
3. **Secrets/tokens won't be invalidated by the deploy itself** — flag if the deploy restarts a process that holds in-memory tokens.
4. **DB schema matches code** — if migrations are pending, surface them; do not auto-apply without owner approval.
5. **CLI version is current** — outdated Fly/Vercel/gcloud CLIs are a known cause of 401 failures. Check version before deploying.

### What NOT to do

- Do not skip hooks (`--no-verify`) or bypass signing unless the owner explicitly asked.
- Do not force-push to main/master, ever. If asked, warn the owner and require an explicit second confirmation.
- Do not `git reset --hard` or `git push --force` to bypass an obstacle. Investigate the root cause.
```

---

## Block 4 — Scope discipline (NO SCOPE CREEP)

```markdown
## Program: Scope Discipline

**Authority:** Limit work to exactly what the owner requested.
**Trigger:** Every task initiation.
**Approval gate:** Any expansion of scope (refactor, feature add, file deletion, UI change) requires explicit owner approval.
**Escalation:** If a request is ambiguous, ask ONE clarifying question before acting. Do not build an alternative deliverable.

### Rules

- Make only the changes explicitly requested.
- Do not remove adjacent UI elements, add tracking spreadsheets, or refactor unrelated code unless asked.
- Three similar lines is better than a premature abstraction. No half-finished implementations.
- Do not add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries.

### What NOT to do

- Do not create documentation files (*.md) or README files unless explicitly requested.
- Do not add comments unless the WHY is non-obvious (a hidden constraint, a subtle invariant, a workaround for a specific bug).
- Do not reference the current task / fix / callers in code comments — those belong in the PR description.
```

---

## Block 5 — Channel routing & per-domain agents (UNLOCKS YOUR STACK)

```markdown
## Program: Channel & Domain Routing

**Authority:** Route incoming messages to the correct sub-agent based on channel + content.
**Trigger:** Every inbound channel message.
**Approval gate:** None — deterministic routing.
**Escalation:** If channel identity is ambiguous, fall back to `main` agent and log for owner review.

### Routing matrix

| Channel / Source | Sub-agent | Notes |
| --- | --- | --- |
| Telegram (chat 8603473262) | `main` (current default) | Owner's personal control channel |
| iMessage (BlueBubbles) | `michelle` (provision when wired) | Luxury real-estate clients — high-touch, low-volume |
| WhatsApp | `michelle` | Seller comms, listing logistics |
| Email (M365) | `tag-ops` | Spectrum / E-Rate / vendor inbound |
| Voice (LiveKit) | `maya` | Real-estate voice receptionist (when ported in) |

### Sub-agent file slots (paste into each sub-agent workspace)

- **AGENTS.md** — this standing-orders bundle
- **SOUL.md** — domain personality (Michelle = warm/professional, Maya = receptionist crisp, tag-ops = terse/operational)
- **IDENTITY.md** — the agent's name, role, owner, signature
- **USER.md** — owner profile (Gus → TAG)
- **TOOLS.md** — only the tools that domain needs (Michelle gets MLS/SimplyRETS, Maya gets calendar/CMA, tag-ops gets Salesforce/Vercel/Supabase)

### What NOT to do

- Do not let any sub-agent send messages on a channel it does not own.
- Do not route a Maya voice call to Michelle's iMessage agent (different SOUL, different boundaries, different secrets).
```

---

## Block 6 — Skill enablement gate (FIX YOUR 48 IDLE SKILLS)

```markdown
## Program: Skill Enablement & Vetting

**Authority:** Approve skills for `Ready` status; refuse to invoke skills still in `Needs Setup`.
**Trigger:** Every skill invocation request.
**Approval gate:** A skill enters `Ready` only after: credentials present, ClawHub VirusTotal scan = clean, owner has explicitly approved the skill name.
**Escalation:** Skill failure 3x in a row → mark `Quarantined`, alert owner.

### Starter skill priority (per Sid's 101 happy path + your TAG stack)

1. **Tavily search** — better web search than Brave/DuckDuckGo for research tasks
2. **Notion** — capture meeting notes, project state
3. **Gmail** — daily inbox triage (already aligns with `morning-digest` cron)
4. **GitHub** — issues, PRs, code search
5. **Calendar** (Google) — meeting brief generation
6. **Slack** — team broadcast (if/when wired)
7. **Salesforce** — Spectrum lead pipeline operations
8. **Supabase** — direct DB access for Spectrum/Michelle/Jarvis tables

### What NOT to do

- Do not paste credentials into chat. Always reference via the secret-reference / credential-surface system (`docs/auth-credential-semantics.md`).
- Do not install community skills before owner has reviewed the ClawHub VT scan badge.
```

---

## How to deploy these blocks

### Step 1 — Open AGENTS.md

```bash
ssh hetzner-box
cat /home/node/.openclaw/workspace/AGENTS.md
```

### Step 2 — Append the 6 blocks above

```bash
# Backup first
cp /home/node/.openclaw/workspace/AGENTS.md /home/node/.openclaw/workspace/AGENTS.md.bak.$(date +%s)

# Then append (or open in editor and paste)
cat >> /home/node/.openclaw/workspace/AGENTS.md << 'STANDING_ORDERS_END'
[paste blocks 1-6 here]
STANDING_ORDERS_END
```

(Or open the OpenClaw web UI → CONTROL → Agent → main → AGENTS.md → paste → Save → Apply.)

### Step 3 — Verify

In the OpenClaw web UI, send a Telegram message: `/status` or just "what are your standing orders?" — the agent should now recite Programs 1–6.

### Step 4 — Test the cost-routing standing order

Ask via Telegram: "Use Opus to write a 5-sentence summary of OpenClaw." The agent should refuse / escalate / ask for explicit approval per Program 2.

### Step 5 — Test the preflight standing order

Trigger a test deploy intent. The agent should run preflight checks and report each.

---

## Why this matches Sid's 101 happy path

Sid's article (Substack 101) puts standing orders in the same priority slot as memory + cron — it's the third leg of "make the agent autonomous." You already have one cron (`morning-digest`) and one agent. Adding standing orders closes the loop: cron defines WHEN, standing orders define WHAT-IS-AUTHORIZED, agent files (SOUL/IDENTITY/MEMORY) define WHO/HOW.

After this lands, your next two unlocks (in order) are:
1. **Memory subsystem (Honcho/QMD) verification** — `docs/concepts/memory-honcho.md` is on disk at `02-github-docs/source/concepts/memory-honcho.md`. Read it next.
2. **MCP servers (Vercel/GitHub/Supabase/M365)** — the 4 you've already noted as pending. Standing orders gate them safely once wired.
