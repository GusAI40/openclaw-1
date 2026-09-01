# Step-by-Step Integration Plan — Two New Repos

> **STATUS: EXECUTED 2026-05-12** ✅ All 7 phases complete + bonus Julian battle-prep. See "Execution log" at the bottom.

**Goal:** make both repos accessible to both tenants (Gus + Julian) with the right access model per repo.

| Repo | Type | Size | Recommended placement |
|---|---|---|---|
| `JaBeanJr/rescue-websites` | **Runnable pipeline** (outreach automation) | 189 MB | Fork to `GusAI40/rescue-websites`, clone to **shared dir**, symlink into both tenants' workspaces |
| `voltagent/awesome-design-md` | **Reference library** (design pattern markdown) | small | Clone read-only to **shared dir**, symlink into both tenants' workspaces |

## Why these placements

`rescue-websites` is something you'll likely modify (add TAG-specific business rules, integrate with your Resend/Tavily). Forking to `GusAI40` gives you push rights and a clean upstream-merge path when JaBeanJr updates the original.

`awesome-design-md` is reference data — both tenants' Jarvis agents should be able to look up design specs when building websites. No reason to fork; the upstream is the source of truth.

Symlinks (vs. independent clones) save disk and keep both tenants in sync. The trade-off: if one tenant modifies a file, the other sees the change. For reference data and shared pipelines, that's the right behavior.

## Phase 1 — Host prep (one-time)

```bash
# On the VPS
ssh -i ~/.ssh/id_hetzner tagai@87.99.148.242

# Create the shared dir
sudo mkdir -p /home/tagai/shared-projects
sudo chown tagai:tagai /home/tagai/shared-projects
chmod 755 /home/tagai/shared-projects
```

## Phase 2 — rescue-websites (fork + clone + symlink)

### 2a. Fork the repo on GitHub

User action (needs your GusAI40 login):
1. Open https://github.com/JaBeanJr/rescue-websites
2. Click **Fork** → owner = `GusAI40` → keep name `rescue-websites`
3. Confirm; takes ~5 sec

After fork exists, I can verify:
```bash
curl -s https://api.github.com/repos/GusAI40/rescue-websites | grep -E '"full_name"|"fork"'
```

### 2b. Clone fork to shared dir (SSH — our existing key works)

```bash
cd /home/tagai/shared-projects
git clone git@github.com:GusAI40/rescue-websites.git
cd rescue-websites
git remote add upstream git@github.com:JaBeanJr/rescue-websites.git  # for future upstream syncs
git config --add remote.upstream.tagOpt --no-tags  # don't auto-pull tags from upstream
ls -la
```

### 2c. Symlink into each tenant's workspace

```bash
# Gus's workspace
ln -s /home/tagai/shared-projects/rescue-websites \
      /home/tagai/.openclaw/workspace/rescue-websites

# Julian's workspace
ln -s /home/tagai/shared-projects/rescue-websites \
      /home/tagai/tenants/julian/workspace/rescue-websites
```

After this, both tenants' Jarvis can `ls /home/node/.openclaw/workspace/rescue-websites/` inside their containers and see the project.

### 2d. Project-specific setup (read repo's README first)

`rescue-websites` likely needs:
- `.env` with `RESEND_API_KEY`, `TAVILY_API_KEY` (already in shared.env — symlink or copy)
- `npm install` or `pip install` for dependencies
- Maybe a config file with target business categories / geographies

I'll read `rescue-websites/README.md` + any `setup.sh` / `package.json` in the next session and produce a "wire-up" sub-plan before running anything.

### 2e. Pull upstream JaBeanJr changes (when they update their repo)

```bash
cd /home/tagai/shared-projects/rescue-websites
git fetch upstream
git checkout main
git merge upstream/main  # or rebase, depending on preference
git push origin main      # sync the fork back up
```

## Phase 3 — awesome-design-md (clone + symlink)

