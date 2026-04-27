# OpenClaw 101 (2026 March 29): The Complete Guide to the AI Agent That Runs Your Life — with 75+ Real Use Cases from the Community

# The Product Channel By Sid Saladi


# OpenClaw 101 (2026 March 29): The Complete Guide to the AI Agent That Runs Your Life — with 75+ Real Use Cases from the Community
You know that feeling when you wake up and your phone already has a summary of your emails, a weather briefing, your calendar conflicts resolved, and a reminder about tonight’s dinner plan?
That’s not science fiction. That’s OpenClaw.
One guy named his instance “Crawdad.” It plans weekly meals for his family in Notion, generates grocery lists sorted by store and aisle, checks the weather to suggest grilling nights, and sends morning/evening digests. He estimates it saves an hour a week.
Another user gave an OpenClaw bot named Felix $1,000 and said “build a business while I sleep.” Three weeks later, Felix had launched a marketplace for OpenClaw agents, built info products, and pulled in over $14,000 in combined revenue. He now pays for his own API costs.
This is the most comprehensive guide to OpenClaw in 2026 — what it is, how to set it up, what real people are doing with it, and 75+ copy-paste use cases organized by who you are and what you need.
📌 If you’ve been here before: Earlier this year, we published a series of OpenClaw articles that absolutely blew up — they drove more new subscribers than almost anything else I’ve written:
- OpenClaw/Moltbot/ClawdBot 101: The Complete Guide — the original 101 guide that started it all
OpenClaw/Moltbot/ClawdBot 101: The Complete Guide — the original 101 guide that started it all
- How to Set Up OpenClaw (The Complete Guide — From Free to Paid) — step-by-step setup walkthrough covering every option from Oracle Cloud free tier to AWS to DigitalOcean (the “$0/month setup” that people keep sharing)
How to Set Up OpenClaw (The Complete Guide — From Free to Paid) — step-by-step setup walkthrough covering every option from Oracle Cloud free tier to AWS to DigitalOcean (the “$0/month setup” that people keep sharing)
- OpenClaw Use Cases: 35+ Real Ways People Are Using It — community-sourced use cases from Reddit, Discord, and beyond
OpenClaw Use Cases: 35+ Real Ways People Are Using It — community-sourced use cases from Reddit, Discord, and beyond
Hundreds of you tried the morning briefing. Dozens messaged me about email triage. Some of you built entire business dashboards overnight.
This article is the refreshed, consolidated version of all of them — updated for March 2026 with verified stats, corrected setup instructions, the latest security picture, new features (ClawHub native integration, SSH sandboxing, 24+ messaging channels, mobile apps), and expanded to 75+ use cases. If you read the originals, there’s significant new material throughout. If you’re brand new, this is the only article you need. And if you want the granular, step-by-step setup instructions (AWS free tier, Oracle Cloud, Docker hardening), the setup guide is still the best resource for that.
Quick navigation: Jump to what matters to you:
- Part 1: The 101 Guide — What it is, setup, features
Part 1: The 101 Guide — What it is, setup, features
- Part 2: My Personal Workflow — How I actually use it daily
Part 2: My Personal Workflow — How I actually use it daily
- Part 3: The Use Case Playbook — 75+ use cases by persona
Part 3: The Use Case Playbook — 75+ use cases by persona
- Part 4: Honest Limitations
Part 4: Honest Limitations
Let’s go.
The Product Channel By Sid Saladi is a reader-supported publication. To receive new posts and support my work, consider becoming a free or paid subscriber.

# Part 1: The 101 Guide

