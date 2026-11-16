# Conversation & Prompt History (`cht.md`)

## Project Context
- **Assignment:** BuildableLabs - Wildcard Generalist Engineer (48-hour live event broadcast system)
- **Specification Requirements:**
  - Build 2 of 3 phases (Phase 1: Real-Time Streaming + Backend; Phase 3: n8n Automations & Workflows; Phase 2: Offline Queue omitted)
  - Deliverables: GitHub repository (`/mobile`, `/backend`, `/n8n-workflow`), Prompt sharing log (`cht.md`), n8n workflow JSON exports, production Android build (APK)
- **Architecture Blueprint:** `README.md` / `README (1).md` (LiveWire System Architecture)

---

## Session 1: Architecture Review & Scope Alignment

### Turn 1: Requirements Assessment & Architecture Review
**User:**
> read the readme and the assessment pdf first dont write any code just review the architecture and tell me if this plan works

**Action & Analysis:**
- Extracted and analyzed the assignment specification from `Wildcard Engineer Assessment .pdf`.
- Evaluated the blueprint in `README (1).md` against functional and non-functional requirements.
- Validated key architecture choices:
  - **LiveKit Cloud SFU:** Sub-second WebRTC video latency vs. traditional 10–30s HLS lag.
  - **Supabase Backend:** Zero custom application server; all business logic embedded in Postgres schemas, RLS policies, security-definer RPCs, and `pg_net` async triggers.
  - **Chat Engine:** Client UUID primary key for idempotent network retries + server-assigned monotonic `seq` column for global message ordering across unreliable phone clocks.
  - **Presence & Viewer Tracking:** Single-writer heartbeat architecture with 5s cadence to prevent write amplification.
- Highlighted key operational risks: EAS cloud build turnaround times, WebRTC native dependencies, and fire-and-forget push trigger guarantees.

---

### Turn 2: Scope Optimization (2-of-3 Phases Rule)
**User:**
> we only need to do 2 phases out of the 3 check which two make the most sense for the demo

**Action & Analysis:**
- Formulated comparative trade-off matrix:
  - **Phase 1 (Broadcasting, Chat, Presence):** Fundamental prerequisite for any live event platform; demonstrates full-stack systems engineering and WebRTC mastery.
  - **Phase 3 (n8n Automations, AI Recaps, Push Alerts):** Directly exercises the required n8n workflow stack, integrates AI summarization, and creates an impressive multi-device demo loop.
  - **Phase 2 (Offline Chat Queue):** Adds mobile SQLite sync complexity with lower relative demo impact for live video broadcasts.
- **Decision:** Locked in **Phase 1 + Phase 3** as the optimal path for technical depth and demonstration value.

---

### Turn 3: Technical Blueprint Sign-Off
**User:**
> so are we good to go with the blueprint in the readme or is there any blocker

**Action & Recommendation:**
- Formally approved the `README (1).md` implementation blueprint:
  - Complete SQL migration structure (Blocks A–H) and RPC functions mapped out.
  - Built-in fallback strategies for external services (LiveKit, Anthropic API, Expo Push).
  - Clean separation of concerns between client UI, Supabase DB triggers, and n8n webhook nodes.
- Recommended immediate setup of n8n Cloud and Supabase credentials to enable seamless end-to-end testing.

---

### Turn 4: Submission Documentation Tracking
**User:**
> we need to log this whole conversation in cht md for the submission

**Action Taken:**
- Initialized `cht.md` to maintain an immutable audit trail of engineering prompts, technical decisions, implementation steps, and verification logs.

---

## Session 2: Core Infrastructure & Phase 1 Implementation

### Turn 5: Repository Scaffolding & Environment Isolation
**User:**
> lets start building step 0 repo scaffold first and then kick off phase 1

**Action Taken:**
- Executed **Step 0**:
  - Initialized git repository on branch `main`.
  - Created root project structure: `/mobile`, `/backend`, and `/n8n-workflow`.
  - Configured comprehensive `.gitignore` safeguarding private keys, keystores, and environment variables.
  - Created `BUILD_LOG.md` to track time allocations, deliverables, and acceptance criteria.
  - Staged and committed `step-00: repo scaffold`.

