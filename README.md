# LiveWire - Real-Time Live Event Broadcasting Platform

[![Expo SDK 58](https://img.shields.io/badge/Expo-SDK_58-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![LiveKit SFU](https://img.shields.io/badge/LiveKit-WebRTC_SFU-002B36?style=for-the-badge&logo=webrtc&logoColor=white)](https://livekit.io)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres_%2B_Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![n8n](https://img.shields.io/badge/n8n-Workflow_Automation-EA4B71?style=for-the-badge&logo=n8n&logoColor=white)](https://n8n.io)
[![Android Build](https://img.shields.io/badge/EAS_Build-Preview_APK-3880FF?style=for-the-badge&logo=android&logoColor=white)](https://expo.dev/accounts/shiva_2169/projects/livewire/builds/0461060b-1aff-4673-b9f9-d1114bca2104)

LiveWire is an enterprise-grade, real-time live event streaming and broadcasting platform built with React Native (Expo SDK 58), LiveKit WebRTC Selective Forwarding Unit (SFU), Supabase PostgreSQL, and n8n workflow automations. The system delivers sub-second glass-to-glass latency for mobile video broadcasts, synchronized interactive chat with persistent offline queueing, and automated event workflows for creator follower notifications, viewer milestone spikes, and post-event highlight summaries.

---

## Video Walkthrough & Demo

- **Loom Video Demo:** [https://www.loom.com/share/0c5572e0d8de48b685f04ab0738f1832](https://www.loom.com/share/0c5572e0d8de48b685f04ab0738f1832)
- **Coverage:** Creator broadcast setup, sub-second WebRTC viewer playback, synchronized real-time chat, offline outbox reconnection, n8n automations, and post-stream highlight analytics.

---

## Deliverables & Submission Links

| Deliverable | Description | Link |
|---|---|---|
| **Android Universal APK (Build #13 - Final Verified)** | Front/back camera toggle, remote viewer track binding, screen sharing foreground service, obsidian theme | [Download livewire-preview-v13.apk](https://expo.dev/artifacts/eas/B8iU3O8h_E3iuRLIDDChccMapEi2FwfB9KAPx6xE7cc.apk) \| [EAS Build Page](https://expo.dev/accounts/shiva_2169/projects/livewire/builds/0461060b-1aff-4673-b9f9-d1114bca2104) |
| **Video Walkthrough (Loom)** | End-to-end walkthrough of creator broadcast, viewer playback, chat sync, and n8n automations | [Watch Video on Loom](https://www.loom.com/share/0c5572e0d8de48b685f04ab0738f1832) |
| **Expo EAS Build Dashboard** | Cloud build telemetry, artifact downloads, and signing information | [EAS Build #0461060b](https://expo.dev/accounts/shiva_2169/projects/livewire/builds/0461060b-1aff-4673-b9f9-d1114bca2104) |
| **Architecture Blueprint** | Detailed system architecture specification and component requirements | [docs/BLUEPRINT.md](./docs/BLUEPRINT.md) |
| **Engineering Prompt Logs** | Comprehensive prompt evolution and technical execution history | [PROMPTS.md](./PROMPTS.md) & [cht.md](./cht.md) |
| **Test Verification Matrix** | Full Section 9 acceptance test verification logs (100% PASS) | [BUILD_LOG.md](./BUILD_LOG.md) |
| **Backend Documentation** | PostgreSQL database schema, RLS policies, and LiveKit token edge function | [backend/README.md](./backend/README.md) |
| **n8n Automation Guide** | Workflow JSON exports, credential schemas, and event trigger definitions | [n8n-workflow/README.md](./n8n-workflow/README.md) \| [n8n-all-workflows-export.json](./n8n-workflow/n8n-all-workflows-export.json) |

---

## Android APK Installation & Testing Guide

1. **Download the APK:**  
   Download [**`livewire-preview-v13.apk`**](https://expo.dev/artifacts/eas/B8iU3O8h_E3iuRLIDDChccMapEi2FwfB9KAPx6xE7cc.apk) directly on an Android device or via the [EAS Build Page](https://expo.dev/accounts/shiva_2169/projects/livewire/builds/0461060b-1aff-4673-b9f9-d1114bca2104).
2. **Install on Device:**  
   Open the downloaded package. When prompted, permit installation from unknown sources in Android system settings.
3. **Sign In with Test Credentials:**  
   Use the pre-configured 1-click authentication presets:
   - **Broadcaster / Creator:** `woww@test.com` (password: `test123456`)
   - **Audience / Viewer:** `viewer@test.com` (password: `test123456`)
4. **End-to-End Broadcast Verification:**
   - Navigate to the **Go Live** tab, enter a stream title, and tap **Start Broadcast**.
   - Test camera flip (front/back), microphone toggle, and **Share Screen** functionality.
   - Join the broadcast from a secondary device or browser tab, exchange real-time chat messages, and observe concurrent viewer tracking.
   - Conclude the broadcast by tapping **End Broadcast** to view the **Post-Event Summary** containing 30-second excitement windows and event recap metrics.

---

## System Architecture

```mermaid
flowchart TD
    subgraph MobileApp ["Mobile Client (Expo SDK 58 / React Native)"]
        Broadcaster["Creator Studio (Camera, Mic, Screen Share)"]
        Viewer["Viewer Player (LiveKit SFU, Chat, Follow)"]
        Inbox["Activity & Notifications Inbox"]
        Summary["Post-Event Telemetry & Highlights Screen"]
    end

    subgraph MediaRouting ["LiveKit Cloud SFU (WebRTC)"]
        SFU["LiveKit Audio/Video SFU Router (Sub-Second Latency)"]
    end

    subgraph DatabaseBackend ["Supabase (PostgreSQL / Edge Functions)"]
        EdgeAuth["Edge Function: livekit-token (JWT Issuer)"]
        DB["PostgreSQL: streams, chat_messages, follows, notifications"]
        RealtimeChannel["Supabase Realtime (Chat & Presence Sync)"]
        DBTriggers["Database Webhook Triggers (pg_net)"]
    end

    subgraph AutomationEngine ["n8n Automation Engine"]
        W1["01-stream-live-notify-followers"]
        W2["02-viewer-milestone-alert"]
        W3["03-stream-ended-highlights"]
        W4["04-daily-digest"]
    end

    Broadcaster -- "Publish Video/Audio/Screen" --> SFU
    SFU -- "Low-Latency Subscription" --> Viewer
    Broadcaster -- "Request Token" --> EdgeAuth
    Viewer -- "Request Token" --> EdgeAuth
    EdgeAuth -. "Sign JWT" .-> MediaRouting

    Broadcaster & Viewer -- "Chat & Presence" --> RealtimeChannel
    Broadcaster & Viewer -- "Persist State" --> DB

    DB -- "pg_net Webhooks" --> AutomationEngine
    W1 & W2 & W4 -- "Send Notifications" --> DB
    W3 -- "Save Highlights & Summary" --> DB
    DB -- "Realtime Alerts" --> Inbox
    DB -- "Fetch Analytics" --> Summary
```

---

## Core Capabilities & Architectural Scope

### 1. Real-Time Low-Latency Video Broadcasting (LiveKit WebRTC SFU)
- **Sub-Second Latency:** Ultra-low latency video/audio distribution using WebRTC media tracks over selective forwarding units.
- **Broadcaster Controls:** Dynamic hardware camera switching (front and rear), microphone mute/unmute, and resolution optimization up to 1080p.
- **Live Screen Sharing:** In-app screen broadcast via native display capture with automatic track negotiation on viewer clients.
- **Secure Token Minting:** Zero hardcoded credentials; JWTs are minted on-demand via the Supabase Edge Function ([`backend/supabase/functions/livekit-token/index.ts`](./backend/supabase/functions/livekit-token/index.ts)) with strict role validations (`canPublish: true` for broadcasters, `canPublish: false` for viewers).

### 2. Synchronized Interactive Chat & Presence Tracking
- **Ordered Message Delivery:** Monotonically increasing database sequence numbers (`seq`) enforce deterministic message ordering across all clients.
- **Reconnection Gap-Fill:** Automatic delta sync (`seq > lastSeq - 20`) eliminates message drops during network transitions.
- **Audience Presence:** Live viewer counts deduplicated by user ID via Supabase Realtime presence channels, excluding the broadcaster and handling multi-tab instances.
- **Heartbeat Telemetry:** Periodic 5-second heartbeats record `current_viewers` and update `peak_viewers` in PostgreSQL.

### 3. Persistent Offline Outbox Queue & Synchronization
- **Outbox Persistence:** Chat messages composed during network disruptions are stored locally using AsyncStorage with unique client-generated UUIDs.
- **Optimistic UI:** Local messages render immediately with a pending state indicator.
- **Automatic FIFO Draining:** When network connectivity is re-established, the queue flushes messages sequentially in first-in-first-out order with deduplication guarantees.

### 4. n8n Event-Driven Automations & Analytics
- **Workflow 1 ([01-stream-live-notify-followers.json](./n8n-workflow/01-stream-live-notify-followers.json)):**  
  Triggers when a stream status transitions to `live`. Dispatches in-app inbox items and push notifications to all registered followers using deduplication keys (`live:<stream_id>:<follower_id>`).
- **Workflow 2 ([02-viewer-milestone-alert.json](./n8n-workflow/02-viewer-milestone-alert.json)):**  
  Monitors concurrent viewer thresholds (including 100 viewers). Fires targeted in-app alerts to the creator once per milestone tier.
- **Workflow 3 ([03-stream-ended-highlights.json](./n8n-workflow/03-stream-ended-highlights.json)):**  
  Triggers on stream completion. Analyzes chat message density across 30-second sliding windows to pinpoint peak engagement moments (`0:00 - 0:30`). Generates structured event recap narratives with deterministic fallback logic requiring zero external API keys. (Optional Gemini Flash integration available in [`03-stream-ended-highlights-gemini.json`](./n8n-workflow/03-stream-ended-highlights-gemini.json)).
- **Workflow 4 ([04-daily-digest.json](./n8n-workflow/04-daily-digest.json)):**  
  Scheduled daily cron execution aggregating the top 5 broadcasts from the preceding 24 hours and delivering digest cards to all user feeds.

---

## Repository Structure

```
├── backend/
│   ├── README.md                                  # Backend and database documentation
│   └── supabase/
│       ├── functions/livekit-token/index.ts       # Edge function minting LiveKit JWT tokens
│       └── migrations/
│           ├── 20261116000000_init_schema.sql     # Base tables, RLS policies, triggers, RPCs
│           ├── 20261117000000_allow_concurrent... # Concurrent stream support
│           ├── 20261117000001_follow_and_act...   # Notification RLS security policies
│           └── 20261117000002_follow_and_act...   # Highlight bucketing and 30s moments
├── docs/
│   └── BLUEPRINT.md                               # Architectural requirements and specification
├── mobile/
│   ├── app.json                                   # Expo application configuration and plugins
│   ├── eas.json                                   # EAS cloud build profiles
│   ├── package.json                               # Client dependencies and build scripts
│   └── src/
│       ├── app/                                   # Expo Router file-based screens
│       │   ├── (app)/(tabs)/                      # Bottom tab navigation (Live, Studio, Activity, Profile)
│       │   ├── (app)/broadcast/[id].tsx           # Creator broadcast studio
│       │   ├── (app)/watch/[id].tsx               # Viewer playback player
│       │   └── (app)/summary/[id].tsx             # Post-event analytics and highlight moments
│       ├── components/                            # Reusable UI primitives (ChatPanel, ViewerBadge, etc.)
│       └── hooks/                                 # Custom React hooks (useChat, useStreamChannel, etc.)
├── n8n-workflow/
│   ├── 01-stream-live-notify-followers.json       # Follower notification automation
│   ├── 02-viewer-milestone-alert.json             # Viewer milestone automation
│   ├── 03-stream-ended-highlights.json            # Stream highlights automation (rule-based)
│   ├── 03-stream-ended-highlights-gemini.json     # Stream highlights automation (Gemini free tier)
│   ├── 04-daily-digest.json                       # Daily digest cron automation
│   ├── n8n-all-workflows-export.json              # Consolidated n8n export bundle
│   └── README.md                                  # n8n setup and credential configuration guide
├── BUILD_LOG.md                                   # Verification matrix and build records
├── PROMPTS.md                                     # AI engineering prompt logs
└── README.md                                      # Repository documentation and deliverables
```

---

## Architectural Decisions & Trade-Offs

| Decision | Alternative Evaluated | Engineering Rationale |
|---|---|---|
| **LiveKit SFU (WebRTC)** | HLS / RTMP / AWS IVS | Traditional HLS introduces 10-30 seconds of latency, preventing live chat synchronization. LiveKit provides sub-second latency with official Expo SDK support. |
| **Supabase Postgres + RLS** | Custom Express + Redis | Eliminates server maintenance overhead. Database-level Row Level Security guarantees multi-tenant isolation directly in PostgreSQL. |
| **Deterministic Highlight Fallback** | Mandatory Third-Party AI API | Ensures reliable grading and testing without external API key dependencies. The system calculates 30-second peak moments natively (`summary_source = 'rule'`) at zero cost. |
| **Comprehensive Scope** | Partial Implementation | Fully implements real-time video broadcasting, synchronized chat, offline outbox persistence, and automated n8n workflows. |

---

## Security Hardening

- **Row Level Security (RLS):** RLS is enabled on all tables (`profiles`, `streams`, `chat_messages`, `follows`, `notifications`, `stream_highlights`).
- **Identity Integrity:** Database triggers overwrite `user_id` with `auth.uid()` on inserts, preventing client-side identity spoofing.
- **Scoped SFU Access:** LiveKit credentials are kept server-side; clients receive time-limited JWTs granting only the required publish or subscribe permissions.
- **Zero Committed Secrets:** All API keys, database passwords, and connection strings are managed strictly through environment variables.

---

## Acceptance Test Verification

All requirements verified with a 100% pass rate in [`BUILD_LOG.md`](./BUILD_LOG.md):

- **Authentication:** Instant profile provisioning upon registration, session persistence across restarts.
- **Broadcast Studio:** Sub-second latency playback, camera flip, microphone toggle, display capture screen sharing.
- **Interactive Chat:** Strict sequence ordering, real-time sync, offline outbox queuing, and automatic reconnection flush.
- **Audience Presence:** Accurate viewer tracking deduplicated by user ID, excluding broadcaster.
- **Automations:** Real-time follower alerts on stream start, viewer milestone alerts, and post-event highlight generation.

---

## Demo Credentials

Evaluators can sign in immediately using the one-tap demo buttons on the authentication screen:
- **Broadcaster / Creator:** `woww@test.com` (password: `test123456`)
- **Audience / Viewer:** `viewer@test.com` (password: `test123456`)
