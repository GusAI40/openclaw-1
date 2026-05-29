# Skill: Construction Lead Intake (tenant: {{TENANT_ID}})

## Description
Capture an inbound construction lead into a structured record the owner can act
on. Triggered when a message looks like someone asking for work.

## Trigger phrases
"need a quote", "looking for a contractor", "can you build/remodel/fix",
"how much would it cost to", "are you available", "I have a project".

## What it captures (ask for anything missing, one question at a time)
| Field | Notes |
|---|---|
| name | who's asking |
| phone | best callback number |
| address | job site address |
| job_type | remodel / new build / repair / addition / other |
| scope | 1–3 sentence description in their words |
| timeline | "ASAP", a date, or "flexible" |
| budget_hint | only if they volunteer it — never push |
| source | how they found us (referral, web, drive-by) |

## Output
Write one record to the tenant kanban under board `leads` with status `new`,
tagged `tenant_id={{TENANT_ID}}`. Echo a one-line confirmation to the sender and
a one-line summary to the owner.

## Hard gates
- Do NOT quote a price during intake. Capture scope; pricing is a separate,
  owner-approved step.
- Do NOT promise a start date. Say "the owner will confirm scheduling."