---

### Turn 6: Database Migrations & Mobile Application Scaffold
**User:**
> scaffold looks good now move to database migrations and the mobile setup

**Action Taken:**
- **Step 2 (Database Schema & Security):** Created `backend/supabase/migrations/20261116000000_init_schema.sql` covering:
  - Relational schema: `profiles`, `streams`, `chat_messages`, `stream_milestones`, `notifications`, `stream_highlights`, `daily_digests`, `push_tokens`, `follows`.
  - Row Level Security (RLS) on all public tables with strict authenticated user policies.
  - Database triggers: auto-profile creation on signup, rate-limiting trigger (max 5 msgs/5s), and server-side `user_id` overwrite.
  - Security-definer RPCs: `start_stream`, `end_stream`, `report_viewer_count`.
- **Step 3 (Mobile Scaffold):** Initialized Expo Router app in `/mobile` with Expo SDK 58 and React Native 0.88. Configured `app.json` with permissions (`CAMERA`, `RECORD_AUDIO`, WebRTC) and plugins.
- **Step 4 (Auth & Navigation):** Built Zustand session management, Supabase Auth listeners, authentication gate, Tab navigation (Live, Go Live, Inbox, Profile), and browse screens. Verified clean compilation with `npx tsc --noEmit`.

---

### Turn 7: Real-Time Broadcasting, WebRTC Streaming & Live Chat
**User:**
> now build out the live streaming screens webrtc setup and the live chat with presence

**Action Taken:**
- Implemented **Phase 1 core modules**:
  - **LiveKit Deno Edge Function:** Created `livekit-token/index.ts` to mint WebRTC JWTs with role-based permissions (`canPublish: true` for creator, `canPublish: false` for viewers).
  - **Video Streaming Components:** Built `<LocalPreview>` (creator camera track) and `<RemoteStage>` (viewer WebRTC stage) with auto-reconnect handling.
  - **Broadcaster Screen (`broadcast/[id].tsx`):** Camera/mic publishing, real-time presence viewer count, 5s heartbeat RPC reporter, and exit confirmation traps.
  - **Viewer Screen (`watch/[id].tsx`):** Real-time video player with sub-second latency, creator follow/unfollow toggle, live viewer counters, and stream-ended event handlers.
  - **Chat Engine (`useChat.ts`, `ChatPanel.tsx`):** Implemented client-generated UUID deduplication, server-assigned monotonic `seq` ordering, optimistic UI updates, rate-limit warnings, and 20-sequence overlap reconnect gap-filling.
  - **Presence Counter (`usePresenceCount.ts`, `ViewerBadge.tsx`):** Realtime presence tracking with single-writer DB persistence.
  - Passed complete TypeScript validation (`npx tsc --noEmit`) with 0 errors.

---

### Turn 8: Phase 1 Test Suite & Native Bundle Verification
**User:**
> test phase 1 thoroughly check expo doctor run the android bundle export and verify chat and presence logic then update cht md