## “What Even Is OpenClaw?”
Let me tell you a truth.
Every AI tool you’ve used until now — ChatGPT, Claude, Perplexity — has one fundamental limitation.
You have to open it.
You go to a website. You type a prompt. You wait. You copy-paste the response. You go back to whatever you were doing. Repeat 50 times a day.
OpenClaw flips that model upside down.
Instead of you going to the AI, the AI comes to you. It lives inside WhatsApp. Telegram. Discord. Slack. Signal. Microsoft Teams. iMessage. Email. It runs 24/7 on a server you control. It watches, waits, and acts — on your behalf, on your schedule, with your permissions.
You don’t open an app. You don’t visit a website. You text it like you’d text a friend:
> “Hey, check my email. Summarize anything urgent.” “Research the top 5 competitors in [market] and save a report to my Drive.” “Every morning at 7am, pull my calendar and weather and send me a briefing.”
“Hey, check my email. Summarize anything urgent.”
“Research the top 5 competitors in [market] and save a report to my Drive.”
“Every morning at 7am, pull my calendar and weather and send me a briefing.”
And it just... does it. While you sleep. While you’re in meetings. While you’re living your life.
That’s OpenClaw. An open-source AI agent framework that connects large language models to your real-world tools and messaging apps.

## OpenClaw by the Numbers (March 2026)
- GitHub stars: 300,000+ (shot from 0 to 145K in a single week in January; now the fastest-growing open-source project in its category)
GitHub stars: 300,000+ (shot from 0 to 145K in a single week in January; now the fastest-growing open-source project in its category)
- Created by: Peter Steinberger (founder of PSPDFKit, joined OpenAI in February 2026; the project is transitioning to an independent open-source foundation)
Created by: Peter Steinberger (founder of PSPDFKit, joined OpenAI in February 2026; the project is transitioning to an independent open-source foundation)
- License: MIT (100% free and open-source)
License: MIT (100% free and open-source)
- Current version: v2026.3.24 (the project ships updates every 1–2 days)
Current version: v2026.3.24 (the project ships updates every 1–2 days)
- Name history: Clawdbot → Moltbot → OpenClaw (renamed after Anthropic filed a trademark complaint over the “Claud” prefix)
Name history: Clawdbot → Moltbot → OpenClaw (renamed after Anthropic filed a trademark complaint over the “Claud” prefix)
- Supported messaging channels: 24+ — WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Google Chat, Microsoft Teams, Matrix, LINE, Feishu/Lark, WeChat, IRC, Mattermost, Nextcloud Talk, Nostr, Twitch, Zalo, Synology Chat, BlueBubbles, Tlon, and WebChat
Supported messaging channels: 24+ — WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Google Chat, Microsoft Teams, Matrix, LINE, Feishu/Lark, WeChat, IRC, Mattermost, Nextcloud Talk, Nostr, Twitch, Zalo, Synology Chat, BlueBubbles, Tlon, and WebChat
- Supported models: GPT-5.4 (default), Claude Opus 4.6, Claude Sonnet 4.6, Gemini 3.1, Kimi 2.5, DeepSeek, Qwen, Llama, and any model via Ollama or OpenRouter
Supported models: GPT-5.4 (default), Claude Opus 4.6, Claude Sonnet 4.6, Gemini 3.1, Kimi 2.5, DeepSeek, Qwen, Llama, and any model via Ollama or OpenRouter
- Skills on ClawHub: 13,700+ (up from ~4,000 at the start of March)
Skills on ClawHub: 13,700+ (up from ~4,000 at the start of March)
- Native apps: macOS menu bar app, iOS app (Canvas + voice), Android app
Native apps: macOS menu bar app, iOS app (Canvas + voice), Android app
- Real cost: $0–60/month depending on setup (the software is free; you pay for APIs and hosting)
Real cost: $0–60/month depending on setup (the software is free; you pay for APIs and hosting)

