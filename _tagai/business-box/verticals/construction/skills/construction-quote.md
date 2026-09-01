# Skill: Construction Estimate Draft (tenant: {{TENANT_ID}})

## Description
Turn a lead's scope notes plus the owner's pricing sheet into a draft estimate.
Draft only — sending is a separate, explicitly-approved action.

## Inputs
- A `leads` record (from `construction-intake`) or scope notes pasted by the owner.
- The owner's pricing reference at `/home/node/.openclaw/corp/pricing-construction.csv`
  if present. If absent, ask the owner for unit prices — never guess.

## What it produces
A line-item draft:
- Line items (labor, materials, equipment, permits) with qty × unit price.
- Subtotal, contingency %, tax line, total.
- Assumptions + exclusions section (what's NOT in the price).
- Validity window (default 30 days).

## Output
Write the draft to board `estimates`, status `draft`, tagged
`tenant_id={{TENANT_ID}}`. Present the full draft to the owner.

## Hard gates
- NEVER send the estimate to the customer without the owner saying "send it".
- NEVER invent a unit price. Missing price → ask the owner.
- Math is exact: no silent rounding. Show every line.
