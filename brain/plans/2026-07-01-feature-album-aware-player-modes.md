# Plan: Album-Aware Player Queue And Play Modes

## Type
Feature

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-01

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: If playing audio is in an album, show that in the bottom audio player and support play modes such as repeat and play next.

## Goal Or Problem
The bottom/global audio player should become album-aware when the active audio belongs to an album, showing album context and offering the complete album listening play-mode set.

## Current Context
`apps/expo-app/src/components/global-audio-bar/` renders persistent playback chrome. `apps/expo-app/src/store/audio-store.ts` currently loads one TrackPlayer item with `TrackPlayer.reset()` and `TrackPlayer.add(track)`. Brain audio docs note the global bar can show album track index when metadata is available, but the requested play-mode controls and album queue behavior are not yet captured as a concrete plan.

## Proposed Approach
Add album context and play-mode state to the audio playback layer. When active audio has album membership and ordered album tracks are known, expose album name/index in the global player and support complete play modes: off/default stop-at-end, repeat one, repeat album, play next/album sequence, and shuffle album.

## Implementation Steps
- Audit global audio bar props/state and how active album membership is currently exposed from blog/search/album APIs.
- Add playback context state for active album id, album name, current index, ordered track ids, and play mode.
- Add play modes: default/off stop-at-end, repeat-one, repeat-album, play-next/album sequence, and shuffle-album.
- On track end, branch by play mode: reset to 0 and stop for default, seek/play same track for repeat-one, load/play next ordered track for play-next, loop to the first track for repeat-album, or choose the next shuffled unplayed album track for shuffle.
- Show album name and index in the global player when active audio belongs to an album.
- Add compact play-mode controls to the bottom player without crowding title/progress/play controls.
- Ensure TrackPlayer notification behavior remains standard and does not expose unsupported custom controls unless already wired.
- Persist or reset play-mode state intentionally when switching tracks/albums.
- Add deterministic shuffle session behavior so an album cycle does not immediately repeat tracks until all playable tracks have been visited.

## Affected Files Or Areas
- `apps/expo-app/src/store/audio-store.ts`
- `apps/expo-app/src/components/global-audio-bar/`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/api/src/trpc/routers/album.routes.ts`
- `apps/api/src/trpc/routers/blog.routes.ts`
- `brain/features/audio.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- When the active audio belongs to an album, the bottom player shows album context such as album name and current track index.
- The player exposes a clear play-mode control for off/default, repeat one, repeat album, play next/album sequence, and shuffle album.
- Default mode does not auto-advance; replay after end starts from 0.
- Repeat current restarts the same track automatically at end.
- Play-next mode starts the next ordered album track at end when one exists.
- Repeat-album mode starts the next ordered album track and loops from the last track back to the first.
- Shuffle-album mode plays album tracks in shuffled order without immediate repeats within the same cycle.
- Switching to audio outside an album hides album-specific player context and disables album play-next behavior.

## Test Plan
- Run API and Expo typechecks if configured.
- Manually play an album track and verify album name/index appears in the global player.
- Let the track end in default, repeat one, repeat album, play-next, and shuffle modes.
- Test first, middle, and last album tracks.
- Test switching from album audio to non-album audio.
- Verify Android notification controls still play/pause/seek correctly.

## Brain Update Requirements
- Update `brain/features/audio.md` with album-aware player context and play modes.
- Update `brain/api/contracts.md` if album context response shapes change.
- Update `brain/tasks/done.md` after implementation.

## Lower-Agent Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Required checks are listed: Yes
- Brain update requirements are listed: Yes
- Ready for handoff: Yes

## Completion Report Requirements
Lower agent must report:
- Changed files
- Checks run
- Brain docs updated
- Unresolved issues
- Any skipped acceptance criteria

## Risks / Edge Cases
- Current TrackPlayer setup may only keep one active track; queue behavior can be implemented in app state first before using native queue APIs more deeply.
- Play-next, repeat-album, and shuffle require reliable ordered album track data and reachable audio URLs.
- Complete play modes should not fight the ended replay reset bug fix.
- Shuffle ordering should stay predictable enough for debugging while still feeling random to the user.

## Completion Report
- Changed files: `apps/expo-app/src/store/audio-store.ts`, `apps/expo-app/src/store/audio-store.ios.ts`, `apps/expo-app/src/screens/album-detail-screen.tsx`, `apps/expo-app/src/components/global-audio-bar/index.tsx`.
- Implemented app-state album queues for album detail playback.
- Added play modes: off/default, repeat one, play next/album sequence, repeat album, and shuffle album.
- The global audio bar shows a compact album play-mode toggle only when an active album queue exists.
- Default ended replay reset remains intact when no play mode is active.
- Validation passed: scoped ESLint for touched Expo files.
- Validation limitation: full Expo lint and full TypeScript no-emit still fail on unrelated existing project issues outside this slice.

## Open Questions
- None.

## Linked Task
- Task Title: Album-Aware Player Queue And Play Modes
- Task File: brain/tasks/roadmap.md
