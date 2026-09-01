# Multi-Tenant 6000 Call Simulation

## The Scenario

| User | Campaigns | Calls per Campaign | Total Calls |
|------|-----------|-------------------|-------------|
| Gus | TAG AI | 1000 | 3000 |
| Gus | Spectrum Business | 1000 | |
| Gus | Website Rescue | 1000 | |
| Julian | Julian's Pipeline | 1000 | 3000 |
| Julian | TAG AI (reselling) | 1000 | |
| Julian | Spectrum (reselling) | 1000 | |
| | | **Grand Total** | **6000** |

---

## SIMULATION

### 1. TENANT ISOLATION

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 1 | Gus makes a call. Julian makes a call. Same time. | Both calls go through the same LiveKit room? Or separate rooms? | 🔴 If same room, they hear each other |
| 2 | Gus's prospect answers. Julian's prospect answers. Same time. | 2 concurrent calls. Both need the AI agent. Do we have 2 agents? | 🔴 Need 2 agent instances |
| 3 | Gus switches from TAG AI to Spectrum mid-batch | AI must swap instructions + phone number + voice mid-stream | 🟡 Need hot-swap config |
| 4 | Gus calls for Spectrum but uses TAG AI instructions accidentally | Wrong pitch. Wrong phone number. Prospect confused. | 🔴 Config mixing |
| 5 | Gus leaves laptop. Julian starts calling. | No conflict. Different rooms. Different queues. | 🟢 Clean |
| 6 | Gus and Julian both want to barge in at the same time | Two different calls. No conflict. | 🟢 Clean |
| 7 | Julian deletes a prospect from his list. Gus's list unaffected | Data isolation works. | 🟢 Clean |
| 8 | Gus views call history. Sees Julian's calls mixed in | Data leak. Julian's prospects visible to Gus. | 🔴 Privacy breach |
| 9 | Julian's API key leaks. Attacker accesses Julian's data only | Compartmentalized. Gus's data safe. | 🟡 Isolated |

### 2. CONCURRENT CALLS

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 10 | Gus calls 5 prospects at once. Julian calls 5 at once. | 10 concurrent calls. Telnyx trunk limit (est. 5-10). We hit the ceiling. | 🔴 Throttled |
| 11 | Both users hit progress dial at 9:00 AM | 10 simultaneous dials. Queue builds instantly. | 🟡 Manageable |
| 12 | One user hogs all 5 concurrent slots | Other user waits. Queue backup. | 🟡 Needs fairness |
| 13 | Total concurrent SIP participants across all rooms | LiveKit Cloud may have a project-wide SIP participant limit. | 🔴 Unknown cap |
| 14 | Same prospect called by both Gus and Julian (duplicate) | Prospect gets 2 calls. Confused. | 🟡 Dedup needed |

### 3. CAMPAIGN SWITCHING

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 15 | Gus switches from TAG AI → Spectrum mid-queue | Queue pauses. New queue loads. Prospect list swaps. | 🟢 Smooth if designed right |
| 16 | Gus switches mid-call (prospect is active on TAG AI call) | Cannot switch while call is active. Must finish or hangup first. | 🟡 UX constraint |
| 17 | Gus starts Spectrum campaign with wrong phone number | Shows wrong caller ID. Prospect sees "TAG AI" not "Spectrum". | 🔴 Wrong identity |
| 18 | Gus starts Spectrum campaign with wrong AI instructions | AI says "I'm from TAG AI" while calling for Spectrum. Confusing. | 🔴 Wrong pitch |
| 19 | Voice per campaign: should Gus's voice clone be used for all? | If yes, no change needed. If different, need separate voice per campaign. | 🟢 Gus's voice for all |
| 20 | Caller ID reputation per campaign | Spectrum number might be fresh. No reputation. Marked as spam. | 🟡 Warm numbers first |

### 4. MULTI-USER QUEUE

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 21 | Gus queues 1000 TAG AI calls. Julian queues 1000 calls. | 2000 total in queue. Server processes them sequentially per user slot. | 🟢 Manageable |
| 22 | Gus pauses his queue. Leaves for lunch. | Gus's calls stop. Julian's continue. No impact. | 🟢 Independent |
| 23 | Gus's queue finishes. Julian's keeps going. | No conflict. | 🟢 Clean |
| 24 | Both users have priority prospects | No prioritization system. First come, first served. | 🟡 Add priority later |

### 5. VOICE CLONES

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 25 | Gus records voice memo. Julian records voice memo. | Each gets their own Cartesia voice ID. Stored per user. | 🟢 Clean |
| 26 | Gus wants different voices for different campaigns | One voice per user. All campaigns use same voice. | 🟡 Can extend later |
| 27 | Cartesia cloning API fails for one user | Other user's clone unaffected. | 🟢 Independent |
| 28 | Voice quality degrades over time | Re-clone with new voice memo. Same process. | 🟢 Easy refresh |

