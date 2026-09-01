# Skill: Corporation Dashboard Syncer
# Self-improving: Updates department KPIs based on task completion

## Description
Syncs kanban activity to the live AI Corporation dashboard at ubntag.com/ai-corp.

## Data Flow
1. Hermes completes a kanban task
2. Skill creates a pulse event
3. Dashboard API reads pulse events
4. Website displays live agent activity

## Auto-Optimization
- Tracks task completion velocity per department
- Flags stalled tasks automatically
- Suggests reassignments for blocked items
