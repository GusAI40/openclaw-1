# Resource Audit Reminder — 2026-05

Status: pending

Issue: N/A — GitHub Issues is disabled on this repo; track manually or enable Issues to post the reminder there.

## Run locally (you have SSH access; the remote agent does not):

```bash
ssh tagai-cloud 'free -h && df -h / && uptime'
ssh tagai-cloud 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"'
ssh tagai-cloud 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'
ssh tagai-cloud 'find ~/.openclaw/agents/main/sessions -type f -mtime +14 | wc -l'
ssh tagai-cloud 'docker system df'
```

## Decision criteria (per _shared/docs/HETZNER_INFRASTRUCTURE.yaml upgrade triggers)

- **Stay on CPX21** if: RAM available > 1.2GB sustained AND < 3 paying clients
- **Upgrade to CPX31 (8GB)** if: RAM < 70% available sustained OR 3+ paying clients deployed OR JARVIS pipeline becomes always-on
- **Upgrade to CPX41** if: 7+ paying clients OR Playwright concurrent sessions OR voice AI workloads

## Last baseline (from _tagai/RESOURCE_CLEANUP.md, 2026-04-26)

- Disk: 47% used (down from 84% after cleanup)
- RAM: 1.7Gi available of 4Gi
- Swap: 4Gi configured, 800Mi used
- 5 running containers (openclaw + michelle-fb stack)

## Cleanup playbook if needed

```bash
ssh tagai-cloud 'docker container prune -f && docker image prune -f'
ssh tagai-cloud 'docker builder prune -f --filter until=168h'
ssh tagai-cloud 'find ~/.openclaw/agents/main/sessions -type f -mtime +14 -delete'
```

Update Status to `complete` and paste findings here when done.
