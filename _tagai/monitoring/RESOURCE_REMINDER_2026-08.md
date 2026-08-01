# Resource Audit Reminder — 2026-08

Status: pending

Issue: not created — GitHub Issues is disabled in this repository. Audit must be tracked manually.

Run locally:

- [ ] `ssh tagai-cloud 'free -h && df -h / && uptime'`
- [ ] `ssh tagai-cloud 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"'`
- [ ] `ssh tagai-cloud 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'`
- [ ] `ssh tagai-cloud 'find ~/.openclaw/agents/main/sessions -type f -mtime +14 | wc -l'`
- [ ] `ssh tagai-cloud 'docker system df'`

Decision criteria:

- **Stay on CPX21** if: RAM available > 1.2GB sustained AND < 3 paying clients
- **Upgrade to CPX31 (8GB)** if: RAM < 70% available sustained OR 3+ paying clients deployed OR JARVIS pipeline becomes always-on
- **Upgrade to CPX41** if: 7+ paying clients OR Playwright concurrent sessions OR voice AI workloads

Last baseline (from _tagai/RESOURCE_CLEANUP.md, 2026-04-26):

- Disk: 47% used (was 84% before cleanup)
- RAM: 1.7Gi available of 4Gi
- Swap: 4Gi configured, 800Mi used
- 5 running containers (openclaw + michelle-fb stack)

Cleanup playbook if needed:

```bash
ssh tagai-cloud 'docker container prune -f && docker image prune -f'
ssh tagai-cloud 'docker builder prune -f --filter until=168h'
ssh tagai-cloud 'find ~/.openclaw/agents/main/sessions -type f -mtime +14 -delete'
```