### 6. CALL LOGGING & ANALYTICS

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 29 | 6000 call logs. Gus sees only his 3000. Julian sees his 3000. | RLS (Row Level Security) on Supabase. Each user filters by user_id. | 🟢 Clean |
| 30 | Gus wants to see Julian's performance | Admin view. Gus can see all users. Julian sees only own. | 🟡 Role-based access |
| 31 | Call costing: who pays for what? | Each call tagged with user_id + project_id. Bill per user. | 🟢 Traceable |
| 32 | Storage: 6000 transcripts = ~1.2GB | Supabase free tier: 500MB. Need upgrade. | 🟡 Upgrade plan |

### 7. WEB APP

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 33 | Gus and Julian both open the web app at the same time | Two separate browser tabs. Two separate WebRTC connections. No conflict. | 🟢 Clean |
| 34 | Gus logs in. Sees Julian's calls in the sidebar | Bad. Need proper auth. | 🔴 Auth required |
| 35 | Julian shares his login link. Someone else accesses his account. | Julian's data exposed. | 🔴 Need password |
| 36 | Web app loads 6000 prospect names in the queue sidebar | Scroll performance degrades. Paginate to 50 at a time. | 🟡 Pagination needed |
| 37 | Gus is on TAG AI view. Julian calls him on phone. He switches to Julian's view. | Seamless. Dropdown click. | 🟢 Clean |

### 8. OPERATIONAL

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 38 | Server restarts. Both users lose their queues. | Both queues in memory. Lost. Persist to Supabase. | 🔴 Recoverable |
| 39 | Groq API down. Both users affected. | No LLM. No calls for anyone. | 🔴 Single point of failure |
| 40 | Telnyx trunk down. Both users affected. | No outbound calls for anyone. | 🔴 Single point |
| 41 | LiveKit Cloud incident. Both users affected. | No rooms. No calls. | 🔴 Single point |
| 42 | Supabase down. | No prospect lists loaded. No call logging. Queue cannot start. | 🔴 Single point |
| 43 | Cartesia down. | No TTS. AI cannot speak. Calls go silent. | 🔴 No fallback |

### 9. BILLING

| # | Scenario | What Happens | Risk |
|---|----------|-------------|------|
| 44 | Gus uses 3000 calls worth of API credits. Julian uses 3000. | Need separate billing per user. Track via user_id. | 🟡 Implement per-user cost |
| 45 | Telnyx bill comes for 6000 calls. Who pays? | Single Telnyx account. Single bill. | 🟡 Allocate after the fact |
| 46 | Grok API shared key between both users | Shared quota. One user can exhaust the other's calls. | 🔴 Separate API keys needed |

---

## Top 7 Actionable Risks Before Building

| Priority | Risk | Solution |
|----------|------|----------|
| 1 | **Shared Groq/Deepgram API key** | One user exhausts quota, the other is blocked. All 6000 calls through one key. | Get separate API keys per user. Or set per-user daily caps. |
| 2 | **Telnyx trunk concurrent limit** | 10 simultaneous calls between both users will exceed trunk capacity. | Check Telnyx plan. Upgrade if needed. Implement global semaphore. |
| 3 | **No auth on web app** | Anyone with the URL can listen to live calls. Julian sees Gus's data. | Add password login from day one. |
| 4 | **LiveKit Cloud SIP cap** | Unknown project-wide SIP participant limit. 10 simultaneous calls may hit a cap. | Test with 10 concurrent participants. Upgrade plan if needed. |
| 5 | **Voice per campaign** | If Spectrum needs a different voice than TAG AI, we need per-campaign voice IDs. | Design the config table with a `voice_id` column per campaign. |
| 6 | **All SPOFs** | Groq, Telnyx, LiveKit, Cartesia, Supabase — any one goes down, both users stop. | Add fallbacks: OpenAI for Groq, Whisper for Deepgram, etc. |
| 7 | **No offline queue** | Server restart loses both users' queues. | Persist queue to Supabase every time a call finishes. Resume on restart. |

## Architecture Decision: Per-User Rooms vs Shared Room

| Approach | What Happens | Verdict |
|----------|-------------|---------|
| **Separate rooms per user** | Gus connects to `room-gus`. Julian connects to `room-julian`. Each user's calls happen in their own room. No cross-talk. | ✅ Correct isolation |
| **Shared room** | Gus and Julian in the same room. They hear each other's calls. Confusing. | ❌ Noise |

**Decision: Each user gets their own persistent room.** Gus's web app connects to `room-gus`. Julian's web app connects to `room-julian`. When Gus makes a call, the prospect joins `room-gus`. When Julian makes a call, the prospect joins `room-julian`. No cross-talk.