## ⚠️ Before You Install Anything: A Security Note
I’m putting this here — right up front — because it matters more in March 2026 than it did in February.
OpenClaw has serious, well-documented security concerns. This isn’t speculation — it’s the findings of multiple independent security firms:
- 255+ security advisories published to GitHub’s advisory database (GHSA) as of late March
255+ security advisories published to GitHub’s advisory database (GHSA) as of late March
- 156 total CVEs tracked by the jgamblin/OpenClawCVEs community tracker
156 total CVEs tracked by the jgamblin/OpenClawCVEs community tracker
- 9 CVEs disclosed in just 4 days (March 18–21), including one scoring 9.9 out of 10 (CVSS) — it let any authenticated user escalate to admin
9 CVEs disclosed in just 4 days (March 18–21), including one scoring 9.9 out of 10 (CVSS) — it let any authenticated user escalate to admin
- 135,000+ OpenClaw instances exposed on the public internet across 82 countries (SecurityScorecard), with 15,000 specifically vulnerable to remote code execution
135,000+ OpenClaw instances exposed on the public internet across 82 countries (SecurityScorecard), with 15,000 specifically vulnerable to remote code execution
- 1,184 malicious skills identified on ClawHub by Antiy CERT — roughly 1 in 12 packages carried malicious payloads (the “ClawHavoc” supply-chain attack campaign)
1,184 malicious skills identified on ClawHub by Antiy CERT — roughly 1 in 12 packages carried malicious payloads (the “ClawHavoc” supply-chain attack campaign)
- NVIDIA announced NemoClaw at GTC 2026 — an enterprise security layer specifically because they recognized OpenClaw’s trust model is fundamentally broken without external hardening
NVIDIA announced NemoClaw at GTC 2026 — an enterprise security layer specifically because they recognized OpenClaw’s trust model is fundamentally broken without external hardening
This doesn’t mean you shouldn’t use it. It means you need to take security seriously from day one:
- Update to v2026.3.24 or later immediately — earlier versions contain critical RCE flaws
Update to v2026.3.24 or later immediately — earlier versions contain critical RCE flaws
- Bind the gateway to localhost (127.0.0.1) — the default on older versions was 0.0.0.0 (all interfaces, including public internet)
Bind the gateway to localhost (127.0.0.1) — the default on older versions was 0.0.0.0 (all interfaces, including public internet)
- Run in Docker with --read-only --cap-drop=ALL flags for reduced attack surface
Run in Docker with --read-only --cap-drop=ALL flags for reduced attack surface
```
--read-only --cap-drop=ALL
```
- Enable authentication — many exposed instances had no auth whatsoever
Enable authentication — many exposed instances had no auth whatsoever
- Vet every skill before installing from ClawHub — use the Skill Vetter skill, review source code, check requested permissions
Vet every skill before installing from ClawHub — use the Skill Vetter skill, review source code, check requested permissions
- Treat all credentials as potentially compromised if you ran a version before v2026.3.12
Treat all credentials as potentially compromised if you ran a version before v2026.3.12
I’ll go deeper in the Limitations section. But I wanted you to know this before you set anything up.

## Getting Started: Setup in 15 Minutes

### What You Need
- A computer to run OpenClaw on. Mac, Linux, or Windows (WSL2 strongly recommended on Windows). Can be your main machine, a Mac Mini (the community favorite for always-on setups), a Raspberry Pi, or a cloud VPS ($5/month on DigitalOcean or Hetzner).
A computer to run OpenClaw on. Mac, Linux, or Windows (WSL2 strongly recommended on Windows). Can be your main machine, a Mac Mini (the community favorite for always-on setups), a Raspberry Pi, or a cloud VPS ($5/month on DigitalOcean or Hetzner).
- Node.js 24 (recommended) or Node 22.16+ — this changed recently; the old guides saying Node 18 are outdated. Run node --version to check.
Node.js 24 (recommended) or Node 22.16+ — this changed recently; the old guides saying Node 18 are outdated. Run node --version to check.
```
node --version
```
- An API key from Anthropic, OpenAI, Google, or another provider (or run local models via Ollama for free)
An API key from Anthropic, OpenAI, Google, or another provider (or run local models via Ollama for free)
- A messaging app to connect — Telegram is the easiest to start with
A messaging app to connect — Telegram is the easiest to start with

### Step 1: Install
The fastest path — one command that handles Node.js and OpenClaw:
Mac/Linux:
```
curl -fsSL https://openclaw.ai/install.sh | bash
```
```
curl -fsSL https://openclaw.ai/install.sh | bash
```
```
curl -fsSL https://openclaw.ai/install.sh | bash
```
Windows (PowerShell):
```
iwr -useb https://openclaw.ai/install.ps1 | iex
```
```
iwr -useb https://openclaw.ai/install.ps1 | iex
```
```
iwr -useb https://openclaw.ai/install.ps1 | iex
```
Or via npm if you manage Node yourself:
```
npm install -g openclaw@latest
```
```
npm install -g openclaw@latest
```
```
npm install -g openclaw@latest
```

