# Build Log

## Step 0 — Repo scaffold — 2026-11-16
- Did: Initialized git repository on main branch; created `/backend`, `/n8n-workflow`; added `.gitignore`, `BUILD_LOG.md`, `README.md`, `cht.md`.
- Broke: None.
- Fixed: N/A.
- Acceptance: PASS — Folders exist, git repository initialized, sensitive file patterns (.env, *.keystore, google-services.json) ignored.
- Time spent: 0.2 h



## Step 2, 3 & 4 — DB Migration, Mobile Scaffold & Auth — 2026-11-16
- Did:
  - Created complete Supabase migration SQL `20261116000000_init_schema.sql` (Blocks A-H).
  - Scaffolded Expo Router React Native app in `/mobile` with Expo SDK 58.
  - Installed native WebRTC & LiveKit packages (`@livekit/react-native`, `@livekit/react-native-expo-plugin`, `@config-plugins/react-native-webrtc`, `livekit-client`).
  - Configured `app.json` with camera/audio permissions and plugins.
  - Set up Supabase client (`src/lib/supabase.ts`) with AsyncStorage and AppState auto-refresh.
  - Built Session store with Zustand (`src/stores/session.ts`).
  - Implemented Auth screens (`sign-in.tsx`, `sign-up.tsx`) and root navigation guard in `_layout.tsx`.
  - Built App Tab Layout (Live, Go Live, Inbox, Profile).
- Broke: `ListEmptyComponent` type error with null in FlatList.
- Fixed: Replaced `null` with `undefined` to satisfy VirtualizedListProps.
- Acceptance: PASS — TypeScript compile check (`npx tsc --noEmit`) passes with 0 errors.
- Time spent: 1.0 h


## Steps 6, 7, 8, 9 — Creator Broadcast, Viewer Watch, Realtime Chat & Presence — 2026-11-16
- Did:
  - Built LiveKit SFU components (`LocalPreview.tsx`, `RemoteStage.tsx`, `ViewerBadge.tsx`, `ChatPanel.tsx`).
  - Created `useStreamChannel.ts` subscribing to `stream:{id}` channel for chat messages, presence synchronization, and stream status changes.
  - Built `useChat.ts` with optimistic UI, client UUID idempotency, gap filling on reconnect (`lastSeq - 20`), and rate-limit error handling.
  - Implemented `usePresenceCount.ts` with Supabase Presence tracking distinct viewers and periodic 5s heartbeat (`report_viewer_count`).
  - Implemented Creator Broadcast screen (`broadcast/[id].tsx`) with LiveKit room publish, confirmation end-stream flow, and hardware back button trap.
  - Implemented Viewer Watch screen (`watch/[id].tsx`) with subscribe-only LiveKit stream, follow toggling, chat panel overlay, and stream ended state.
  - Implemented Stream Summary screen (`summary/[id].tsx`) showing peak viewers, duration, and real-time subscription to n8n highlights.
- Broke: TypeScript errors regarding `StyleSheet.absoluteFillObject` vs `absoluteFill` in RN 0.88 and `LiveKitRoom` style prop placement.
- Fixed: Replaced `absoluteFillObject` with `absoluteFill` and placed flex styles on inner container view.
- Acceptance: PASS — `npx tsc --noEmit` verified with 0 errors across the entire Phase 1 codebase.
- Time spent: 1.5 h


## Verification & Testing — Phase 1 Acceptance — 2026-11-16
- Did:
  - Executed `npx -y expo-doctor`: 20/20 diagnostics passed with zero warnings.
  - Executed `npx expo config --type public`: Android permissions (`CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, WebRTC network/audio permissions) verified and valid.
  - Executed full production bundle test `npx expo export --platform android`: 1669 modules bundled cleanly into Android JS entrypoint with no bundling or runtime resolution issues.
  - Executed unit verification test suite for core Phase 1 logic:
    - Verified presence counting excludes broadcaster and deduplicates multiple tabs/devices per user.
    - Verified chat client UUID deduplication and server sequence ordering.
    - Verified overlap gap-fill logic across simulated reconnections.
    - Verified milestone threshold deduplication.
    - Verified LiveKit JWT token permission granting (`canPublish: true` for creator, `canPublish: false` for viewer).
- Acceptance: PASS — All tests and bundle validations passed with 100% success.
- Time spent: 0.5 h


## Phase 3 — n8n Automation Workflows & Push Inbox — 2026-11-16
- Did:
  - Authored all 4 production n8n workflows in `/n8n-workflow/`:
    - `01-stream-live-notify-followers.json`: Webhook `/webhook/stream-live` -> `private.n8n_on_stream_live` -> Expo push batch.
    - `02-viewer-milestone-alert.json`: Webhook `/webhook/viewer-milestone` -> `private.n8n_on_milestone` -> Expo push batch.
    - `03-stream-ended-highlights.json`: Webhook `/webhook/stream-ended` -> wait 5s -> chat moment bucketing -> Claude API recap -> `private.n8n_save_highlight` -> `private.n8n_on_highlights_ready`.
    - `04-daily-digest.json`: Daily Cron (09:00 AM) + Manual trigger -> `private.n8n_daily_digest` -> Expo push batch.
  - Created `n8n-workflow/README.md` with credential setup (Postgres pooler, Webhook Secret, Anthropic key) and workflow activation instructions.
  - Built `useInbox.ts` hook subscribing to real-time `notifications` table changes.
  - Built `InAppBanner.tsx` for real-time foreground notification toast banners.
  - Built `push.ts` handling Expo push token registration and upsert into `public.push_tokens`.
  - Built interactive `inbox.tsx` screen with unread indicators and deep-link routing to broadcasts and recaps.
- Broke: `NotificationBehavior` in Expo SDK 58 missing required `shouldShowList` property.
- Fixed: Added `shouldShowList: true` to `setNotificationHandler`.
- Acceptance: PASS — JSON validation confirmed for all 4 workflows; TypeScript compilation clean with 0 errors.
- Time spent: 1.5 h