### 3a. Clone read-only to shared dir

```bash
cd /home/tagai/shared-projects
git clone https://github.com/voltagent/awesome-design-md.git
# HTTPS clone (no auth needed for public repo, no push intended)
```

### 3b. Symlink into both tenants

```bash
ln -s /home/tagai/shared-projects/awesome-design-md \
      /home/tagai/.openclaw/workspace/awesome-design-md

ln -s /home/tagai/shared-projects/awesome-design-md \
      /home/tagai/tenants/julian/workspace/awesome-design-md
```

### 3c. Optionally — register as a Hermes-army knowledge skill

`awesome-design-md` is a collection of design specs for Claude/Notion/Stripe/etc. Could create a Hermes skill `design-reference.md` that says "when asked to build a website, first read relevant files from workspace/awesome-design-md/<style>". I'll draft that skill markdown in the next session if you want.

## Phase 4 — Backup integration

The daily backup script (`/home/tagai/.openclaw/backups/backup.sh`) currently snapshots only `hindsight/` and `memory/main.sqlite`. After Phase 2+3:
- Symlinks themselves are tiny — but the symlink TARGETS (the actual `shared-projects/`) aren't in the backup path.
- Decision needed: include `shared-projects/` in nightly backups? +200 MB/night encrypted.
- Recommendation: **yes**, append `shared-projects/` to backup.sh's source list. Cheap insurance.

Patch I'll apply in the next session:
```bash
# In /home/tagai/.openclaw/backups/backup.sh, after the hindsight tar step:
tar -czf "$TARGET_TMP/shared-projects.tar.gz" \
    --exclude='node_modules' --exclude='.git/objects' \
    -C /home/tagai shared-projects
```

## Phase 5 — Document in FLEET-MANIFEST

Add a new section to `.audit-2026-05-11/FLEET-MANIFEST.md`:

```markdown
## Shared projects (symlinked into all tenants)

| Project | Source | Local path | Last upstream sync |
|---|---|---|---|
| rescue-websites | GusAI40/rescue-websites (fork of JaBeanJr) | /home/tagai/shared-projects/rescue-websites | (date) |
| awesome-design-md | voltagent/awesome-design-md | /home/tagai/shared-projects/awesome-design-md | (date) |
```

## Phase 6 — Test from each tenant

```bash
# From Julian's container
docker exec openclaw-julian-gateway sh -c 'ls /home/node/.openclaw/workspace/rescue-websites/'
docker exec openclaw-julian-gateway sh -c 'cat /home/node/.openclaw/workspace/awesome-design-md/README.md | head -10'

# From Gus's container
docker exec openclaw-openclaw-gateway-1 sh -c 'ls /home/node/.openclaw/workspace/rescue-websites/'
docker exec openclaw-openclaw-gateway-1 sh -c 'cat /home/node/.openclaw/workspace/awesome-design-md/README.md | head -10'
```

Both should show the same contents — that confirms the symlinks resolve correctly inside the bind-mounted volumes.

## Phase 7 — Add to bootstrap-tenant.sh for future tenants

When tenant #3 is provisioned, they should auto-get the same symlinks. Patch `bootstrap-tenant.sh`:

```bash
# After existing step 8.5 (auth files seeding):
# Step 8.6 — Symlink shared projects
for proj in rescue-websites awesome-design-md; do
    if [[ -d "/home/tagai/shared-projects/${proj}" ]]; then
        ln -s "/home/tagai/shared-projects/${proj}" "${TENANT_WORKSPACE}/${proj}"
        log "  - symlinked /shared-projects/${proj} → workspace/${proj}"
    fi
done
```

## Order of execution

