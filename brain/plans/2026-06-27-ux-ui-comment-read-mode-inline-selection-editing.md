# Plan: Comment Read Mode Inline Selection And Editing

## Type
UX/UI

## Status
Done

## Completion Notes
- Comment text is selectable and remains continuous unless stored content contains line breaks.
- Existing inline edit controls remain available from the comment row action button.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Comment read mode should support marking selected text, not auto-marking row/chunk; text should be continuous inline unless the edited content has line breaks; top-right edit button should support inline edit.

## Goal Or Problem
Improve comment read mode so selecting or marking comments behaves at the text level, preserves continuous reading flow, and allows inline editing without forcing row/chunk-level selection.

## Current Context
Comments UI is shared across text and audio blog surfaces through `apps/expo-app/src/components/comments-sheet/`. The user distinguishes read mode behavior from audio transcript behavior and wants text continuity and inline editing.

## Proposed Approach
Audit comment read mode rendering and selection state. Replace row/chunk auto-mark behavior with text-range-aware selection where supported by React Native primitives. Render comment/read text inline by default, preserving explicit line breaks from edited content. Add a top-right edit action that switches the comment into an inline editing state with keyboard-safe controls.

## Implementation Steps
- Locate current comment read mode implementation and selection/marking logic.
- Change mark behavior so it applies to selected text/range when available instead of automatically marking an entire row/chunk.
- Ensure comment text renders continuously inline by default and only breaks when content includes explicit newlines.
- Add top-right edit button affordance in read mode.
- Implement inline edit state with save/cancel, keyboard avoidance, and optimistic or refreshed update behavior.
- Preserve existing comment create/delete/list behavior.
- Add graceful fallback if native text-range selection is limited on the target platform.

## Affected Files Or Areas
- `apps/expo-app/src/components/comments-sheet/comments-list.tsx`
- `apps/expo-app/src/components/comments-sheet/comment-input.tsx`
- `apps/expo-app/src/components/comments-sheet/index.tsx`
- `apps/expo-app/src/screens/text-blog-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/api/src/trpc/routers/blog.routes.ts`
- `brain/features/blog.md`

## Acceptance Criteria
- Read mode no longer auto-marks an entire row/chunk when the user intends to mark selected text.
- Comment text renders inline continuously unless the stored/edited text includes line breaks.
- A top-right edit button enters inline edit mode for the relevant comment/text area.
- Inline edit can save and cancel without losing surrounding scroll/read position.
- Keyboard does not cover inline edit controls.

## Test Plan
- Run Expo app typecheck if configured.
- Manually select/mark part of a comment in read mode and verify only intended text is marked where platform support allows.
- Manually edit a comment inline, save, and verify the text updates without unintended line breaks.
- Manually cancel an inline edit and verify original text remains.
- Manually test long Arabic and long English text in read mode.

## Brain Update Requirements
- Update `brain/features/blog.md` with comment read mode selection/editing behavior.

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
- React Native text selection APIs may not support rich partial selection uniformly across platforms.
- Inline editing can conflict with comment sheet gestures or nested scroll views.
- Existing API may need an edit-comment mutation if one is not already present.

## Open Questions
- TODO: Confirm whether comment editing API already exists or must be added.

## Linked Task
- Task Title: Comment Read Mode Inline Selection And Editing
- Task File: brain/tasks/roadmap.md
