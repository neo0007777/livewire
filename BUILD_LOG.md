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