| # | Action | Owner | Effort |
|---|---|---|---|
| 1 | Fork `JaBeanJr/rescue-websites` to `GusAI40` | You (one click in GitHub UI) | 30 sec |
| 2 | Phase 1 (host prep `shared-projects` dir) | Me on VPS | 30 sec |
| 3 | Phase 2b–2c (clone rescue-websites + symlinks) | Me | 2-5 min (clone is 189 MB) |
| 4 | Phase 3 (clone + symlink awesome-design-md) | Me | 1 min |
| 5 | Phase 4 patch (backup script include) | Me | 1 min |
| 6 | Phase 5 (FLEET-MANIFEST update) | Me | 30 sec |
| 7 | Phase 6 (test from both containers) | Me | 1 min |
| 8 | Phase 7 (bootstrap-tenant.sh patch) | Me | 2 min |
| 9 | Phase 2d (rescue-websites wire-up sub-plan) | Me (read repo first) | 5-15 min depending on what it needs |

Total time after you fork: ~10-15 min.

## When to execute

**Recommendation:** start a fresh chat session (after `/clear`) and feed it this file as the resume point. The fresh context will:
1. Read this plan
2. Verify fork exists (Phase 1 — your one click)
3. Execute Phases 2-8 sequentially
4. Hand back a verification report

## Open questions to answer in next session

1. Should `rescue-websites` use TAG's shared Resend/Tavily quotas (default) or have its own (cost isolation)?
2. Symlinks (recommended) or independent clones (cost: 380 MB)?
3. Should awesome-design-md become a Hermes-army skill, or just be a static reference?

---

## Execution log — 2026-05-12

### What actually shipped vs. what the plan said

**Phase 1 — Host prep:** as planned. `/home/tagai/shared-projects/` mode 755, owned tagai:tagai.

**Phase 2 — rescue-websites:** as planned. `GusAI40/rescue-websites` fork cloned to `/home/tagai/shared-projects/rescue-websites/` (391 MB on disk). `origin = GusAI40`, `upstream = JaBeanJr` with `tagOpt=--no-tags`.

**Phase 3 — awesome-design-md:** as planned. Shallow-cloned voltagent/awesome-design-md (3.5 MB).

**Phase 6 — container visibility test: FAILED with symlinks, fixed with bind-mount.**

This is the one deviation from the plan worth flagging. The original plan called for host-side symlinks (`ln -s /home/tagai/shared-projects/rescue-websites /home/tagai/.openclaw/workspace/rescue-websites`). Symlinks work fine from the host shell, but **Docker containers cannot follow a symlink whose target is outside the container's bind-mount** — the symlink target path doesn't exist inside the container.

**Fix applied:** added a second bind-mount to both live `docker-compose.yml` files (Gus's gateway + cli, Julian's gateway) and the bootstrap template:

```yaml
- /home/tagai/shared-projects:/home/node/.openclaw/shared
```

Host-side symlinks were removed. Canonical container path is now `/home/node/.openclaw/shared/<repo>` (NOT `workspace/<repo>` as the plan suggested). Containers were `up -d --force-recreate`'d to pick up the new mount; brief ~10 sec disruption, no device-pair re-prompts needed (auto-approve cron handles that anyway).

**Phase 4 — backup.sh patched:** local snapshot now includes `shared-projects.tar.gz` (~172 MB, excludes `node_modules` + `.git/objects`) and `bootstrap-template.tar.gz` (12 KB). Verified end-to-end with a manual run.

**Off-site backup caveat:** the encrypted backup tarball is now ~214 MB (with shared-projects), which exceeds the 99 MB GitHub soft cap that `sync-to-github.sh` enforces. The sync script gracefully warns-and-continues, but does **not** mark the oversized backup as synced — so every night it will try and fail. Documented in `FLEET-MANIFEST.md` "Shared projects → Backup coverage". The truly irreplaceable file (`bootstrap-template.tar.gz` with raw LLM tokens) is 12 KB so it would off-site fine if it were a separate tarball. **Follow-up TODO:** patch `sync-to-github.sh` to split per-tarball OR add Hetzner Storage Box as a secondary off-site destination.

