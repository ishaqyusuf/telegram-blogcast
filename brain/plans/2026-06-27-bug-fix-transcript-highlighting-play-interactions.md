# Plan: Fix Transcript Highlighting And Play Interactions

## Type
Bug Fix

## Status
Done

## Completion Notes
- Transcript components continue to derive highlight state from live audio position.
- Double-tap/click on transcript segments seeks and starts playback while single tap remains seek-only.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Audio screen transcript is stuck and not auto-highlighting, including read mode; double click should play transcript.

## Goal Or Problem
Fix transcript playback synchronization so the active transcript segment/word highlights as audio progresses in normal and read modes, and add a deliberate double-click/double-tap interaction to play from transcript text.

## Current Context
Transcript UI lives under `apps/expo-app/src/components/audio-blog-view/`, including `audio-transcript.tsx`, `transcript-segments.tsx`, and `karaoke-transcript.tsx`. Playback progress is stored in `audio-store.ts`. Persisted transcripts are already implemented; this plan targets UI synchronization and interaction bugs.

## Proposed Approach
Audit how transcript components subscribe to playback position and derive active segment/word. Fix stale memoization, unit mismatch, or subscription issues that cause highlighting to freeze. Apply the same active-position logic in read mode. Add double-tap/click handling on transcript text to seek/play without interfering with normal scrolling or text selection.

## Implementation Steps
- Reproduce or inspect the transcript highlight data flow from `audio-store.ts` into transcript components.
- Verify whether positions are seconds or milliseconds and normalize comparisons.
- Fix active segment/word calculation so it updates as playback progresses.
- Ensure read mode uses the same live playback position source or a shared selector.
- Add double-click/double-tap handling on transcript segments/words to seek to the clicked timestamp and start playback.
- Avoid triggering play on single tap when the user is scrolling or selecting text.
- Add fallback behavior for transcript rows without timestamps.

## Affected Files Or Areas
- `apps/expo-app/src/components/audio-blog-view/audio-transcript.tsx`
- `apps/expo-app/src/components/audio-blog-view/transcript-segments.tsx`
- `apps/expo-app/src/components/audio-blog-view/karaoke-transcript.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/store/audio-store.ts`
- `brain/features/audio.md`

## Acceptance Criteria
- Transcript active highlight advances during audio playback.
- Transcript highlighting works in read mode and normal audio transcript mode.
- Pausing, seeking, and resuming update the highlighted transcript position.
- Double-click/double-tap on timestamped transcript text seeks and plays from that position.
- Single scroll/tap behavior remains usable and does not unexpectedly start playback.

## Test Plan
- Run Expo app typecheck if configured.
- Manually play an audio item with a persisted transcript and verify highlight progresses for at least several segments.
- Manually seek forward/back and verify the highlighted segment updates.
- Manually switch to read mode and verify highlighting still follows playback.
- Manually double-tap a transcript segment and verify playback starts from that timestamp.

## Brain Update Requirements
- Update `brain/features/audio.md` with final transcript play/highlight interaction behavior.

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
- Frequent playback updates can cause transcript list rerenders or scroll jank.
- Double-tap recognition can conflict with text selection/read-mode gestures.
- Some transcript segments may have missing or overlapping timestamps.

## Open Questions
- None.

## Linked Task
- Task Title: Fix Transcript Highlighting And Play Interactions
- Task File: brain/tasks/roadmap.md
