# Brain Intake: Blog Audio Organization And Import

## Status
Proposed

## Created Date
2026-06-15

## Last Updated
2026-06-15

## Raw Input
User requested analysis and planning for selecting two blogs and merging media/text, adding audio blogs to albums/playlists, album and playlist creation, album detail and same-channel media discovery, play history, YouTube-style timestamped quick comments, Telegram-style channel view, audio transcription, and a mobile blog import screen that checks a local API using the current network IP/local host approach, lists channels, starts channel import through the existing web/API import flow, works in local Expo and compiled APK builds, and continues import while the app is minimized. User also clarified that local API should use the same network IP mechanism currently used locally and provided a screenshot of a simple timestamp comment input.

## Generated Plans
- [ ] Merge Selected Blog Posts - `brain/plans/2026-06-15-feature-merge-selected-blog-posts.md` - Status: Proposed
- [ ] Harden Album Add Flow And Same-Channel Discovery - `brain/plans/2026-06-15-feature-album-add-flow-same-channel.md` - Status: Proposed
- [ ] Add Playlist API And Mobile Playlist Flow - `brain/plans/2026-06-15-feature-playlist-api-mobile-flow.md` - Status: Proposed
- [ ] Timestamped Quick Audio Comments - `brain/plans/2026-06-15-ux-ui-timestamped-quick-audio-comments.md` - Status: Proposed
- [ ] Persisted Audio Transcription Flow - `brain/plans/2026-06-15-feature-persisted-audio-transcription-flow.md` - Status: Proposed
- [ ] Local Blog Import Screen And Background Import Control - `brain/plans/2026-06-15-feature-local-blog-import-screen.md` - Status: Proposed

## Recommended Execution Order
1. Harden Album Add Flow And Same-Channel Discovery - album APIs and screens already exist, so this reduces risk before broader organization work.
2. Add Playlist API And Mobile Playlist Flow - builds on the same audio media selection patterns as albums.
3. Timestamped Quick Audio Comments - mostly isolated UI/API payload refinement and immediately improves the play screen.
4. Merge Selected Blog Posts - depends on clear mutation semantics and should follow organization safety work.
5. Persisted Audio Transcription Flow - requires provider cleanup and persistence decisions, but can ship independently.
6. Local Blog Import Screen And Background Import Control - largest environment-sensitive surface because it spans local API detection, compiled APK fallback, and background behavior.

## Agent Recommendations
- Merge Selected Blog Posts: open-code - transactional API and channel chat state changes are the main work.
- Harden Album Add Flow And Same-Channel Discovery: open-code - mostly tRPC validation plus existing album UI refinement.
- Add Playlist API And Mobile Playlist Flow: open-code - new router procedures and mobile screens are required.
- Timestamped Quick Audio Comments: antigravity - screenshot-driven mobile input polish benefits from visual UI iteration.
- Persisted Audio Transcription Flow: open-code - API/provider/persistence cleanup is the main risk.
- Local Blog Import Screen And Background Import Control: open-code - local network resolution and tRPC orchestration are the main work.

## Merged Items
- "Blog menu (audio) > add to album", "create album", "album screen", and "find and add media to album (same channel media only)" were merged into the album hardening plan because they share the existing album router, album screens, and add-to-album modal.
- "Blog menu (audio) > add to playlist" and "create playlist" were merged into one playlist plan because playlist schema exists but the API/UI flow is missing.
- "Play screen: quick add comment timestamped by default" and the screenshot clarification were merged into the timestamped quick comments plan.
- "Blog import screen", local dev detection, network IP, compiled APK/local Expo support, and minimized/background behavior were merged into the local import plan because they describe one import-control workflow.

## Duplicate Or Existing Items
- Album screen/detail already exists in `apps/expo-app/src/screens/albums-screen.tsx` and `apps/expo-app/src/screens/album-detail-screen.tsx`; plan focuses on missing create affordance and stronger same-channel rules.
- Play history already exists in `apps/expo-app/src/screens/play-history-screen.tsx` and `apps/expo-app/src/hooks/use-play-history-sync.ts`; no new plan was created unless future bugs are reported.
- Telegram-style channel view already exists in `apps/expo-app/src/screens/channel-chat-screen.tsx`; merge and add-to-collection improvements are planned against that existing surface.
- Local network host resolution already exists in `apps/expo-app/src/lib/base-url.ts`; import plan reuses it and adds compiled APK fallback.

## Needs Clarification
- Exact merge policy for two selected blogs: whether the first selected post is always canonical, whether the original secondary blog should be soft-deleted or kept as a child/comment, and how conflicting tags/comments should be ordered.
- Whether playlists should be user-global, channel-scoped, or support both.
- Whether minimized import only means "server import keeps running after mobile app starts it" or requires periodic mobile background status checks/notifications.

## Skipped Items
- None.

## Approval Notes
- None.

## Handoff Notes
- Use `brain-batch-handoff` to convert approved plans into handoffs and queue items.