**Action Taken:**
- **System Diagnostics:** Ran `npx -y expo-doctor` — passed 20/20 checks with zero warnings.
- **Permissions Audit:** Inspected `npx expo config --type public` to verify Android permissions (`CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, audio routing).
- **Production Bundle Test:** Ran `npx expo export --platform android` — bundled 1,669 modules into Hermes bytecode without errors.
- **Unit Logic Verification:**
  - Presence filtering accurately excludes the broadcaster and deduplicates multi-session viewers.
  - Chat deduplication correctly merges duplicate UUIDs and preserves monotonic sequence order.
  - Reconnect gap-fill logic verified across simulated connection drops.
  - Milestone threshold trigger verified for exact-once execution.
  - LiveKit JWT permissions confirmed for publish/subscribe isolation.
- Logged verification results in `BUILD_LOG.md` and committed changes to git.

---

## Session 3: Phase 3 Automation & Production Hardening

### Turn 9: n8n Automation Workflows & Mobile Notification System
**User:**
> phase 1 is verified now start phase 3 build the n8n workflows and connect the push notification inbox

**Action Taken:**
- Built and validated all **Phase 3 automation workflows**:
  - **Workflow 1 (`01-stream-live-notify-followers.json`):** Webhook `/webhook/stream-live` → queries followers → batch-inserts deduplicated notification rows → dispatches Expo push notifications.
  - **Workflow 2 (`02-viewer-milestone-alert.json`):** Webhook `/webhook/viewer-milestone` → alerts broadcaster on milestone crossings (10, 50, 100 viewers) with composite key deduplication.
  - **Workflow 3 (`03-stream-ended-highlights.json`):** Webhook `/webhook/stream-ended` → 5s settle delay → chat moment bucketing (30s intervals) → Claude 3.5 Haiku AI recap (with rule-based fallback) → saves highlight to DB → notifies creator.
  - **Workflow 4 (`04-daily-digest.json`):** Scheduled cron (09:00 AM) + manual trigger node → aggregates top 5 streams of past 24 hours → distributes digest notifications.
  - **Workflow Documentation (`n8n-workflow/README.md`):** Complete guide for n8n import, PostgreSQL credential configuration, and webhook secret management.
  - **In-App & Push Notification Client:**
    - Built `useInbox.ts` subscribing to Supabase Realtime changes on `notifications`.
    - Built `<InAppBanner>` for animated top-screen toast notifications while using the app.
    - Built `push.ts` for Expo push token registration and database upsert.
    - Built interactive `inbox.tsx` screen with unread indicators, mark-as-read actions, and deep-link routing.

---

### Turn 10: Full-Stack Code Review & Edge Case Audit
**User:**
> do a deep code review of everything mobile backend and n8n look for any bugs or edge cases

**Action Taken:**
- Conducted exhaustive code review across Mobile, Backend SQL, LiveKit Edge Function, and n8n Workflows.
- Generated audit artifact (`deep-review.md`) categorizing findings:
  - **Critical Findings:**
    1. Expo template placeholder left in `src/app/index.tsx` causing screen flashing.
    2. Missing safety guards in n8n Workflow 03 `Code - Pick Summary` when handling empty message branches.
    3. Push token persistence after logout leaking alerts across accounts on shared devices.
  - **Medium Findings:**
    4. Inbox tab bar badge missing dynamic unread count display.
    5. Realtime channel name collision across concurrent `useInbox` instances.
    6. Stale closure trap in broadcaster `BackHandler` hardware exit confirmation.
    7. Subdirectory `.env` files not explicitly blocked in `mobile/.gitignore`.
  - **Minor Polish Findings:** Chat counter UI visibility and schema comments.

---

### Turn 11: Production Hardening & Bug Fixes
**User:**
> fix all the bugs you found and verify the build again

**Action Taken:**
- **Smart App Routing (`src/app/index.tsx`):** Replaced Expo template placeholder with dynamic redirection (`/(app)/(tabs)` for authenticated users, `/(auth)/sign-in` for guests).
- **Workflow Fault Tolerance (`03-stream-ended-highlights.json`):** Hardened `Code - Pick Summary` to prevent runtime `TypeError` crashes and reliably handle fallback between AI recap and rule summary on low-volume streams.
- **Push Token Security (`profile.tsx`):** Implemented automatic token deletion from `push_tokens` table on sign-out.
- **Inbox Navigation Badge (`(tabs)/_layout.tsx`):** Connected `useInbox().unreadCount` to `tabBarBadge` with custom badge styling.
- **Channel Isolation (`useInbox.ts`):** Generated instance-unique channel IDs to prevent subscription teardown collisions.
- **Hardware Back Handler (`broadcast/[id].tsx`):** Wrapped `confirmEnd` in `useCallback` to eliminate stale closures.
- **Environment Shielding (`mobile/.gitignore`):** Explicitly added `.env` and `.env.*` rules.
- **Verification:**
  - `npx tsc --noEmit` passed with 0 errors.
  - `npx expo export --platform android` compiled 1,738 modules cleanly into Hermes bytecode.
  - Updated `BUILD_LOG.md` and committed all fixes (Commit `4c017bc`).
