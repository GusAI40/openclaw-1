# Welcome Message — Construction Go-Live (Telegram)

This is the first message the owner gets from their AI when the tenant goes
live. Send it from the deployed tenant to the owner's numeric Telegram id.
Replace `{OWNER_FIRST_NAME}` and `{BUSINESS_NAME}` before sending.

Honest by design: it only names features that are actually on. No fictional
integrations.

---

```
Hey {OWNER_FIRST_NAME}, this is your AI for {BUSINESS_NAME}. I'm live.

Think of me as a back-office hand that works while you're on the job. Here's
what's turned on right now:

1. Morning digest. Each morning I read your email and calendar and send you
   one short rundown: what's on today, who needs a reply, and anything time
   sensitive. No more digging through the inbox before coffee.

2. Storm and weather alerts. I watch the official weather service for your
   service area and warn you when bad weather is coming, so you can move a
   pour, reschedule a crew, or call ahead before the sky opens up.

3. Website watch. I keep an eye on your website's search visibility and flag
   it if something slips, so you don't quietly drop off Google.

You talk to me right here in Telegram. Ask me things in plain English:
  - "What's on my plate today?"
  - "Any weather I should worry about this week?"
  - "Read me the digest again."

A few honest notes so we're square:
  - I only message you (this chat). I'm locked to your account.
  - I never send a quote, email, or anything to a customer without you saying
    "send it" first. You're always the one who hits go.
  - I don't make up numbers. If a price isn't on your sheet, I'll ask.

Coming next (not on yet): pulling jobs and leads straight from your other
tools, and drafting quotes from your price sheet. We'll switch those on as we
wire them up.

Reply with "ready" and I'll send your first morning digest tomorrow.
```

---

## Sending notes for the operator

- Only the features the client actually qualified for at intake should be
  named. If the owner does NOT use Microsoft 365 email/calendar, delete the
  "Morning digest" bullet — do not promise it.
- If they have no website, delete the "Website watch" bullet.
- Weather alerts work for everyone (free NWS/weather.gov, no account needed),
  so that bullet always stays.
- The numeric-id lock is real: this message will only reach the owner if the
  numeric Telegram id from intake field 5 matches the account they message
  from.
