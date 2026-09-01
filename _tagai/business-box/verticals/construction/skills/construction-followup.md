# Skill: Construction Follow-up Sweep (tenant: {{TENANT_ID}})

## Description
Surface leads and estimates that have gone quiet so the owner can decide what to
chase. Reports to the owner — does NOT contact customers on its own.

## What it does
1. Read board `leads` (status `new`/`contacted`) and board `estimates`
   (status `draft`/`sent`).
2. Flag any record with no activity in 3+ business days.
3. Group by stage and produce a short list:
   - **Hot** — customer replied, no owner action yet.
   - **Cooling** — sent estimate, no reply in 3–7 days.
   - **Cold** — no reply in 7+ days; candidate to close-lost.
4. Deliver the list to the owner with a suggested next action per item.

## Output
One owner-facing digest. Nothing is sent to any customer.

## Hard gates
- NEVER auto-message a customer. The owner picks who to follow up with.
- A draft follow-up message may be prepared, but it waits for "send it".
- Run on demand or on the tenant heartbeat — not more than once per day.