### Step 2: Run the Setup Wizard
```
openclaw onboard --install-daemon
```
```
openclaw onboard --install-daemon
```
```
openclaw onboard --install-daemon
```
The wizard walks you through:
- Choosing your AI model provider (Anthropic, OpenAI, Google, or local via Ollama)
Choosing your AI model provider (Anthropic, OpenAI, Google, or local via Ollama)
- Entering your API key
Entering your API key
- Configuring authentication
Configuring authentication
- Connecting your first messaging channel
Connecting your first messaging channel
The --install-daemon flag installs OpenClaw as a system service (launchd on Mac, systemd on Linux) so it starts automatically on boot and stays running 24/7.
```
--install-daemon
```

### Step 3: Verify Everything Works
```
openclaw gateway status   # Check the gateway is running
openclaw dashboard        # Open the Control UI in your browser
```
```
openclaw gateway status   # Check the gateway is running
openclaw dashboard        # Open the Control UI in your browser
```
```
openclaw gateway status   # Check the gateway is running
openclaw dashboard        # Open the Control UI in your browser
```
If the dashboard loads and you can type a message and get a reply, you’re live.

### Step 4: Connect a Messaging Channel
Telegram (easiest, recommended first):
- Open Telegram, chat with @BotFather
Open Telegram, chat with @BotFather
- Run /newbot and follow the prompts
Run /newbot and follow the prompts
```
/newbot
```
- Copy the token
Copy the token
- Paste into the OpenClaw setup wizard or add to your config
Paste into the OpenClaw setup wizard or add to your config
WhatsApp:
Open WhatsApp → Settings → Linked Devices → Scan the QR code that OpenClaw displays. Use a dedicated phone number — VoIP numbers get blocked, and the WhatsApp Web protocol can disconnect.
Discord, Slack, Signal, Microsoft Teams, Google Chat, Matrix, LINE, WeChat, and 15+ more channels are all supported. Check the official channel docs for setup instructions for each.
That’s it. Total time for basic setup: 10–15 minutes.

### Free vs. Paid Costs
Component Free Option Paid Option OpenClaw software Free (MIT license) Free (MIT license) AI model Ollama/local (free) or DeepSeek ($0.28/1M tokens) Claude Sonnet ($3/1M in) or GPT-5.4 Hosting Your own machine ($0) VPS ($5–15/mo) Total $0/month $10–60/month
Most users spend $15–30/month for a solid setup. The power user move: route simple tasks to cheap models (DeepSeek, Kimi 2.5) and reserve expensive models (Claude Opus, GPT-5.4) for complex reasoning. This alone can cut costs by 70%.

### Common Setup Issues (Updated March 2026)
- “SyntaxError” on startup → Your Node.js is too old. OpenClaw requires Node 22.16+ (Node 24 recommended). Run node --version to check. Use nvm install 24 to upgrade.
“SyntaxError” on startup → Your Node.js is too old. OpenClaw requires Node 22.16+ (Node 24 recommended). Run node --version to check. Use nvm install 24 to upgrade.
```
node --version
```
```
nvm install 24
```
- Gateway binds to 0.0.0.0 → This exposes your agent to the public internet. Change binding to 127.0.0.1 in your config immediately. Use Tailscale or SSH tunneling for remote access.
Gateway binds to 0.0.0.0 → This exposes your agent to the public internet. Change binding to 127.0.0.1 in your config immediately. Use Tailscale or SSH tunneling for remote access.
```
127.0.0.1
```
- WhatsApp disconnects randomly → Known issue with the unofficial WhatsApp Web protocol. Use Telegram as your primary channel (official bot API, much more stable). Keep WhatsApp as secondary.
WhatsApp disconnects randomly → Known issue with the unofficial WhatsApp Web protocol. Use Telegram as your primary channel (official bot API, much more stable). Keep WhatsApp as secondary.
- EACCES permission errors on npm → Use a Node version manager (nvm or fnm) instead of system-level npm installs. This fixes global package permission issues.
EACCES permission errors on npm → Use a Node version manager (nvm or fnm) instead of system-level npm installs. This fixes global package permission issues.
- “Module not found” after update → Run openclaw doctor --fix — it auto-resolves most config and dependency issues after upgrades. Also works for migrating legacy MOLTBOT_ /CLAWDBOT_ env variables.
“Module not found” after update → Run openclaw doctor --fix — it auto-resolves most config and dependency issues after upgrades. Also works for migrating legacy MOLTBOT_ /CLAWDBOT_ env variables.
```
openclaw doctor --fix
```

