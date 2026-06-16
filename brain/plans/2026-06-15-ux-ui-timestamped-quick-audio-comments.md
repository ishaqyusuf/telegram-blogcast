# Plan: Timestamped Quick Audio Comments

## Type
UX/UI

## Status
Implemented

## Created Date
2026-06-15

## Last Updated
2026-06-15

## Completion Notes
- Audio screen comment input now runs in timestamp mode and stores timestamp metadata by default.
- The input shows a timestamp chip without prefixing the typed comment text.
- Comment lists render saved timestamp chips and can seek to metadata-backed timestamps.
- Legacy `[mm:ss]` text prefixes still render as fallback display hints.

## Intake
- Intake File: brain/intake/2026-06-15-blog-audio-organization-import.md
- Intake Item: Play screen should support simple YouTube-style quick comment input with timestamp by default.

## Goal Or Problem
Make audio comments fast and timestamp-aware by default, matching the provided screenshot: avatar/button, rounded input, visible current timestamp chip, quick timestamp add/refresh control, and prominent send button.

## Current Context
Backend `blog.addComment` already accepts optional `timestampSeconds` and stores it in comment blog metadata. `BlogFormContext` sends timestamps in audio-comment mode. The current quick `CommentInput` can insert a visible timestamp string into text, but `handleSend` does not pass `timestampSeconds` by default. Audio position is available through `apps/expo-app/src/store/audio-store.ts`.

## Proposed Approach
Update `CommentInput` so audio-screen comments store timestamp metadata separately from the comment text. Render a timestamp chip inside the input when enabled. Default timestamp to current audio position when the input opens or when the user taps the timestamp button. Keep compact/non-compact variants visually aligned with the screenshot where used on the play screen.

## Implementation Steps
- Add props to `CommentInput` for `timestampMode`, `defaultTimestampSeconds`, or derive from audio store when used by audio screen.
- Change `handleSend` to pass `timestampSeconds: Math.floor(position / 1000)` when timestamp mode is enabled.
- Replace default insertion of `[mm:ss]` text with a visible chip that does not mutate comment text.
- Keep a timestamp button that refreshes/toggles the current timestamp chip.
- Add a layout variant for the audio play screen matching screenshot structure: avatar/control, rounded input, timestamp chip, send button.
- Update comments list rendering to display timestamp chips for comments with `meta.audioTimestampSeconds`.
- On timestamp chip press, seek the current audio to that timestamp if the relevant blog/audio is loaded.
- Add translations for timestamp/comment placeholder text if needed.

## Affected Files Or Areas
- `apps/expo-app/src/components/comments-sheet/comment-input.tsx`
- `apps/expo-app/src/components/comments-sheet/comments-list.tsx`
- `apps/expo-app/src/components/comments-sheet`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/store/audio-store.ts`
- `apps/api/src/trpc/routers/blog.routes.ts`
- `brain/features/audio.md`
- `brain/features/blog.md`

## Acceptance Criteria
- Quick comment on an audio play screen sends `timestampSeconds` by default.
- The visible input shows the current timestamp as a chip similar to the screenshot.
- The typed comment text is saved without a prefixed timestamp unless the user explicitly types one.
- Existing non-audio comments continue to work without timestamp metadata.
- Saved timestamp comments render with a timestamp chip and can seek audio when tapped.

## Test Plan
- Run Expo app typecheck if configured.
- Manually play audio to 0:12, enter a comment, send, and verify the API stores `meta.audioTimestampSeconds` as 12.
- Manually verify comment chip display and seek behavior.
- Manually verify regular text blog comments still submit without timestamp.

## Brain Update Requirements
- Update `brain/features/audio.md` with timestamp comment behavior.
- Update `brain/features/blog.md` if comment rendering behavior changes across blog types.

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
- Comment sheet keyboard layout can overlap controls on smaller Android devices.
- Timestamp should represent the current audio for the current blog, not stale global audio from another item.

## Open Questions
- None.

## Linked Task
- Task Title: Timestamped Quick Audio Comments
- Task File: brain/tasks/roadmap.md
