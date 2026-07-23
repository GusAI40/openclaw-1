# DFW Construction Decision-Makers — Shortlist for Sales Text

_Source: re-shaped from `TAG-Ugly-Website-Finder/output/decision_makers_hot29_2026-05-27.md` (Apollo + Tavily + web-search run on 2026-05-27, 29 prospects enriched). No new Apollo/Tavily MCP calls were available from this agent's environment — see "Data Quality" below._

_Filtered to: DFW metro (Dallas/Fort Worth/Denton/Tarrant/Collin counties), industry = construction / roofing / remodeling / general contractor / plumbing. Sorted by signal strength (verified email + phone first)._

## Top 15 Ranked Shortlist

| # | Tier | Company | City | Owner | Title | Phone | Verified Email | LinkedIn | Notes |
|---|------|---------|------|-------|-------|-------|----------------|----------|-------|
| 1 | HIT | Doorvana LLC | Forest Hill | Bobby Vickers | Managing Member | (817) 500-5988 | bobby@doorvana.com | — | Cleanest hit — BBB confirms Managing Member, work email passes name-match. |
| 2 | HIT | Rooftop Solutions DFW | Sanger | Dustin Reiling | Owner | (469) 988-1867 | dustin@rooftopsolutionsdfw.com | [linkedin](http://www.linkedin.com/in/dustin-reiling-61337447) | Owner since May 2022, 22 yrs roofing exp. Verified work email. |
| 3 | HIT | Relentless Contracting LLC | Little Elm | Christopher Eusse | Owner/Founder (Apollo says "Commission Sales Associate" — stale) | (214) 585-9731 | chris@relentlesscontracting.com | [linkedin](http://www.linkedin.com/in/christopher-eusse-949b1398) | BBB + Little Elm Chamber confirm Owner. Founded 2022. |
| 4 | HIT | Blue Line Roofing | Fort Worth | Velma Hunt | Business Owner | (817) 253-9910 | vhunt@bluelineroofingllc.com | [linkedin](http://www.linkedin.com/in/velma-hunt-9886178) | WARNING: Apollo org address is San Antonio — verify same entity by phone before texting. |
| 5 | HIT | Solano's Roofing | Denton | Mario Solano | Owner | (940) 484-5686 | mariosolanoroofing@yahoo.com | — | Yahoo address, but local-part matches owner first name. Verified. |
| 6 | HIT | HomeTeam Pest Defense (Denton branch) | Denton | Jason Custer | General Manager | (844) 372-7558 | jason.custer@pestdefense.com | [linkedin](http://www.linkedin.com/in/jason-custer) | Local GM (not corporate CEO). Pest-control, not strictly construction — include or skip per ICP. |
| 7 | PARTIAL | Clark & Clark Construction | Trophy Club / Arlington | A-Johnny Clark | Owner | (817) 680-1430 | jclark.pm@gmail.com (personal) | [linkedin](http://www.linkedin.com/in/a-johnny-clark-9ab64179) | Personal Gmail. Phone first, email as follow-up. |
| 8 | PARTIAL | Dan Fette Builders, Inc. | Denton | Dan Fette | Owner | (940) 483-1761 | daniel.fette@yahoo.com (personal) | [linkedin](http://www.linkedin.com/in/dan-fette-0a573a4) | May be semi-retired (Houzz hint). Phone confirm before pitching. |
| 9 | PARTIAL | Lonnie Bravo Plumbing | Fort Worth | Lonnie Bravo | Owner | (817) 715-6747 | lonniebravo@sbcglobal.net (personal) | [linkedin](http://www.linkedin.com/in/lonnie-bravo-939ab340) | Owner since 2008. Plumbing-adjacent if construction-only ICP. |
| 10 | PARTIAL | Grissom Construction | Aubrey | John Grissom | Principal (BBB) — Apollo lists 2012 NTTA move | (214) 783-2109 | grissomconst@msn.com (company catch-all) | [linkedin](http://www.linkedin.com/in/john-grissom-49751515) | Apollo employment record stale; BBB current. Treat email as company mailbox. |
| 11 | PARTIAL | CDF General Contractors, LLC | Keller | Jesus Salcedo | Principal | (817) 741-2303 | — | [linkedin](http://www.linkedin.com/in/jesus-salcedo-55183265) | No email. LinkedIn DM + phone. |
| 12 | PARTIAL | DCM Roofing & Construction LLC | Hickory Creek | Juan Vazquez | Business Owner | (940) 600-2694 | — | [linkedin](http://www.linkedin.com/in/juan-vazquez-692921301) | Phone outreach only. |
| 13 | PARTIAL | Roof Masters | Denton | Ricky Bryant | Owner | (940) 566-3407 | — | [linkedin](http://www.linkedin.com/in/ricky-bryant-76981325) | Apollo org record is a different KY entity — person record city = Denton matches. |
| 14 | PARTIAL | Landmark General Contractors Inc. | Southlake | Gary Gracey | President | — | — | [linkedin](http://www.linkedin.com/in/gary-gracey-3879b985) | LinkedIn-only. No phone, no email in Apollo. |
| 15 | PARTIAL | Anderson Roofing and Remodeling | Denton (Keller HQ) | Tom Anderson | Owner | (817) 230-9215 | — | — | Phone-only outreach. |

## Recommendation for the FIRST sales text

**Send to #1 Bobby Vickers — Doorvana LLC, Forest Hill.** Cleanest record in the set: verified work email, direct phone, BBB-confirmed Managing Member, no entity-mismatch risk. If voice/SMS rather than email, **#2 Dustin Reiling — Rooftop Solutions DFW** is the next-strongest: clear owner title, direct mobile-looking 469 number, recent ownership (2022).

## Data Quality — Honest Read

**Verified (high confidence):**
- All 6 HIT-tier rows have Apollo-confirmed verified work emails that passed a name-match guard (local-part contains a token from the owner's first/last name).
- Phones on HIT/PARTIAL rows came from Apollo org records, not scraped guesses.

**Caveats / known weaknesses:**
- **Stale snapshot.** This data is from 2026-05-27 (2 days old). Owners/titles drift; verify by quick LinkedIn glance before any high-stakes message.
- **No fresh API calls were possible from this agent.** Apollo, Tavily, and the existing `find-decision-makers` skill chain are MCP-server-based and those MCPs were NOT reachable in this environment (only `mcp__firecrawl__*`, `WebSearch`, `WebFetch` were available — none of those replace Apollo enrichment). Re-running the live skill from Gus's normal Claude Code session would refresh and likely surface 5-10 more candidates.
- **One entity-mismatch flag (row #4 Velma Hunt / Blue Line Roofing).** Apollo's org city is San Antonio while the target phone is a 817 Fort Worth number — could be a different LLC. Phone-verify before texting.
- **One pest-control row (row #6 Jason Custer / HomeTeam Pest Defense).** Included because the source run pulled it, but it's pest-control not construction — drop if ICP is strict GC/roofing/remodel.
- **`apollo_search_people` is documented broken in the skill** — names came from Tavily/web search, then re-enriched via `apollo_enrich_person`. Standard for this pipeline.
- **No vendor-API errors hit** during the 2026-05-27 source run (29/29 prospects returned a record, even if 10 were MISS-tier stubs).
- **MISS-tier rows (10 total) intentionally not included** in the shortlist above — they have only a name + phone, no email, no LinkedIn, and would require a cold-call discovery script rather than a sales text.

**To get fresher data:** run `/find-decision-makers` from Gus's main Claude Code session (where Apollo + Tavily MCPs are live) with the prompt: _"Find decision makers at construction / roofing / GC companies in DFW (Dallas, Fort Worth, Denton, Tarrant, Collin counties), 5-100 employees, owner/CEO/president/founder/GM roles, 15 results."_
