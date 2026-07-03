# Plan: Fix Audio Scrub Flicker And Ended Replay Reset

## Type
Bug Fix

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-01

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: Dragging the audio minute bar flickers; when audio finishes and no play mode is set, playing it again should reset to 0 and restart.

## Goal Or Problem
Make audio progress dragging visually stable and make ended audio restart from 0 when the user presses play again without an active repeat/queue play mode.

## Current Context
Android playback uses `react-native-track-player` through `apps/expo-app/src/store/audio-store.ts`. The store tracks `position`, `duration`, `isSeeking`, and listens to TrackPlayer progress and queue-ended events. Prior Brain memory says the seek bar was rewritten with `Animated.Value`, but the user still sees flicker while dragging and ended playback does not restart cleanly.

## Repro Evidence
- Video: `/Users/M1PRO/Downloads/WhatsApp Video 2026-07-01 at 11.17.14.mp4`
- Observed symptom: the audio detail scrubber thumb/time jumps while dragging on the active audio screen.

## Completion Notes
- Stabilized the audio-detail scrubber so drag gestures keep local control of the thumb/time labels until the native seek promise settles.
- Prevented TrackPlayer and Expo AV progress/status updates from overwriting store position while `isSeeking` is active.
- Added an explicit ended-playback state on Android and iOS; after natural finish, pressing play with no active play mode seeks to 0 before starting playback.
- Repro video kept as evidence: `/Users/M1PRO/Downloads/WhatsApp Video 2026-07-01 at 11.17.14.mp4`.
- Validation passed: `bunx eslint src/screens/audio-blog-screen.tsx src/store/audio-store.ts src/store/audio-store.ios.ts` from `apps/expo-app`.
- Validation limitation: full `bun --cwd apps/expo-app lint` still fails on unrelated existing lint errors outside this slice; `bunx tsc --noEmit --pretty false` still fails on unrelated project-wide type errors and missing aliases outside this slice.

## Proposed Approach
Audit progress updates from the audio store and UI seek bar. During a drag, keep the thumb/progress controlled by the local gesture value and ignore store progress updates until release. On release, seek once, then resync from TrackPlayer. Track an ended state or derive it from queue-ended/progress and, when no explicit play mode is active, seek to 0 before starting playback again.

## Implementation Steps
- Inspect `audio-blog-player.tsx`, global audio bar progress controls, and any shared seek bar component for mixed local/store-controlled progress updates.
- Ensure drag start sets a local seeking state and freezes external position reconciliation for the seek UI.
- Ensure drag movement updates only the local animated value/label and does not dispatch repeated store position updates that fight TrackPlayer progress events.
- Ensure drag release performs one `seek(positionMillis)` call, clears local seeking state after the seek resolves, and resyncs the store snapshot.
- In `audio-store.ts`, persist or derive an ended state when `PlaybackQueueEnded` fires.
- Update `play()` so, if playback ended and no play mode requests continuation/repeat, it seeks to 0 before calling `TrackPlayer.play()`.
- Verify replay does not apply the pause context rewind behavior after an ended track.

## Affected Files Or Areas
- `apps/expo-app/src/store/audio-store.ts`
- `apps/expo-app/src/components/audio-blog-view/audio-blog-player.tsx`
- `apps/expo-app/src/components/global-audio-bar/`
- Shared seek/progress component if one exists
- `brain/features/audio.md`

## Acceptance Criteria
- Dragging the audio minute/progress bar no longer flickers or jumps between gesture position and current playback position.
- While dragging, the displayed time follows the user's finger smoothly.
- Seeking is committed once on release and playback resumes from the selected position when appropriate.
- After an audio track naturally finishes, pressing play again with no repeat/queue play mode seeks to 0 and starts from the beginning.
- Existing pause, resume, stop, skip, and manual seek behaviors continue to work.

## Test Plan
- Run Expo app typecheck or lint if configured.
- Manually play a long audio item and drag the progress bar slowly and quickly.
- Manually drag while audio is playing and while paused.
- Let an audio item finish, press play again, and verify it restarts from 0.
- Verify the same replay behavior in the bottom/global player if that player exposes play.

## Brain Update Requirements
- Update `brain/features/audio.md` with the final seek and ended replay behavior.
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
- TrackPlayer progress events may continue during seeking; stale events must not overwrite the local drag value.
- iOS may use a separate audio store path and needs parity if the affected seek UI is shared.
- Replay reset should not break future repeat-one or album queue behavior.

## Open Questions
- None.

## Linked Task
- Task Title: Fix Audio Scrub Flicker And Ended Replay Reset
- Task File: brain/tasks/roadmap.md