## Core Features Walkthrough

### 1. 24+ Messaging Channels
OpenClaw’s core superpower — and the biggest change since our original guide. You can now connect 24+ channels :
WhatsApp, Telegram, Slack, Discord, Signal, iMessage (via BlueBubbles), Google Chat, Microsoft Teams, Matrix, LINE, Feishu/Lark, WeChat (official Tencent plugin), IRC, Mattermost, Nextcloud Talk, Nostr, Twitch, Zalo, Synology Chat, Tlon, and WebChat.
Route different tasks to different channels. Personal stuff via WhatsApp, work via Slack, dev alerts via Discord, family coordination via Telegram.

### 2. ClawHub Skills Marketplace (NEW — v2026.3.22)
The biggest feature addition in March 2026. ClawHub is now natively integrated — no more manually downloading SKILL.md files. Install skills from the command line:
```
openclaw skills search tavily     # Search for skills
openclaw skills install tavily    # Install a web search skill
openclaw skills install notion    # Notion integration
openclaw skills install gmail     # Email management
openclaw skills update            # Update all installed skills
```
```
openclaw skills search tavily     # Search for skills
openclaw skills install tavily    # Install a web search skill
openclaw skills install notion    # Notion integration
openclaw skills install gmail     # Email management
openclaw skills update            # Update all installed skills
```
```
openclaw skills search tavily     # Search for skills
openclaw skills install tavily    # Install a web search skill
openclaw skills install notion    # Notion integration
openclaw skills install gmail     # Email management
openclaw skills update            # Update all installed skills
```

## Continue reading this post for free, courtesy of Sid Saladi.


## All links on page

- [(no text)](/)
- [(no text)](https://substack.com/@sidsaladi)
- [(no text)](https://substackcdn.com/image/fetch/$s_!tWbv!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fe51581b9-293e-4260-88ea-522a9f830a68_1536x1024.png)
- [OpenClaw/Moltbot/ClawdBot 101: The Complete Guide](https://sidsaladi.substack.com/p/openclawmoltbotclawdbot-101-the-complete)
- [How to Set Up OpenClaw (The Complete Guide — From Free to Paid)](https://sidsaladi.substack.com/p/how-to-set-up-openclaw-the-complete)
- [OpenClaw Use Cases: 35+ Real Ways People Are Using It](https://sidsaladi.substack.com/p/openclaw-use-cases-35-real-ways-people)
- [(no text)](https://substackcdn.com/image/fetch/$s_!YDvN!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F85aed0c1-bc87-4fde-aaf0-928842c49ca9_1400x3166.png)
- [AI agent](https://sidsaladi.substack.com/p/exploring-the-new-frontier-of-autonomous)
- [official channel docs](https://docs.openclaw.ai/channels)
- [Or purchase a paid subscription.](https://sidsaladi.substack.com/subscribe?simple=true&next=https%3A%2F%2Fsidsaladi.substack.com%2Fp%2Fopenclaw-101-2026-march-29-the-complete&utm_source=paywall&utm_medium=web&utm_content=192663356&just_signed_up=falsesimple=true&utm_source=paywall&utm_medium=email&utm_content=192663356&next=https://sidsaladi.substack.com/p/openclaw-101-2026-march-29-the-complete)
- [Privacy](https://substack.com/privacy)
- [Terms](https://substack.com/tos)
- [Collection notice](https://substack.com/ccpa#personal-data-collected)
- [Start your Substack](https://substack.com/signup?utm_source=substack&utm_medium=web&utm_content=footer)
- [Get the app](https://substack.com/app/app-store-redirect?utm_campaign=app-marketing&utm_content=web-footer-button)
- [Substack](https://substack.com)