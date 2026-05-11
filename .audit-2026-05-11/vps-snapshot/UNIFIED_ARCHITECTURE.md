# Unified Command Center — Architecture

## Vision
One system. Three businesses. Zero manual work.

## The Stack

```
                         ┌──────────────────────┐
                         │   GOD MODE DAEMON     │
                         │  Daily 6 AM Central   │
                         │  Scans all businesses │
                         └──────┬───────┬───────┘
                                │       │
            ┌───────────────────┘       └──────────────────┐
            ▼                                               ▼
┌───────────────────────┐                    ┌───────────────────────┐
│   INBOUND ENGINE      │                    │   OUTBOUND ENGINE     │
│   (Maya - LiveKit)    │                    │   (Telemarketer)      │
├───────────────────────┤                    ├───────────────────────┤
│ Website voice orb     │                    │ SIP outbound calls    │
│ SIP inbound calls     │                    │ Cold email (Resend)   │
│ MLS property search   │                    │ Lead scoring          │
│ Tour scheduling       │                    │ Follow-up automation  │
│ Page navigation       │                    │                       │
└───────────────────────┘                    └───────────────────────┘
         │                                               │
         └───────────────────┬───────────────────────────┘
                             ▼
              ┌─────────────────────────────┐
              │     COMMAND CENTER UI       │
              │  (Next.js Dashboard)        │
              ├─────────────────────────────┤
              │ Leads | Calls | Revenue     │
              │ Pipeline | Tasks | Reports  │
              └─────────────────────────────┘
```

## Phase 1: Foundation (Tonight)
- [x] GOD MODE daemon framework running
- [ ] Wire quiet mode to agent (VAD threshold)
- [ ] Fix SIP dispatch rule for inbound calls

## Phase 2: Connect (Next)
- Deploy telemarketer to LiveKit Cloud
- Connect cold email engine (Resend)
- Build weekly CEO report

## Phase 3: Command Center (Future)
- Unified dashboard
- Multi-agent handoffs
- Automated daily scan with alerts
