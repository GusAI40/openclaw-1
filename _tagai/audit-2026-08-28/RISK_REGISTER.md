# Risk Register

Audit date: 2026-08-28

Severity key:

- Critical: can expose accounts, secrets, customer data, production access, or live revenue systems.
- High: can break production, block delivery, or damage customer trust.
- Medium: creates operational drag or future failure risk.
- Low: documentation or polish issue.

## Critical Risks

| Risk | Evidence | Why it matters | Required fix |
| --- | --- | --- | --- |
| Pasted PATs and provider secrets | Vercel, Supabase, and GitHub tokens were pasted into chat earlier in this thread | Treat all pasted credentials as exposed | Rotate/revoke them in provider consoles before further production use. |
| SSH password auth enabled | Effective SSH config reports `passwordauthentication yes` | The VPS is receiving heavy SSH attack traffic | Move to key-only login after validating fallback access and `sshd -t`. |
| Root SSH allowed by key | Effective SSH config reports `permitrootlogin without-password` | Root should not be a normal remote entry point | Disable root login after confirming a sudo-capable user. |
| Julian config permissions unsafe | OpenClaw audit reports config file mode 664 and credentials dir mode 775 | Group/other writable config can become code execution or credential compromise | `chmod 600` config and `chmod 700` credentials dir, then rerun audit. |
| OpenClaw secrets unresolved | Gus: plaintext count 15, unresolved refs 1. Julian: plaintext count 9, unresolved refs 1 | Plaintext secrets and missing references block secure operations | Use `openclaw secrets configure/apply`, rotate exposed keys, resolve or disable missing refs. |
| Pending security updates | VPS reports 77 package updates, 9 security updates | Known fixed issues remain unpatched | Snapshot, upgrade, restart services, reboot if required, verify health. |
| Direct IP Caddy route | `http://87.99.148.242/` returns 200 with no security headers and CORS `*` | Bypasses the cleaner domain-based front door | Remove or lock the route behind auth/allowlist. |

## High Risks

| Risk | Evidence | Why it matters | Required fix |
| --- | --- | --- | --- |
| Internal services bind to all interfaces | Node on `*:3000`; Python on `0.0.0.0`/`[::]` for 8081/8085/8086 | UFW blocks them externally today, but a firewall mistake could expose them | Bind private services to `127.0.0.1` or container-only networks. |
| GitHub Dependabot security updates disabled | GitHub API reports disabled on `GusAI40/openclaw-1` | Known vulnerable dependency fixes will not open automatically | Enable Dependabot security updates or document a scheduled equivalent. |
| Production server repo drift | VPS `/home/tagai/openclaw` has modified `docker-compose.yml` and untracked deployment files | Live production may not be rebuildable from GitHub | Reconcile server changes into reviewed commits or document intentional drift. |
| Caddy header inconsistency | BrightSmile/Sterling lack HSTS/nosniff/frame headers; some routes duplicate headers | Public apps have inconsistent browser protections | Normalize Caddy snippets, validate, format, reload. |
| Wildcard CORS | `voiceai.ubntag.com` and direct IP route show CORS `*` | Can widen browser access beyond intended callers | Limit CORS to known domains unless there is a documented public API need. |
| Backup restore not freshly proven | Latest local backup exists and GitHub backup repo was pushed, but no fresh restore drill was performed in this pass | Untested backups are not business continuity | Run restore drill and store proof. |
| Backup private key locality risk | Backup key material exists on/near the host backup system | If host is compromised, backups may also be compromised | Store restore private key off-host with access controls. |
| Main model tier warning | Gus OpenClaw audit warns primary model `openai/gpt-4o-mini` is below preferred high-tier family | High-risk agent workflows may be underpowered | Set model tier policy by workflow risk and cost. |

## Medium Risks

| Risk | Evidence | Why it matters | Required fix |
| --- | --- | --- | --- |
| Swap pressure | 2.9GiB of 4.0GiB swap used | Memory pressure can slow or destabilize the gateway | Add memory limits, inspect container memory, clean old artifacts. |
| OpenClaw main container high CPU at snapshot | Docker stats showed Gus container around 104% CPU at one point | Could point to a busy or stuck worker | Correlate with logs and healthcheck history. |
| Backup top-level directory listable | `/home/tagai/.openclaw/backups` mode 755 | Directory metadata is unnecessarily exposed to local users | Change top-level backup dir to 700 unless sharing is required. |
| Caddy config formatting warnings | `caddy validate` warns config is not formatted and redundant `header_up` lines exist | Raises maintenance risk | Run format after planned Caddy changes. |
| Supabase live RLS not verified | Docs and skills are present, but live DB schema was not queried in this pass | Tenant data claims need database proof | Run Supabase advisors and schema/RLS checks with scoped credentials. |
| UI product QA not performed | This was infra/repo audit, not visual QA | Customer-facing polish may be unknown | Run browser/mobile screenshot pass separately. |

## Low Risks

| Risk | Evidence | Why it matters | Required fix |
| --- | --- | --- | --- |
| Many historical audit folders | `_tagai/audit-*` and state map files exist | Operators may open stale docs | Keep `_tagai/README.md` pointing to the latest audit. |
| Local untracked file unrelated to this audit | `docs/ARIBA_STATE_SNAPSHOT.json` is untracked | Could be accidentally committed by a broad add | Stage only this audit bundle and README. |

## A+++ Blocker Summary

The live system cannot receive an A+++ enterprise security grade until Critical risks are fixed and rechecked. Documentation alone can map the city, but it cannot make the doors lock.
