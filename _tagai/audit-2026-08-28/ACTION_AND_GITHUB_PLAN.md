# Recommended Action Plan And GitHub Update Plan

Audit date: 2026-08-28

The order below is business-first: protect access, keep revenue systems online, then make the system easier to sell and operate.

## P0 - Same Day, Blocks A+++

1. Rotate exposed credentials.

   Rotate/revoke the Vercel PAT, Supabase PAT, GitHub PAT, and any provider tokens that were pasted into chat or found as plaintext in audits. Update only approved secret stores after rotation.

2. Harden SSH without locking out the operator.

   Open a second live SSH session or use Hetzner console as fallback. Confirm the sudo user works. Validate the SSH config with `sshd -t`. Then disable password auth and root login, reload SSH, and retest login.

3. Fix Julian permissions.

   Set Julian OpenClaw config to owner-read/write only and credentials directory to owner-only. Rerun `openclaw security audit --json` inside the Julian container.

4. Resolve OpenClaw secrets audits.

   Use `openclaw secrets audit --check --json` as the scoreboard. Move plaintext secrets into the supported secret flow, resolve missing Discord token references or disable unused channels, then rerun.

5. Apply security updates.

   Snapshot or backup first. Upgrade APT packages, including Caddy, Docker, containerd, AppArmor, PAM, Node, Python, and security packages. Restart services and reboot if required.

6. Remove risky public Caddy routes.

   Remove or lock down the direct IP route. Normalize Caddy response headers for all public domains. Remove redundant `header_up` lines. Run Caddy validate, format, reload, and public header probes.

7. Tighten private service bindings.

   Bind internal Node/Python services to `127.0.0.1` or private Docker networks unless they are intentionally public.

## P1 - This Week

1. Reconcile production repo drift.

   Compare live `/home/tagai/openclaw` drift against GitHub. Commit intentional server changes in a reviewed branch. Remove or archive stale untracked deployment backups outside the repo.

2. Enable dependency security automation.

   Enable GitHub Dependabot security updates on `GusAI40/openclaw-1`, or document a scheduled dependency patch lane that produces equivalent evidence.

3. Prove backups.

   Run a restore drill from the latest backup. Verify local backup, encrypted GitHub copy, key custody, and recovery time. Store the proof in `_tagai/monitoring/`.

4. Container hardening pass.

   Evaluate Docker rootless mode or user namespace remap. Add resource limits, read-only filesystem where possible, cap drops, and explicit healthchecks per container.

5. Define model risk tiers.

   Create a simple policy: low-risk jobs can use cheaper models; tools, outbound messaging, customer data, or untrusted input require stronger models and tighter tool allowlists.

## P2 - Revenue Acceleration

1. Close the lead-to-cash loop.

   Connect lead capture, audit generation, outreach, follow-up, CRM handoff, payment link, and onboarding status into one traceable path.

2. Productize tenant onboarding.

   Turn `_tagai/bootstrap/` and `_tagai/business-box/` into a strict paid-tenant checklist: intake, environment, domain, Caddy route, model policy, secrets, backup, healthcheck, support handoff.

3. Add business dashboards.

   Track leads found, audits generated, replies received, demos booked, customers closed, time saved, and monthly recurring revenue.

4. Run visual QA.

   The UI and app surfaces need a separate screenshot/device QA pass. This audit focused on repo, VPS, docs, and security posture.

## GitHub Update Plan Completed In This Pass

Files to add:

- `_tagai/audit-2026-08-28/README.md`
- `_tagai/audit-2026-08-28/REPO_VISUAL_MAP.md`
- `_tagai/audit-2026-08-28/TECHNICAL_ARCHITECTURE.md`
- `_tagai/audit-2026-08-28/PROVIDER_VALIDATION.md`
- `_tagai/audit-2026-08-28/REVENUE_FLOW.md`
- `_tagai/audit-2026-08-28/RISK_REGISTER.md`
- `_tagai/audit-2026-08-28/ACTION_AND_GITHUB_PLAN.md`
- `_tagai/audit-2026-08-28/GITHUB_SYNC_REPORT.md`

Files to update:

- `_tagai/README.md`

Files intentionally not touched:

- Runtime code under `src/`, `extensions/`, `packages/`, `ui/`, or `apps/`.
- Live server files.
- Environment files or provider credentials.
- The unrelated untracked file `docs/ARIBA_STATE_SNAPSHOT.json`.

## Suggested README Content

This is the content pattern now used in `_tagai/README.md`:

```md
Latest enterprise VPS and repo audit:

- `_tagai/audit-2026-08-28/README.md`
- `_tagai/audit-2026-08-28/REPO_VISUAL_MAP.md`
- `_tagai/audit-2026-08-28/TECHNICAL_ARCHITECTURE.md`
- `_tagai/audit-2026-08-28/PROVIDER_VALIDATION.md`
- `_tagai/audit-2026-08-28/REVENUE_FLOW.md`
- `_tagai/audit-2026-08-28/RISK_REGISTER.md`
- `_tagai/audit-2026-08-28/ACTION_AND_GITHUB_PLAN.md`
- `_tagai/audit-2026-08-28/GITHUB_SYNC_REPORT.md`

Plain-English summary: the repo is the OpenClaw/Jarvis AI city; the VPS is live and mostly contained by firewall/Caddy, but it is not A+++ until SSH, secrets, security updates, Caddy routes, Julian permissions, backups, and production drift are remediated and rechecked.
```

## Clone Link

Fork clone URL:

```text
https://github.com/GusAI40/openclaw-1.git
```
