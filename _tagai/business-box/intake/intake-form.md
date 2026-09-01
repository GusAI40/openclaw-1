# Client Intake — Construction Business-in-a-Box

One page. Fill this out with the owner on the call, then it feeds
`_tagai/business-box/deploy/deploy-vertical.sh` directly. Every field below
either becomes a deploy argument or turns a real feature on.

Nothing here is aspirational. If a tool isn't listed, the AI can't do it yet.

---

## Section 1 — Who the business is

| # | Field | Example | Feeds |
|---|---|---|---|
| 1 | **Business name** | Acme Builders LLC | display name in the AI's identity |
| 2 | **Owner first name** | Mike | how the AI greets them |
| 3 | **Client id** (we set this — lowercase, letters/numbers/dashes, 3-32 chars, starts with a letter) | `acme-builders` | `--client-id` AND `--subdomain` (`<client-id>.ubntag.com`) |
| 4 | **City / primary service area** | Flower Mound, TX (DFW metro) | drives the weather/storm alert location |

> The client id is the one field WE pick, not the owner. Keep it short and
> obvious. It becomes both the tenant id and the web address, e.g.
> `acme-builders.ubntag.com`.

---

## Section 2 — The Telegram id (the one that breaks if you skip it)

| # | Field | Example | Feeds |
|---|---|---|---|
| 5 | **Owner's NUMERIC Telegram id** | `123456789` | `--owner-telegram` |

This MUST be the numeric id, not the `@handle`. A username like "gus" or
"@mike" will silently fail — the AI won't be able to message the owner.

**How the owner gets their numeric id (30 seconds):**
1. Open Telegram.
2. Search for **@userinfobot** and open the chat.
3. Tap **Start** (or send any message).
4. It replies with `Id: 123456789` — that number is what we need.

If the owner doesn't have Telegram yet: have them install it from the app
store and create an account first, then do the 4 steps above.

---

## Section 3 — Which real tools they actually use

Check only what's true today. Each unlocks a specific day-1 feature. Leave
unchecked = that feature just stays off, no harm done.

| # | Field | If yes, turns on | Feeds |
|---|---|---|---|
| 6 | **Microsoft 365 email + calendar?** (Outlook / Office 365) | Morning digest from their inbox + calendar (Microsoft Graph) | `--owner-email` + post-deploy Graph consent |
| 7 | **Company website URL** | Website SEO watch | post-deploy config (note the URL) |
| 8 | **Salesforce?** (do they track leads/jobs in it) | Lead/job tracking via TAG's existing Salesforce skills | post-deploy skill enablement |

> `--owner-email` is required by the deploy script regardless. If the owner
> uses Microsoft 365, the SAME address also powers the morning digest. If they
> use Gmail or something else, we still set `--owner-email` for the account,
> but the digest stays off until a supported mailbox exists (see roadmap).

---

## Section 4 — Budget tier

| # | Field | Options |
|---|---|---|
| 9 | **Budget tier** | Starter / Standard / Pro (see `offer-1page.md`) |

Budget tier does not change a deploy argument — it sets the support level and
how many features we turn on at go-live. Record it so the offer matches what
was sold.

---

## Deploy mapping (what the operator runs after intake)

Run ON the Hetzner host as the `tagai` user:

```sh
./deploy-vertical.sh \
  --vertical construction \
  --client-id    <field 3> \
  --subdomain    <field 3>.ubntag.com \
  --owner-email  <field 6 address, or the account email> \
  --owner-telegram <field 5, numeric only>
```

| Intake field | Deploy argument |
|---|---|
| 3 — client id | `--client-id` and `--subdomain` |
| 6 — owner email | `--owner-email` |
| 5 — numeric Telegram id | `--owner-telegram` |
| (always) | `--vertical construction` |

**Manual prerequisite (not automated):** add the Vercel DNS A record
`<client-id>.ubntag.com -> 87.99.148.242` BEFORE deploy, or HTTPS won't issue.

Fields 4, 7, 8 are post-deploy configuration steps, not script args. Record
them on this form so the operator can finish wiring after the base deploy.