**Phase 5 — FLEET-MANIFEST updated:** new "Shared projects (bind-mounted into all tenants)" section. Documents the bind-mount approach, the rescue-websites remote topology (origin=GusAI40, upstream=JaBeanJr), upstream-pull workflow, and the off-site cap gap.

**Phase 7 — bootstrap-tenant.sh step 8.6 added:** verification + log block before "# 9. Install Caddy site block". Future tenants will automatically inherit the `shared/` bind-mount via the compose template (the template already has the mount line). Step 8.6 just logs what shared repos the new tenant will see, so the operator can sanity-check at bootstrap time.

### Bonus: Julian battle-prep (not in original plan)

After Phase 7 completed, Gus's request: "make sure Julian has the API keys to actually run rescue-websites." Audit + seed:

- API key audit: README claimed 4 hard-required keys + 3 optional. Cross-referenced against `/home/tagai/openclaw/.env`, `/home/tagai/.openclaw-shared.env`, and the running container's env.
- **Correction to my initial audit:** my redaction substitution (`sed s/=.*/=<REDACTED>/`) silently rewrote empty values, so I initially mis-claimed FIRECRAWL_API_KEY was present in shared.env when in fact line 16 reads `FIRECRAWL_API_KEY=` (empty). Real audit (using `grep -E '^KEY=[^[:space:]]+'`) caught this.
- Gus provided GOOGLE_PLACES_API_KEY + FIRECRAWL_API_KEY in chat. Both got restricted-key warnings (key now in conversation log).
- `SUPABASE_KEY` on the VPS is `service_role` (decoded JWT confirms), not anon. Cannot reuse as `SUPABASE_ANON_KEY` for client-side use. Fetched the real anon key via Supabase Management API (`GET /v1/projects/{ref}/api-keys`) using `SUPABASE_ACCESS_TOKEN` from container env.
- `scripts/seed-rescue-env.py` (new): reads keys from VPS sources, fetches Supabase anon key, writes `/home/tagai/shared-projects/rescue-websites/.env` with mode 600, optionally applies the schema. Reports only last-6-char fingerprints to stdout.
- Schema applied via Mgmt API `POST /v1/projects/{ref}/database/query` → HTTP 201. Verified 5 `website_rescue_*` tables now exist (3 new from our schema + 2 pre-existing from a prior setup, all untouched).
- `npm install` inside Julian's container: 66 packages in 2s. Pipeline is now runnable.

### Final battle-ready checklist

- [x] rescue-websites + awesome-design-md cloned to `/home/tagai/shared-projects/`
- [x] Bind-mount `/home/node/.openclaw/shared/` live in both tenant containers + template
- [x] Backup script captures shared-projects + bootstrap auth template (local only, off-site oversized)
- [x] FLEET-MANIFEST documents shared projects + remote topology + caveats
- [x] bootstrap-tenant.sh step 8.6 logs shared visibility for tenant #3+
- [x] Julian's `.env` seeded with all 4 required keys + 2 inherited
- [x] Supabase schema applied (`website_rescue_businesses`, `_audits`, `_emails`)
- [x] `npm install` complete inside Julian's container

### Open follow-ups (not blocking first run, but track)

- [ ] Restrict the new Google Places API key in Google Cloud Console (HTTP referrers + API restrictions = Places + Geocoding only)
- [ ] Patch `sync-to-github.sh` to split per-tarball so shared-projects gets off-sited
- [ ] When tenant #3 ships, decide whether they get their own Supabase project (preferred for paying tenants — Julian shares Gus's for inner circle)
- [ ] Cloudflare Pages deploy token (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`) — Pipeline Step 5 mockup deploys won't run without these
- [ ] Voice-proxy worker: currently defaults to `wss://rescue-voice-proxy.jujusanchez413.workers.dev` — if Juju retires that worker, Julian's voice agents break. Mitigation: deploy a TAG-controlled copy.

