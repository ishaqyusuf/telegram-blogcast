# Plan: Flat Audio Comments And Timestamp Playback Polish

## Type
UX/UI

## Status
Done

## Completion Notes
- Timestamp comment taps now seek and start playback.
- Comment rows remain flat, selectable, and inline-editable.
- Global audio bar shows current time plus album track index when available.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: A blog item is loading old audio screen; use the old screen comments UI but flat, timestamp clicks should play, text blog UI/comment input needs a small keyboard-avoid update, and audio bar should show timestamp index.

## Goal Or Problem
Restore the preferred audio/comment experience while modernizing it into a flatter UI: timestamped comments should be easy to read, tappable timestamps should seek/play audio, text blog comments should remain polished, and the audio bar should surface timestamp/index context.

## Current Context
Timestamped quick audio comments are implemented and documented. The active audio screen is `audio-blog-screen.tsx`, comments live in `components/comments-sheet`, and playback state lives in `audio-store.ts`. The user reports a blog item is loading an old audio screen and wants the older comments UI style reused but flattened.

## Proposed Approach
Audit current route resolution for audio blog items to ensure the intended screen loads. Rework audio comments presentation using the older comments layout as a reference while keeping the current timestamp metadata behavior. Add timestamp click-to-play and an audio bar timestamp/index indicator. Make a small keyboard-safe touch-up to text blog comment input without changing comment APIs.

## Implementation Steps
- Verify which routes load old vs current audio screens for blog items.
- Fix route/card navigation if a blog item opens the wrong audio screen.
- Compare current comments sheet/list/input with the older desired comments UI and adapt the layout into a flatter visual treatment.
- Ensure timestamp chips or timestamp text in comments call seek/play on the current audio item.
- Add audio bar display for the current timestamp/index context where transcript/comment index is available.
- Touch up text blog comment input spacing/keyboard avoidance using the same comment primitives.
- Preserve existing timestamp metadata storage and fallback rendering for legacy `[mm:ss]` text.

## Affected Files Or Areas
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/screens/text-blog-screen.tsx`
- `apps/expo-app/src/components/comments-sheet/comment-input.tsx`
- `apps/expo-app/src/components/comments-sheet/comments-list.tsx`
- `apps/expo-app/src/components/comments-sheet/index.tsx`
- `apps/expo-app/src/components/global-audio-bar/index.tsx`
- `apps/expo-app/src/components/blog-card/`
- `apps/expo-app/src/store/audio-store.ts`
- `brain/features/audio.md`
- `brain/features/blog.md`

## Acceptance Criteria
- Audio blog items navigate to the intended active audio screen.
- Audio comments use a flat version of the preferred old comments UI.
- Tapping a timestamped comment seeks the audio to that timestamp and starts or resumes playback.
- Text blog comment input remains visible and usable with the keyboard open.
- The audio/global bar shows a timestamp/index indicator when relevant data is available.
- Existing non-timestamp comments and regular text blog comments continue to work.

## Test Plan
- Run Expo app typecheck if configured.
- Manually open audio blog items from home/search/channel cards and verify the intended screen loads.
- Manually tap a timestamp comment at several positions and verify audio seeks/plays.
- Manually test text blog comment input with keyboard open on a small screen.
- Manually verify the audio bar timestamp/index indicator updates during playback.

## Brain Update Requirements
- Update `brain/features/audio.md` with timestamp playback and bar index behavior.
- Update `brain/features/blog.md` if text comment input behavior changes.

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
- Seeking the wrong audio item can happen if global playback state is stale.
- Keyboard fixes can regress comment sheet height or footer positioning.
- The requested "old screen comments UI" may refer to a screen in examples or prior code not currently mounted.

## Open Questions
- TODO: Identify the exact old audio/comments screen reference if multiple legacy screens exist.

## Linked Task
- Task Title: Flat Audio Comments And Timestamp Playback Polish
- Task File: brain/tasks/roadmap.md
