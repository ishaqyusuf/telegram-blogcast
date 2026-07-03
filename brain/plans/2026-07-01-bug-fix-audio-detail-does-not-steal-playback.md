# Plan: Prevent Audio Detail From Stealing Current Playback

## Type
Bug Fix

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-01

## Completion Notes
- Removed passive route-load behavior that replaced global playback when viewing another audio detail screen.
- Split viewed-audio display state from active player state so another audio detail can show its own play action without pausing or unloading the currently playing audio.
- Guarded inactive detail seeking, scrubber controls, and transcript tap seeking so they cannot seek the active audio unless the viewed audio is the active audio.
- Validation: `bunx eslint src/screens/audio-blog-screen.tsx src/components/audio-blog-view/karaoke-transcript.tsx` passed from `apps/expo-app`.
- Validation limitation: `bun --cwd apps/expo-app lint` was run and still fails on pre-existing unrelated lint errors outside this slice, including `chapter-tree.tsx` and example files.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: When currently playing an audio, opening another audio screen should not stop the previous audio unless the user clicks play.

## Goal Or Problem
Opening an audio detail screen should be passive. It may show that screen's audio metadata, but it must not unload, reset, stop, or replace the currently playing audio until the user explicitly starts that screen's audio.

## Current Context
`apps/expo-app/src/screens/audio-blog-screen.tsx` owns the audio detail route and `apps/expo-app/src/store/audio-store.ts` owns the active TrackPlayer item. The current store `loadAudio` resets TrackPlayer when loading a different track. The likely regression is that the detail screen calls `loadAudio` on mount or data load instead of waiting for an explicit play action.

## Proposed Approach
Separate "viewed audio" from "loaded/active audio". The detail screen should fetch and render the viewed blog/audio without calling `loadAudio` on mount when another track is active. Play buttons should call a single explicit helper that loads the viewed audio if needed, then plays it. Existing active playback should keep the global player state and audio output unchanged while the user browses other audio screens.

## Implementation Steps
- Audit `audio-blog-screen.tsx` for effects that call `loadAudio`, `restoreAudio`, `play`, or `togglePlayPause` when route params or blog data change.
- Identify UI that should reference the viewed audio versus UI that should reference the active audio store item.
- Remove or guard mount-time `loadAudio` calls for non-active viewed audio.
- Add an explicit `playViewedAudio` or equivalent action that loads the viewed audio only when the user taps play.
- Ensure the screen can show a play icon for viewed audio when the active store item is a different track.
- Keep active global player navigation and currently playing metadata unchanged while browsing.
- Add guards so opening the currently active audio detail can still sync current progress/state without resetting the queue.

## Affected Files Or Areas
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/store/audio-store.ts`
- `apps/expo-app/src/components/audio-blog-view/`
- `apps/expo-app/src/components/global-audio-bar/`
- `brain/features/audio.md`

## Acceptance Criteria
- Start playing audio A, then navigate to audio B detail; audio A keeps playing.
- Audio B detail shows a play action, not a paused state for audio A.
- Tapping play on audio B intentionally replaces audio A and starts audio B.
- Opening the detail screen for currently playing audio A shows current progress and pause state without resetting playback.
- Navigating between audio detail screens does not create duplicate TrackPlayer resets or progress jumps.

## Test Plan
- Run Expo app typecheck or lint if configured.
- Manually play one audio, open another audio detail route from search/home/album, and verify playback continues.
- Tap play on the second audio and verify the active audio switches only then.
- Open the currently playing audio detail from the global player and verify progress remains stable.
- Test Android notification/playback state after navigation.

## Brain Update Requirements
- Update `brain/features/audio.md` with the passive audio-detail navigation contract.
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
- Some detail-screen controls may currently assume the viewed audio and active audio are the same item.
- Transcription/comment timestamp actions should target the viewed media but playback actions should target the active audio only after explicit play.
- Existing route params may request a timestamp seek; that should still require explicit playback rules unless the route is intended as a play action.

## Open Questions
- None.

## Linked Task
- Task Title: Prevent Audio Detail From Stealing Current Playback
- Task File: brain/tasks/roadmap.md
