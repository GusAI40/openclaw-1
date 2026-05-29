# Construction Software Integrations — Phase 2 Scoping (Honest Assessment)

**Author:** Integration research spike (Jarvis / OpenClaw Business-in-a-Box, construction vertical)
**Date:** 2026-05-29
**Method:** Each vendor validated against its CURRENT live developer docs via web search + fetch on the date above. Where a docs page wouldn't render (JS-heavy SPA), that is called out explicitly and only the verified search-snippet content is used. Nothing here is from training memory alone.

---

## TL;DR — Ranked shortlist

1. **QuickBooks Online — BUILD FIRST.** Fully open, self-serve OAuth2, free dev account, 5 free sandboxes, 500K free read calls/mo on the auto-enrolled Builder tier. Near-universal adoption among contractors (every trade does books). Lowest friction, highest cross-vertical reuse.
2. **CompanyCam — BUILD SECOND.** Open self-serve API. API token (single account) for an MVP today; OAuth2 for multi-customer later. REST, OpenAPI spec + Postman collection published. Huge adoption with roofers/remodelers/field crews. Small lift.
3. Jobber — strong candidate, defer to phase 2b (free dev account + 90-day test org, but GraphQL learning curve + marketplace review).
4. AccuLynx — buildable for a single roofing client (API key), partner app gated.
5. Procore — NEEDS PARTNER ACCESS. Enterprise GC tool; only worthwhile if we land an enterprise GC client.
6. Salesforce — already in TAG's stack via CLI skills; treat as done.
7. Buildertrend — DEFER. No public self-serve API; partner-program / contact-sales only.

**Could NOT fully verify via rendered docs page:** Procore's `developers.procore.com/documentation/*` pages and `buildertrend.com/blog/blog-construction-api/` (404). Procore findings are from search snippets of the live docs + the GitHub-Pages mirror; Buildertrend findings are from two other live Buildertrend pages that rendered. Flagged inline below.

---

## Per-tool detail

### 1. Procore
| Field | Finding |
|---|---|
| Public dev API? | **Yes, but production access is partner-gated.** Public REST API, full docs at developers.procore.com. |
| Auth | OAuth 2.0 — Authorization Code (acts as logged-in user) and Client Credentials / DMSA (data-connection apps). Standard, well-documented. |
| Cost / tier | Dev-portal signup appears free; a **free monthly sandbox** exists (`login-sandbox-monthly.procore.com`). BUT publishing to the App Marketplace and reaching real customer orgs requires the **Partner Program** with an approval checklist (beta customer required, no undocumented APIs, no training AI on Procore data, enterprise security review). |
| OpenClaw effort | **L** — OAuth flow is easy; the cost is the Partner Program gate, enterprise data model, and approval cycle. Real work is process, not code. |
| Verdict | **NEEDS PARTNER ACCESS.** Procore = large GCs, not the typical TAG SMB contractor. Only pursue if we sign an enterprise GC. |
| Docs verified | Search snippets of live docs + GitHub-Pages mirror. **The SPA docs pages did not render in WebFetch** — auth/marketplace specifics confirmed via snippets, not a full page read. |

Sources: https://developers.procore.com/documentation/oauth-introduction · https://developers.procore.com/documentation/oauth-client-credentials · https://developers.procore.com/documentation/partner-overview · https://developers.procore.com/documentation/marketplace-requirements · https://developers.procore.com/documentation/marketplace-checklist

### 2. Buildertrend
| Field | Finding |
|---|---|
| Public dev API? | **No public self-serve API found.** Integrations run through a curated Marketplace; everything is API-backed internally but there is no developer portal or API-key signup exposed to outside builders. |
| Auth | Not publicly documented (no open developer surface). |
| Cost / tier | Partner-program / "contact us" only. Third-party access via Marketplace partnership or third-party MCP bridges (e.g. Supergood) — not a first-party path. |
| OpenClaw effort | **L+ (blocked)** — can't even start without a partnership conversation. |
| Verdict | **DEFER.** No open door. Revisit only if a Buildertrend-using client pushes for it and is willing to broker partner access. |
| Docs verified | `buildertrend.com/blog/blog-construction-api/` returned **404**. Verified instead against `buildertrend.com/blog/buildertrend-integrations/` (rendered) + the API blog's search snippet — both confirm Marketplace-partner model, no self-serve API. |

