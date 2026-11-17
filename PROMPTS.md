# Engineering Prompts History (`PROMPTS.md`)

This document logs the core engineering prompts and developer instructions used to design, build, and harden the **LiveWire** real-time event broadcasting platform.

---

### Phase 0: Project Scaffolding & Architecture Planning
**Prompt:**
> "Set up the LiveWire project structure for Phase 1 (Real-time Video Streaming + Chat + Presence) and Phase 3 (n8n Automations, Highlights, and Activity Notifications) according to the build blueprint. Scaffold the Expo mobile client, Supabase backend schema, and n8n workflows."

**Key Implementation Actions:**
- Initialized TypeScript-first mobile client with Expo SDK 58, Expo Router, and native WebRTC plugins.
- Authored initial Supabase database schema (`profiles`, `streams`, `chat_messages`, `follows`, `notifications`, `stream_highlights`, `stream_milestones`).
- Exported production-ready n8n workflow configurations for automated event triggers.

---

### Phase 1: Real-Time Live Event Broadcasting & SFU Video
**Prompt:**
> "Implement the Creator Broadcast flow and Viewer Watch flow using LiveKit Cloud SFU. Broadcaster must publish 1080p camera and stereo audio with sub-second latency. Viewers must subscribe without publish permissions."

**Key Implementation Actions:**
- Integrated `@livekit/react-native` and configured hardware media track controls.
- Implemented secure token negotiation via Supabase Edge Function (`livekit-token`), enforcing `canPublish: true` for the stream creator and `canPublish: false` for viewers.
- Designed confirmation modal and hardware back-button handler on Android to prevent accidental stream teardowns.

---

### Phase 1: Real-Time Chat & Idempotent Message Delivery
**Prompt:**
> "Build the real-time live chat system using Supabase Realtime postgres_changes. Ensure client-generated UUIDs for idempotency and ordering by server sequence to prevent out-of-order rendering."

**Key Implementation Actions:**
- Built optimistic message dispatch with auto-retry on network disconnects.
- Structured chat ordering strictly by Postgres sequence numbers (`seq`).
- Added 20-message gap-fill logic on reconnection to prevent missed chat messages.

---

### Phase 1: Live Presence Tracking
**Prompt:**
> "Track distinct live viewers using Supabase Presence. Filter out the broadcaster from the viewer count and maintain periodic 5-second heartbeats for peak viewer telemetry."

**Key Implementation Actions:**
- Tracked viewer sessions using unique user IDs to avoid double-counting multi-tab users.
- Implemented `report_viewer_count` heartbeat RPC to update `current_viewers` and `peak_viewers`.

---

### Phase 3: n8n Automations & Post-Event Analytics
**Prompt:**
> "Configure the automated event pipelines in n8n for stream started, viewer milestone alerts (2, 10, 50, 100), daily digests, and post-stream highlights with 30-second excitement windows."

**Key Implementation Actions:**
- Configured 4 webhook-driven n8n workflows (`01-stream-live-notify-followers.json`, `02-viewer-milestone-alert.json`, `03-stream-ended-highlights.json`, `04-daily-digest.json`).
- Designed deterministic fallback recap logic in PostgreSQL (`generate_stream_highlights`) so post-event analytics render with zero external API dependencies.

---

### Feature Extension: Broadcaster Screen Sharing
**Prompt:**
> "Can we also give the broadcaster the option to share his screen?"

**Key Implementation Actions:**
- Added vector `ScreenShareIcon` and interactive broadcaster toolbar toggle.
- Integrated `navigator.mediaDevices.getDisplayMedia` to dynamically swap WebRTC video tracks on active peer connections without interrupting audio or refreshing the session.
- Configured viewer viewport to detect screen sharing and adapt layout to `objectFit: contain` with an active status badge.

---

### Feature Extension: Follow System & Activity Inbox
**Prompt:**
> "The following button is not working and whenever someone follows I should get it in my activities."

**Key Implementation Actions:**
- Created atomic `toggle_follow(p_creator_id uuid)` security-definer RPC function.
- Expanded `notifications_type_check` constraint to support `new_follower`.
- Added Row Level Security insert policy on `public.notifications` for authenticated users.
- Updated viewer screen with `You (Host)` indicator to prevent self-follow errors.

---

### Analytics Refinement: 30-Second Excitement Duration Windows
**Prompt:**
> "Instead of 0:00 I would prefer 0:00 to 0:30 or a duration window for peak chat moments."

**Key Implementation Actions:**
- Refactored `summary/[id].tsx` to calculate and render 30-second duration windows (`0:00 – 0:30`).
- Updated summary narrative text formatter to output duration ranges (`between 00:00 – 00:30`).
- Synchronized database RPC and n8n workflows to generate 30-second interval buckets.

---

### Phase 2: Persistent Offline Outbox Queue & Network Synchronization
**Prompt:**
> "Alright now execute the plan for Phase 2."

**Key Implementation Actions:**
- Integrated `@react-native-community/netinfo` and authored `useNetworkStatus` hook with real-time connectivity listeners and platform fallbacks.
- Built persistent outbox storage layer (`offlineQueue.ts`, `useOfflineQueue.ts`) powered by AsyncStorage storing queued messages with client-generated UUID primary keys, timestamp tracking, and retry counts.
- Enhanced live chat pipeline (`useChat.ts`) to automatically divert outbound messages to persistent storage when offline or on network failure, with automatic FIFO queue draining and backoff upon network reconnection.
- Designed vector-based `OfflineBanner` component and visual status badges (`ClockIcon`, `WifiOffIcon`, `SyncIcon`) inside `ChatPanel` across viewer (`watch/[id].tsx`) and creator (`broadcast/[id].tsx`) interfaces.


