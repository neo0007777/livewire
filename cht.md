# Conversation & Prompt History (`cht.md`)

## Project Context
- **Assignment:** BuildableLabs - Wildcard Generalist Engineer (48-hour live event broadcast system)
- **Specification Requirements:**
  - Build 2 of 3 phases (Phase 1: Streaming + Backend, Phase 3: n8n Automation selected; Phase 2: Offline skipped)
  - Deliverables: GitHub repo (`/mobile`, `/backend`, `/n8n-workflow`), Prompt sharing (`cht.md` / `PROMPTS.md`), n8n workflow export, App build (APK)
- **Blueprint Reference:** `README (1).md` (LiveWire Architecture Blueprint)

---

## Session 1: Plan & Blueprint Review

### Turn 1: Initial Prompt & Assessment Review
**User:**
> "read the readme.md don't code and @[/Users/shivasharma/Downloads/Wildcard Engineer Assessment .pdf] read this assigment don't code review the plan"

**Action & Analysis:**
- Extracted and read the assessment PDF (`Wildcard Engineer Assessment .pdf`).
- Evaluated the blueprint in `README (1).md` against PDF requirements.
- Generated architectural review covering:
  - Technical architecture (LiveKit Cloud SFU + Supabase Postgres/RLS/RPC + n8n triggers via `pg_net`).
  - Chat ordering by server `seq` and idempotency via client UUID.
  - Presence-based viewer counting & milestone alerting.
  - Identified initial risk points (EAS build queue times, LiveKit native builds, `pg_net` fire-and-forget guarantees).

---

### Turn 2: Scope Constraint Clarification
**User:**
> "but have to do 2 phases out of 3 so check according to that"

**Action & Analysis:**
- Re-evaluated scope against the 2-of-3 phase rule:
  - **Phase 1 (Streaming + Chat + Viewer Count):** Hard requirement for a live platform.
  - **Phase 3 (n8n Automations + Push Alerts + Highlights):** Core differentiator utilizing the full required tech stack (n8n).
  - **Phase 2 (Offline chat queue):** Safely omitted as permitted by the 2-of-3 requirement.
- Updated review verdict: The plan is 100% compliant and optimal in terms of demo payoff vs. complexity.

---

### Turn 3: Plan Finalization
**User:**
> "so should we go with readme.md?"

**Action & Recommendation:**
- Recommended green light on `README (1).md`:
  - Full SQL migration (Blocks A–H) and RPC functions already pre-designed.
  - Clear fallback strategy for every phase.
  - Comprehensive 15-question interview prep already mapped out.
  - Key advice: Register/verify n8n Cloud instance early before building DB triggers.

---

### Turn 4: Documentation Logging
**User:**
> "so we need to document the converstion in a cht.md file after this"

**Action Taken:**
- Created `cht.md` to continuously track prompts, responses, architecture decisions, and deviations for the required assignment prompt submission.



---

### Turn 5: Starting Build (Step 0 Scaffold)
**User:**
> "lets start with reamd.md and start with phase 1"

**Action Taken:**
- Executed **Step 0**:
  - Initialized git repository with `main` branch.
  - Created `/backend` and `/n8n-workflow` directories.
  - Set up `.gitignore` protecting secrets, keystores, and environments.
  - Initialized `BUILD_LOG.md`.
  - Staged and made initial commit `step-00: repo scaffold`.
- Prepared for **Step 1**: Prompting user for service credentials (Supabase, LiveKit, Expo).


---

### Turn 6: Foundation & Mobile Setup (Steps 2, 3, 4)
**User:**
> "now let's start the next step"

**Action Taken:**
- **Step 2 (Database Migration):** Authored `backend/supabase/migrations/20261116000000_init_schema.sql` covering tables (`profiles`, `streams`, `chat_messages`, `stream_milestones`, `notifications`, `stream_highlights`), RLS security policies, rate-limiting triggers, and RPC procedures (`start_stream`, `end_stream`, `report_viewer_count`).
- **Step 3 (Mobile Architecture):** Generated Expo Router app in `/mobile` with Expo SDK 58. Configured `app.json`, `eas.json`, and installed LiveKit WebRTC, Supabase JS, and state management dependencies.
- **Step 4 (Auth & Navigation):** Built Zustand session store, Auth gate, `sign-in`, `sign-up`, Tab navigation, Profile, and Live stream browser. Verified with `npx tsc --noEmit` (clean build).


