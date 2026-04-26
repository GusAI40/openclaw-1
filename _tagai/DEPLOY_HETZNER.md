# Deploy OpenClaw to Hetzner via Coolify

Step-by-step deployment of the TAG-AI fork (`github.com/GusAI40/openclaw-1`) to
the production Hetzner CPX21 server (`tagai-cloud`, 87.99.148.242), exposed at
`https://openclaw.ubntag.com` through Cloudflare DNS and Coolify-managed
Traefik.

Authoritative infra contract: `_shared/docs/HETZNER_INFRASTRUCTURE.yaml`.

---

## 1. Prerequisites

The Hetzner server is already provisioned per the contract. Verify before
deploying:

- [ ] SSH reaches `tagai@87.99.148.242` (key-based, no password).
- [ ] Coolify dashboard responds at `https://coolify.ubntag.com`.
- [ ] Cloudflare account has DNS edit access for `ubntag.com`.
- [ ] You can pull `github.com/GusAI40/openclaw-1` (Coolify's GitHub app is
      installed, or a deploy key is configured).
- [ ] Server has at least 1.5 GB free RAM (`ssh tagai@87.99.148.242 free -h`).
      Image build alone needs ~2 GB, so stop other heavy containers first if
      memory is tight on the CPX21.

If any of those fail, fix them before continuing — do not improvise around the
infra contract.

---

## 2. DNS (Cloudflare)

Add a single A record. Proxy must be **OFF** (gray cloud) — Coolify/Traefik
handles SSL via Let's Encrypt directly, and Cloudflare proxy mode would
double-terminate TLS and break the wss:// gateway pairing path.

| Type | Name      | Content         | Proxy status | TTL  |
|------|-----------|-----------------|--------------|------|
| A    | openclaw  | 87.99.148.242   | DNS only     | Auto |

Verify propagation before continuing:

```bash
dig +short openclaw.ubntag.com   # must return 87.99.148.242
```

---

## 3. Create the Coolify project

In the Coolify dashboard at `https://coolify.ubntag.com`:

1. **Project** -> **New Project**
   - Name: `openclaw`
   - Description: `OpenClaw gateway for TAG AI agent fleet`

2. **Resources** -> **+ New** -> **Public/Private Git Repository**
   - Source: `GitHub` (select the `GusAI40/openclaw-1` repository)
   - Branch: `main`
   - Build pack: **Dockerfile**
   - Dockerfile location: `Dockerfile` (repo root, the upstream multi-stage
     build)

3. **Build settings**
   - Dockerfile path: `Dockerfile`
   - Docker context: `.` (repo root — required so the multi-stage `COPY .`
     and `COPY ${OPENCLAW_BUNDLED_PLUGIN_DIR}` succeed)
   - Docker compose override: enable **"Use additional compose file"** and
     point it at `_tagai/docker-compose.tagai.yml`
   - Image name: `openclaw:tagai`
   - Exposed port: `18789`
   - Health check path: `/healthz`

