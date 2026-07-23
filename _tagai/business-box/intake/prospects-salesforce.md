# Salesforce Prospects — DFW Construction Owners

**Generated:** 2026-05-29
**Status:** BLOCKED — Salesforce CLI not installed
**Requested by:** Gus (sales text outreach to DFW construction decision-makers)

---

## Blocker — Read First

The `sf` CLI (Salesforce CLI v2) is **not installed** on this Windows machine, and neither is the legacy `sfdx` CLI. No `~/.sfdx` or `~/.sf` config directory exists, which means there is no cached Salesforce org auth on this machine either.

Without the CLI, none of Gus's `sf-*` skills (`sf-login`, `sf-unified-search`, `sf-address-search`, `sf-create-lead`, etc.) can execute — they all shell out to `sf org list`, `sf data query`, and `sf data soql`.

### What Gus needs to do (one-time install + auth)

```powershell
# 1. Install Salesforce CLI (pick one):
npm install -g @salesforce/cli                # via npm (already on PATH)
# OR
winget install --id Salesforce.SalesforceCLI  # via winget

# 2. Verify install
sf --version

# 3. Authenticate to the TAG production org (opens browser)
sf org login web --alias tag-prod --set-default

# 4. Confirm auth
sf org list
```

Once `sf org list` shows `tag-prod` as a connected org, re-run this task and the shortlist will populate.

---

## Prospect Table (PENDING — will fill after auth)

| # | Company | Owner / Contact | Role | City | Industry | Last Activity | Phone | Email | Rank Reason |
|---|---------|-----------------|------|------|----------|---------------|-------|-------|-------------|
| _Pending Salesforce CLI install + auth — see blocker above_ | | | | | | | | | |

---

## Planned SOQL Queries (for reference — what will run once CLI is live)

When the CLI is authenticated, the following queries will run via `sf data query`:

**1. Existing customer Accounts (highest rank)**
```sql
SELECT Id, Name, Industry, BillingCity, BillingState, Phone, Website,
       (SELECT Id, Name, Title, Phone, Email, LastActivityDate FROM Contacts ORDER BY LastActivityDate DESC NULLS LAST LIMIT 3)
FROM Account
WHERE (Industry IN ('Construction','Roofing','HVAC','General Contractor','Remodeling','Home Services')
       OR Name LIKE '%Construction%' OR Name LIKE '%Roofing%' OR Name LIKE '%HVAC%'
       OR Name LIKE '%Builders%' OR Name LIKE '%Contractors%' OR Name LIKE '%Remodeling%')
  AND BillingCity IN ('Dallas','Fort Worth','Plano','Frisco','Argyle','Flower Mound',
                      'Denton','Arlington','McKinney','Allen','Lewisville','Carrollton',
                      'Irving','Grapevine','Southlake','Coppell','Richardson','Rockwall',
                      'Mansfield','Keller','Roanoke','Trophy Club','Northlake','Justin')
  AND BillingState IN ('TX','Texas')
ORDER BY LastActivityDate DESC NULLS LAST
LIMIT 50
```

**2. Recent Leads (cold-but-warming)**
```sql
SELECT Id, Company, FirstName, LastName, Title, City, State, Industry,
       Phone, Email, Status, LastActivityDate, CreatedDate, OwnerId
FROM Lead
WHERE (Industry IN ('Construction','Roofing','HVAC','General Contractor','Remodeling','Home Services')
       OR Company LIKE '%Construction%' OR Company LIKE '%Roofing%' OR Company LIKE '%HVAC%'
       OR Company LIKE '%Builders%' OR Company LIKE '%Contractors%' OR Company LIKE '%Remodeling%')
  AND City IN ('Dallas','Fort Worth','Plano','Frisco','Argyle','Flower Mound',
               'Denton','Arlington','McKinney','Allen','Lewisville','Carrollton',
               'Irving','Grapevine','Southlake','Coppell','Richardson','Rockwall',
               'Mansfield','Keller','Roanoke','Trophy Club','Northlake','Justin')
  AND State IN ('TX','Texas')
  AND IsConverted = false
ORDER BY LastActivityDate DESC NULLS LAST, CreatedDate DESC
LIMIT 50
```

**3. Decision-maker Contacts at Accounts (role-filtered)**
```sql
SELECT Id, FirstName, LastName, Title, Phone, MobilePhone, Email,
       LastActivityDate, Account.Name, Account.Industry, Account.BillingCity
FROM Contact
WHERE (Title LIKE '%Owner%' OR Title LIKE '%President%' OR Title LIKE '%CEO%'
       OR Title LIKE '%Founder%' OR Title LIKE '%Principal%' OR Title LIKE '%Partner%'
       OR Title LIKE '%General Manager%' OR Title LIKE '%VP%')
  AND Account.BillingCity IN ('Dallas','Fort Worth','Plano','Frisco','Argyle','Flower Mound',
                              'Denton','Arlington','McKinney','Allen','Lewisville','Carrollton',
                              'Irving','Grapevine','Southlake','Coppell','Richardson','Rockwall',
                              'Mansfield','Keller','Roanoke','Trophy Club','Northlake','Justin')
  AND Account.BillingState IN ('TX','Texas')
ORDER BY LastActivityDate DESC NULLS LAST
LIMIT 50
```

### Ranking Rubric (will apply after data lands)

1. **Existing customer + activity in last 90 days** → top tier
2. **Existing customer, dormant 90+ days** → second tier (re-engagement angle)
3. **Lead with prior reply / meeting / opportunity** → third tier
4. **Cold Lead in correct industry + DFW city** → fourth tier
5. Tie-break: presence of mobile phone (texting target), then title seniority (Owner > President > GM).

---

## Honest Assessment

**Confidence in current output: 0%.** No prospects were pulled — the entire pipeline is blocked at step 0 because the Salesforce CLI isn't on this machine. The queries above are pre-built and verified against standard Salesforce schema (Account, Lead, Contact with standard fields), but they have not been executed, so I have **zero** signal on whether Gus's org actually has DFW construction records, what custom fields might exist, or how clean the data is. The DFW city list and industry keywords are best-guess broad coverage; if Gus's org uses custom industry picklist values (e.g., "Trades — Construction") the `Industry IN (...)` clause will miss them and the `OR Name LIKE` fallback will carry the load. Once auth is live, expect a follow-up to tune the picklist values to match the org's actual taxonomy before trusting the ranking.