Sources: https://buildertrend.com/blog/buildertrend-integrations/ · https://buildertrend.com/blog/software-integrations/ (blog-construction-api URL = 404 on fetch)

### 3. CompanyCam
| Field | Finding |
|---|---|
| Public dev API? | **Yes — open, self-serve.** REST API to read/write Projects, Photos, etc. OpenAPI spec (YAML) + Postman collection published. |
| Auth | **Two modes:** API token (Company > Account > Access Tokens) for single-account/own-use — perfect for an MVP. OAuth 2.0 (auth-code grant, access + refresh tokens) required only when publishing an integration to *other* CompanyCam customers. |
| Cost / tier | API/integrations available on **Pro, Premium, Elite** plans (paid). No separate free dev tier confirmed in docs. Client already on a paid plan = no extra cost for own-account integration. |
| OpenClaw effort | **S** for token-based single-tenant skill; **M** if/when multi-customer OAuth app is needed. |
| Verdict | **BUILD NOW (#2).** Open API, low effort, heavy field-crew/roofer adoption, strong fit for photo-driven jobsite workflows Jarvis can summarize. |
| Docs verified | docs.companycam.com getting-started + OAuth pages rendered cleanly. |

Sources: https://docs.companycam.com/docs/getting-started · https://docs.companycam.com/docs/oauth · https://docs.companycam.com/docs/welcome · https://help.companycam.com/en/articles/6828353-api-and-custom-integrations

### 4. AccuLynx
| Field | Finding |
|---|---|
| Public dev API? | **Yes (public), for existing AccuLynx account holders.** "Advanced API for Developers" exposes all endpoints; also a public Zapier integration for no-code. |
| Auth | **API key** — created/named inside an active AccuLynx account. (No OAuth flow surfaced.) |
| Cost / tier | Requires an **active AccuLynx account** (paid roofing CRM). No standalone free dev tier. Software vendors wanting to ship a productized integration apply via a **Partnership Application**. |
| OpenClaw effort | **S–M** — API-key auth is trivial; effort is the roofing-specific data model. |
| Verdict | **BUILD per-client (API key) / NEEDS PARTNER ACCESS for a marketplace app.** Roofing-only niche. Good if a roofing client is in the first cohort; otherwise defer. |
| Docs verified | apidocs.acculynx.com getting-started rendered cleanly. |

Sources: https://apidocs.acculynx.com/docs/getting-started · https://apidocs.acculynx.com/docs/api-integrations-for-developers · https://apidocs.acculynx.com/docs/partner-with-acculynx

### 5. QuickBooks Online (Intuit)
| Field | Finding |
|---|---|
| Public dev API? | **Yes — fully open, self-serve.** Accounting API, mature, heavily documented at developer.intuit.com. |
| Auth | **OAuth 2.0 only** (no API keys / basic auth). App gets Client ID + Client Secret; standard auth-code flow with mandatory Reconnect URL. |
| Cost / tier | **Dev portal free.** Auto-enrolled in **Builder Tier**: up to **500,000 free CorePlus (read) API calls/mo, no platform fees**; writes (Core calls) free. Each dev account auto-provisions a **sandbox company** (up to 5), pre-loaded with sample data. |
| OpenClaw effort | **M** — OAuth + token refresh is routine; the work is mapping the accounting object model (invoices, customers, items, P&L). No approval gate to start building. |
| Verdict | **BUILD FIRST.** Open, free to start, universal contractor adoption (everyone keeps books), and reusable across every TAG vertical — not just construction. Best ROI. |
| Docs verified | developer.intuit.com develop + OAuth pages confirmed via live search snippets (auth model, sandbox, Builder-tier 500K free reads). |

Sources: https://developer.intuit.com/app/developer/qbo/docs/develop · https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0 · https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/faq

### 6. Jobber
| Field | Finding |
|---|---|
| Public dev API? | **Yes — open, self-serve, GraphQL.** Developer Center lets you build, ship, and monetize apps. |
| Auth | **OAuth 2.0** (access + refresh tokens) -> GraphQL queries/mutations. GraphiQL test console built in. |
| Cost / tier | Developer Center account is separate and appears **free**. A **free 90-day developer-testing Jobber account** is available (extensions on request). No publishing fee or partner-approval gate documented — apps go through a standard review (name, logo, gallery, must handle disconnects). |
| OpenClaw effort | **M** — extra lift only because it's GraphQL (schema modeling) vs REST, plus marketplace review if going public. Single-tenant build is low. |
| Verdict | **BUILD (phase 2b).** Strong fit for field-service/home-service trades (HVAC, plumbing, electrical, landscaping). Open + free; sequence after QBO + CompanyCam. |
| Docs verified | developer.getjobber.com getting-started rendered cleanly; OAuth + marketplace pages via search snippets. |

Sources: https://developer.getjobber.com/docs/getting_started/ · https://developer.getjobber.com/docs/building_your_app/app_authorization/ · https://developer.getjobber.com/docs/ · https://developer.getjobber.com/docs/building_your_app/app_lifecycle/

### 7. Salesforce (TAG already uses)
| Field | Finding |
|---|---|
| Public dev API? | **Yes** — REST/SOAP/Bulk/GraphQL. Free **Developer Edition** org available. |
| Auth | OAuth 2.0. **Important 2026 change:** new integrations should use **External Client Apps (ECAs)**, not legacy Connected Apps (largely blocked / "closed by default" in modern orgs as of Spring '26). JWT Bearer flow is the modern default for backend/no-human-login integrations. ECAs do **not** support username-password flow. |
| Cost / tier | Free Developer Edition exists but is capped (**15,000 API calls/24h, 5 concurrent**) — fine for dev, not production load. |
| OpenClaw effort | **Already done** — TAG has working Salesforce CLI skills. Forward-looking note: when extending, build new auth as an **ECA + JWT Bearer**, since Connected Apps are being phased out. |
| Verdict | **DONE / maintain.** No new build needed; just don't regress onto deprecated Connected Apps. |
| Docs verified | developer.salesforce.com REST API + OAuth/ECA pages via live search snippets (Summer '26, updated 2026-05-22). |

Sources: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm · https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm

---

## Prioritized recommendation — build these 1–2 FIRST

**#1 QuickBooks Online.** It's the only integration on this list that is open, free to start, requires zero partner approval, AND is used by essentially every contractor regardless of trade. It also pays off across all TAG verticals, not just construction. An OpenClaw skill (OAuth2 + a handful of read endpoints: invoices, customers, P&L) lets Jarvis answer "who owes me money / what did we bill this month" — concrete, demoable value with the lowest risk.

**#2 CompanyCam.** Cheapest possible MVP: a single API token (no OAuth ceremony) gets Jarvis reading jobsite projects and photos for a paying client today. Big adoption among the exact SMB trades (roofing, remodel, exterior) TAG targets, and it complements QBO nicely (photos/field + books = a credible "business-in-a-box" story).

**Why NOT the others first:** Procore and Buildertrend are partner-gated (process risk, enterprise/curated-marketplace bias, slow). AccuLynx is roofing-only. Jobber is genuinely buildable and open — but it's GraphQL (more modeling) and is a phase-2b pickup once a home-service client is in the cohort. Salesforce is already covered.

**Skeptic's caveats:**
- "Open API" ≠ "no cost to the client": CompanyCam needs a Pro+ plan and AccuLynx/QBO need an active paid account. The *integration* is free to build; the *software* underneath is the client's existing subscription.
- A single-tenant skill (API key / one OAuth app per client) is S–M effort. A productized multi-customer marketplace app (OAuth + review + disconnect handling) is a different, larger project for every vendor — don't conflate the two when scoping.
- Procore Marketplace bars using customer data to train AI/ML models — read each vendor's API terms before wiring data into any LLM workflow.