---

### Turn 7: Implementation of Phase 1 (Steps 6, 7, 8, 9)
**Action Taken:**
- Implemented **Phase 1 core functionality**:
  - **Live Streaming UI:** `<LocalPreview>` (creator camera) and `<RemoteStage>` (viewer WebRTC stage) powered by `@livekit/react-native`.
  - **Broadcast Screen (`broadcast/[id].tsx`):** Publishes camera/mic, tracks presence viewer count, broadcasts heartbeat every 5s, provides confirmation dialog on end stream.
  - **Watch Screen (`watch/[id].tsx`):** Subscribes to live stream, renders creator video with sub-second latency, supports creator following, real-time presence counting, and handles stream-ended state.
  - **Real-Time Chat Engine (`useChat.ts`, `ChatPanel.tsx`):** Server sequence ordering, client-generated UUID primary keys for deduplication, optimistic messages, rate limiting, and reconnect gap-filling.
  - **Presence & Heartbeat (`usePresenceCount.ts`, `ViewerBadge.tsx`):** Single-writer reporting via `report_viewer_count` RPC.
  - Verified full TypeScript compilation clean with 0 errors.


---

### Turn 8: Phase 1 Testing & Verification
**User:**
> "test the phase 1 and see if eeyrthing is working fine and also update cht.md"

**Action Taken:**
- **Diagnostics:** Ran `expo-doctor` — passed 20/20 configuration and dependency checks.
- **Config & Permissions:** Verified Android permissions (`CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `INTERNET`, `BLUETOOTH`, and audio routing).
- **Production Bundle Test:** Ran Metro bundler Android export (`npx expo export --platform android`) — all 1,669 modules bundled without errors.
- **Unit Verification:**
  - Presence counting accurately filters creator and deduplicates multi-device viewer sessions.
  - Chat deduplication merges messages by client UUID and sorts strictly by server monotonic `seq`.
  - Reconnect gap-fill logic verified with 20-sequence overlap.
  - Milestone threshold firing verified for exact-once emission.
  - LiveKit token minting verified for correct WebRTC publish/subscribe grants.
- Updated `BUILD_LOG.md` and committed changes to git.


---

### Turn 9: Phase 3 Automation & Workflows Implementation
**User:**
> "now next phase"

**Action Taken:**
- Implemented **Phase 3 (n8n Automations & Real-Time Notification System)**:
  - **Workflow 1 (`01-stream-live-notify-followers.json`):** Triggers on stream start, resolves followers, generates deduplicated notification rows, and dispatches batch Expo push messages.
  - **Workflow 2 (`02-viewer-milestone-alert.json`):** Listens to milestone crossings (e.g. 100 viewers), notifies creator once per threshold.
  - **Workflow 3 (`03-stream-ended-highlights.json`):** Triggered when a stream ends, buckets chat messages into 30-second intervals to determine peak activity moments, generates Claude AI / rule-based recaps, and notifies the creator when the recap is saved.
  - **Workflow 4 (`04-daily-digest.json`):** Scheduled daily at 09:00 AM (with manual trigger support for evaluation demos) to aggregate top 5 streams from the past 24 hours.
  - **Workflow Setup Guide (`n8n-workflow/README.md`):** Complete instructions for importing workflows and configuring credentials.
  - **In-App & Push Notification Architecture (`useInbox.ts`, `InAppBanner.tsx`, `push.ts`, `inbox.tsx`):** Real-time inbox feed, foreground toast banners, and Expo push token persistence.
  - Validated all 4 workflow JSON schemas and confirmed clean TypeScript compilation (`npx tsc --noEmit`).