4. **Build arguments** (Coolify's "Build args" panel, applied at `docker build`)
   - `OPENCLAW_VARIANT=default`
   - leave the rest unset unless you need Chromium / sandbox / extensions

---

## 4. Inject environment variables

Open the resource's **Environment Variables** panel and load every variable
from `_tagai/.env.tagai.example`. Mark anything matching `*_TOKEN`,
`*_KEY`, `*_COOKIE`, or `*_PASSWORD` as a **Secret** in Coolify so it is
encrypted at rest and masked in logs.

Generate the two required secrets first (run locally or via SSH on the VPS):

```bash
openssl rand -hex 32   # paste into OPENCLAW_GATEWAY_TOKEN
openssl rand -hex 32   # paste into GOG_KEYRING_PASSWORD
```

The Claude session variables (`CLAUDE_AI_SESSION_KEY`, `CLAUDE_WEB_SESSION_KEY`,
`CLAUDE_WEB_COOKIE`) are optional. Leave them blank for the first deploy and
fill them in later if any agent needs claude.ai web-session features. The
fetch instructions are in the comments inside `.env.tagai.example`.

---

## 5. Persistent volumes

Coolify needs two persistent volumes mounted into the container so that
config, auth profiles, and workspace state survive image rebuilds.

In the resource's **Storages / Persistent volumes** panel, add:

| Source (host)                              | Destination (container)                    | Purpose                                              |
|--------------------------------------------|--------------------------------------------|------------------------------------------------------|
| `/home/tagai/.openclaw`                    | `/home/node/.openclaw`                     | `openclaw.json`, `agents/*/auth-profiles.json`, `.env` |
| `/home/tagai/.openclaw/workspace`          | `/home/node/.openclaw/workspace`           | Agent scratch + session JSONL + media                |

These match the values of `OPENCLAW_CONFIG_DIR` / `OPENCLAW_WORKSPACE_DIR` in
the env file.

Before the first deploy, the host directories must exist and be owned by
uid 1000 (the `node` user inside the container). Do this once over SSH:

```bash
ssh tagai@87.99.148.242 \
  'sudo mkdir -p /home/tagai/.openclaw/workspace && \
   sudo chown -R 1000:1000 /home/tagai/.openclaw'
```

---

## 6. Bind the domain

In the resource's **Domains** panel:

- Add `https://openclaw.ubntag.com`
- Coolify will auto-request a Let's Encrypt cert through Traefik.
- Confirm the generated Traefik labels match the ones in
  `_tagai/docker-compose.tagai.yml` (Coolify usually merges them; if it
  complains about duplicates, remove the auto-generated labels and keep the
  ones from the overlay file as source of truth).

Resource limits applied via the overlay (`mem_limit: 1.5G`,
`cpus: '2.0'`) are intentionally tuned for the CPX21's 4 GB / 3 vCPU
budget. Do not raise them without first checking `free -h` — JARVIS and
the campaign workers also share this server.

---

## 7. First deploy

Click **Deploy** in Coolify. The build runs entirely on the Hetzner host and
takes 8-15 minutes the first time (pnpm install + bun + UI build). Watch the
build log for `==> Verifying critical native addons...` — that line confirms
the `matrix-sdk-crypto` native binding compiled correctly on amd64.

When the deploy turns green, verify externally:

```bash
# Liveness probe (no auth required)
curl -fsS https://openclaw.ubntag.com/healthz
# Expected: 200 OK with JSON body

# Readiness probe
curl -fsS https://openclaw.ubntag.com/readyz

# Authenticated deep health (uses your gateway token)
TOKEN="<paste OPENCLAW_GATEWAY_TOKEN>"
curl -fsS -H "Authorization: Bearer $TOKEN" \
  https://openclaw.ubntag.com/api/health
```

If `/healthz` returns 200 but the Control UI at
`https://openclaw.ubntag.com/` shows a pairing screen, that is correct — see
post-deploy step below.

---

## 8. Post-deploy: onboarding and daemon install

OpenClaw needs an interactive onboarding pass to register the first device,
seed `openclaw.json`, and (optionally) install the systemd daemon for
in-container background workers.

Pick **one** of the two paths below.

### Path A — `docker exec` into the running container (faster)

From your laptop or any machine with SSH access:

```bash
ssh tagai@87.99.148.242
# On the server, find the running container ID:
docker ps --filter 'name=openclaw' --format '{{.ID}}\t{{.Names}}'

# Drop into the container as the node user and run onboarding:
docker exec -it <container_id> openclaw onboard

# Wizard prompts: provider API keys, channel logins, gateway token confirm.
# Accept the defaults except where the wizard asks about bind mode — keep
# `lan`, since Traefik fronts the gateway.
```

### Path B — SSH directly + use the host CLI (preferred for daemon install)

```bash
ssh tagai@87.99.148.242
docker exec -it <container_id> openclaw onboard --install-daemon
```

`--install-daemon` registers a long-running background worker so scheduled
agent jobs survive container restarts. Coolify's `restart: always` policy
(set via the overlay) covers the container itself; `--install-daemon`
covers the agent runtime inside it.

After onboarding, browse to `https://openclaw.ubntag.com/` and paste the
`OPENCLAW_GATEWAY_TOKEN` value into the Control UI auth field. You should
land on the dashboard with the gateway showing `connected`.

---

## 9. Smoke test the agent path

```bash
# From your laptop:
TOKEN="<paste OPENCLAW_GATEWAY_TOKEN>"
curl -fsS -H "Authorization: Bearer $TOKEN" \
  https://openclaw.ubntag.com/api/agents
# Expected: JSON list of registered agents (empty array on first deploy is fine).

# Pair a CLI device:
docker exec -it <container_id> openclaw devices list --json
docker exec -it <container_id> openclaw dashboard --no-open
# Open the printed URL, approve the pairing.
```

---

## 10. Known gotchas

- **Cloudflare proxy must stay OFF.** Turning the orange cloud on breaks
  the wss:// pairing flow because Cloudflare buffers WebSocket upgrades
  differently than Traefik expects.
- **Out-of-memory during build.** CPX21 has 4 GB RAM. If the build is OOM
  killed (`exit code 137`), stop other heavy containers first
  (`docker ps`, then `docker stop <name>`), or temporarily upgrade to
  CPX31 in the Hetzner console — the rebuild only needs ~2 GB peak.
- **Volume permission errors** (`EACCES /home/node/.openclaw`). The
  container runs as uid 1000. Run the `chown -R 1000:1000` command from
  step 5 before retrying.
- **Cookie rotation.** `CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`
  expire roughly every 30 days. When channel commands start returning
  `HTTP 403 ... user:profile`, refresh both values from a logged-in
  browser session and redeploy.

---

## 11. Updates

```bash
# In Coolify dashboard:
#   Resource -> Redeploy  (pulls latest commit from main)

# Or trigger via CLI from your laptop:
gh api repos/GusAI40/openclaw-1/dispatches \
  -f event_type=coolify-redeploy
```

For upstream sync (pulling new commits from `openclaw/openclaw` into the
fork), do that on a feature branch locally, open a PR against your fork's
`main`, then let Coolify auto-deploy on merge.

---

## Related files

- `_tagai/.env.tagai.example` — full env-var reference
- `_tagai/docker-compose.tagai.yml` — Traefik routing, resource limits,
  TZ override
- `_shared/docs/HETZNER_INFRASTRUCTURE.yaml` — authoritative infra contract
- `docs/install/hetzner.md` — upstream guide (kept unmodified for diffability)
