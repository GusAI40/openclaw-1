# Skill: Nano-Agent Spawner
# Self-improving: Every 10 spawns, optimize batch size and timing

## Description
Spawn parallel nano-agents for batch processing. Automatically optimizes batch size based on system load.

## Usage
hermes -s nano-spawner -z "Spawn 10 agents to analyze repos"

## Auto-Optimization
- Tracks spawn success rate
- Adjusts batch size based on system load
- Retries failed spawns with backoff
- Logs spawn metrics to ~/.hermes/logs/spawn.log
