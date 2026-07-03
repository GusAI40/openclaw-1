# Risk Register - 2026-07-03

Severity key:

- Critical: can expose secrets, break production, or damage accounts.
- High: can break revenue or customer trust.
- Medium: can slow delivery or create brittle work.
- Low: polish or documentation debt.

| Risk | Severity | Evidence | Why it matters | Next fix |
| --- | --- | --- | --- | --- |
| Exposed Vercel, Supabase, and GitHub PATs | Critical | Tokens were pasted into chat | Treat them as compromised | Rotate all pasted tokens before using those accounts for production work |
| Dirty mixed worktree | High | `git status` shows Firecrawl code, TAG docs, deleted webhook handler, and untracked files | A broad commit could mix unrelated code and docs | Stage only scoped audit docs unless user explicitly chooses a broader commit |
| Firecrawl provider work half-finished | High | Modified `extensions/firecrawl/*`, new untracked `firecrawl-agent-tools.ts` | Provider tools could be wrong against live `/v2/agent` API | Separate Firecrawl PR, validate official docs, run extension tests |
| Deleted `_tagai/webhook-handler.mjs` | High | File is deleted in worktree; `_tagai/README.md` still references it as legacy | Could remove a still-needed VAPI/Maya webhook if not intentionally migrated | Verify VPS source of truth before committing deletion |
| This repo is not a Vercel app | High | No root `vercel.ts`, `vercel.json`, or `next.config.*` | A Vercel "upgrade" here can be fake work | Upgrade real Vercel app repos separately |
| Supabase RLS/grants separation | High | Supabase docs make RLS and grants separate concerns | Data can be blocked or overexposed | Migrations must include grants, RLS, and policies together |
| Microsoft Graph mailbox isolation | High | MCP server can target users/mailboxes | Wrong tenant could send/read wrong mailbox | Tenant-specific app registration or strict mailbox mapping |
| Sender-domain reputation | High | Rescue docs call out shared outbound risk | One bad blast can damage all TAG outreach | Separate domains, warm-up, send ledger, suppression list |
| Nostr NIP-04 legacy status | Medium | Official NIPs mark NIP-04 final/unrecommended | DM encryption path may be dated | Review Nostr channel encryption strategy |
| DeepSeek alias deprecation | Medium | Official docs say `deepseek-chat` and `deepseek-reasoner` deprecate on 2026-07-24 | Model calls can fail soon | Audit configs for old IDs and migrate |
| pnpm local/global mismatch | Medium | `package.json` says pnpm `10.33.0`; local `pnpm --version` is `11.7.0` | Local behavior may differ from pinned package-manager version | Use Corepack or document accepted local pnpm behavior |
| Docs split across many audit folders | Medium | `_tagai/audit-*`, `_tagai/STATE_CITY*`, Julian folders | Operators may miss the latest map | Keep `_tagai/README.md` pointing at latest audit |
| Untracked Julian audit folder | Medium | `_tagai/julian-rescue-websites-audit-2026-06-08/` is untracked | Important recovery docs may be lost or duplicated | Decide commit vs move vs archive |
| Old `gh` CLI | Low | Local `gh version` is `2.52.0` from 2024 | May miss newer GitHub behavior | Update before heavy GitHub automation if needed |

## Critical Calls

1. Rotate pasted tokens.
2. Do not push all dirty files together.
3. Treat Firecrawl as its own provider PR.
4. Verify webhook deletion before committing it.
5. Choose the first real Vercel app repo for actual Vercel upgrades.
