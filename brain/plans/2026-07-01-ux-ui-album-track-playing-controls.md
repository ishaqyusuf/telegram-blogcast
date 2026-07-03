# Plan: Album Track Playback Indicators And Row Controls

## Type
UX/UI

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-01

## Completion Notes
- Added per-track play/resume/pause controls to normal album track rows.
- Highlighted the active album track by matching current audio blog/media ids against album row ids.
- Preserved row navigation, long-press selection, actions, and reorder-mode controls.
- Fixed the local `rawTracks` memo warning in `album-detail-screen.tsx`.
- Validation passed: `bunx eslint src/screens/album-detail-screen.tsx` from `apps/expo-app`.
- Validation limitation: full `bun --cwd apps/expo-app lint` still fails on unrelated existing lint errors outside this slice.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: When opening an album and the current playing track is in the album, show an indication. Tracks should have play icons, and the current playing track should show a pause icon.

## Goal Or Problem
Album detail should clearly show which track is currently active, let users start tracks directly from the album track list, and show pause on the currently playing row.

## Current Context
Album detail lives in `apps/expo-app/src/screens/album-detail-screen.tsx`. Album API responses include ordered media through `albumAudioIndex`. The audio store tracks the active track/blog and playing state. Prior album plans added Tracks/Add tabs and reorder behavior, but the requested per-track playback indicators are not captured as completed behavior.

## Proposed Approach
Render album track rows with a leading play/pause control derived from the global active audio state. If the active audio's media/blog id belongs to the opened album, highlight that row and show a pause icon when playing. Tapping a non-active row loads and plays that track. Tapping the active playing row pauses; tapping the active paused row resumes.

## Implementation Steps
- Audit album track row rendering in `album-detail-screen.tsx` and identify media/blog identifiers available per row.
- Add helper logic to compare each row's media/blog id to `useAudioStore` active state.
- Add a leading icon button for every track row with play, pause, and loading/disabled states as needed.
- Add a clear current-track visual indication that does not interfere with reorder controls.
- Wire play/pause behavior through existing audio store methods and preserve passive navigation rules from the audio-detail plan.
- Ensure row press/navigation and icon press do not conflict.
- Keep reorder controls available only in the intended Tracks tab state.

## Affected Files Or Areas
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/store/audio-store.ts`
- `apps/expo-app/src/components/audio-blog-view/`
- `apps/expo-app/src/components/ui/icon.tsx`
- `brain/features/audio.md`

## Acceptance Criteria
- Every album track row shows a play icon when it is not the currently playing active track.
- The active playing row shows a pause icon.
- The active paused row shows a play/resume icon while retaining current-track indication.
- Opening an album containing the currently playing audio highlights or otherwise indicates that track.
- Tapping a track's play icon starts that track without breaking album order/reorder interactions.
- Tapping pause on the active row pauses current playback.

## Test Plan
- Run Expo app typecheck or lint if configured.
- Manually play a track, open its album, and verify the current row indication and pause icon.
- Manually tap a different album track and verify playback switches intentionally.
- Manually pause/resume from album row controls.
- Verify long titles, downloaded/missing media, and reorder mode still render correctly.

## Brain Update Requirements
- Update `brain/features/audio.md` with album track row playback controls.
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
- Track rows may identify audio by blog id in one place and media id in another; comparison logic must normalize this.
- Reorder mode and playback controls may compete for the same horizontal row space.
- A track with no reachable audio source should show a disabled or error state, not a broken play action.

## Open Questions
- None.

## Linked Task
- Task Title: Album Track Playback Indicators And Row Controls
- Task File: brain/tasks/roadmap.md
