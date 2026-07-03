# Risk Register - 2026-07-02

| Risk | Severity | Evidence | Why it matters | Next fix |
| --- | --- | --- | --- | --- |
| Exposed tokens in chat | Critical | Vercel, Supabase, and GitHub PATs were pasted into the conversation | Treat as compromised secrets | Rotate all three tokens after this work window |
| `pnpm docs:list` package-manager blocker | Resolved | Baileys was upgraded from `7.0.0-rc.9` to `7.0.0-rc13`, moving `libsignal` from git to npm while keeping `blockExoticSubdeps` enabled | Required repo docs discovery now completes | Keep this gate in CI/local validation |
| pnpm settings drift | Resolved | pnpm settings were moved from the ignored `package.json` `pnpm` field into `pnpm-workspace.yaml` | Overrides, package extensions, peer rules, and build approvals now apply from the supported file | Watch future pnpm release notes before changing settings |
| Dirty worktree before audit | High | Many unrelated modified/deleted/untracked files already existed | A broad commit could mix unrelated code and docs | Stage/commit only scoped files |
| This repo is not a Vercel app | High | No `vercel.json`, no `vercel.ts`, no `next.config.*` | A "Vercel upgrade" here can only be docs/provider prep, not a deploy upgrade | Upgrade actual Vercel app repos separately |
| Adjacent Vercel projects not cloned here | High | Vercel account/project inventory exists, but source repos are separate | Cannot prove app-level Fluid/Workflow/Rolling Release changes from this repo alone | Audit each app repo one by one |
| Supabase grants and RLS must stay explicit | High | Supabase docs/changelog show explicit grants matter separately from RLS | Data can be inaccessible or overexposed | Migration template must include grants, RLS, and policies together |
| Sender domain reputation risk | High | Existing rescue docs call out shared sender-domain risk | A bad blast can damage all TAG outreach | Separate domains, warm-up plans, send ledger, suppression list |
| Microsoft Graph app-only mailbox risk | High | MCP server uses app-only auth and mailbox `user` argument | Wrong tenant/user can send from wrong mailbox | Tenant-specific app registrations or strict mailbox mapping |
| Firecrawl work is dirty | Medium | Multiple `extensions/firecrawl/*` files modified/untracked | Provider behavior could be half-upgraded | Separate Firecrawl PR with SDK-doc validation |
| Julian scratch files | Medium | Recovery docs say some files remained uncommitted intentionally | Real deliverables can be missed if not reviewed | Review only the four real-looking deliverables |
| Docs and audits split across folders | Medium | `_tagai/audit-*`, `_tagai/julian-*`, `_tagai/STATE_CITY*` all exist | Operators may miss the latest source of truth | Add one current audit index and archive older maps |

## Critical Calls

1. Rotate exposed PATs. This is not optional if these accounts matter.
2. Keep pnpm/docs discovery green before claiming future repo validation is green.
3. Do not add Vercel app config to this repo just to look upgraded.
4. Upgrade real Vercel app repos where the websites live.
5. Treat rescue outreach as a compliance and sender-reputation system, not just a script.
