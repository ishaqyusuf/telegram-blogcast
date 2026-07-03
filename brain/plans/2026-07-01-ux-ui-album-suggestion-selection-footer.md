# Plan: Album Suggestion Selection Footer Actions

## Type
UX/UI

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-01

## Completion Notes
- Replaced the album suggestion absolute footer with a registered stackable footer.
- Added mark/unmark-all, selected-count add, confirmed blog soft-delete, and add-to-album actions.
- Added long-press add-to-album modal behavior for footer and single-row suggestion add actions.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: In album suggestion, make the floating footer show double-checkmark toggle to mark/unmark all, selected count add action, delete icon action, and add-to-album action. Long press should show add-to-album modal. Same for the single add button.

## Goal Or Problem
Album suggestion selection needs a compact floating footer that exposes bulk mark/unmark, selected-count add, confirmed blog-item deletion, and add-to-album modal shortcuts without hiding behind other bottom UI.

## Current Context
The 2026-06-27 album suggestion plan added keyword suggestions, mark all/clear, bulk add, and one-off add. The new request specifies the desired floating footer control layout and long-press behavior. This should build on the stackable floating footer registry if available.

## Proposed Approach
Refine the album detail Add tab/suggestion selection UI around a bottom floating action row. The row should show a double-check icon toggle for mark all/unmark all, a count-aware add action for selected suggestions, a delete action for the selected blog item(s), and an add-to-album action that opens the full modal on long press. Deletion must always open a floating bottom confirmation modal before mutating data. Apply equivalent long-press behavior to single-row add buttons.

## Implementation Steps
- Audit current album suggestion selection state and bulk add actions in `album-detail-screen.tsx`.
- Add a floating footer component for album suggestion selection, ideally registered through the stackable footer registry.
- Add a double-checkmark icon button that toggles all visible suggestions selected/unselected.
- Add a selected-count add action that adds selected suggestions to the current album.
- Add a delete icon action that opens a floating bottom confirmation modal for the selected blog item(s).
- On confirmation, call the existing blog deletion/soft-delete path or add one if missing, then remove deleted items from the suggestion list and invalidate affected blog/album/search queries.
- Add long-press behavior on the add action to open the full add-to-album modal.
- Add equivalent long-press behavior to single suggestion row add buttons.
- Keep loading, disabled, and empty selection states obvious but compact.

## Affected Files Or Areas
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`
- `apps/api/src/trpc/routers/blog.routes.ts`
- Stackable footer registry from `brain/plans/2026-07-01-refactor-stackable-floating-bottom-footer.md`
- `apps/expo-app/src/components/ui/icon.tsx`
- Floating confirmation modal/sheet primitive under `apps/expo-app/src/components/ui`
- `brain/features/audio.md`
- `brain/features/blog.md`

## Acceptance Criteria
- Album suggestion footer floats above other bottom UI and remains reachable.
- Double-checkmark control selects all visible suggestions when not all are selected and unselects all when all are selected.
- Footer add action shows or includes the selected count.
- Delete action opens a floating bottom confirmation modal before deleting any blog item.
- Confirming deletion deletes or soft-deletes the selected blog item(s), removes them from the suggestion list, and refreshes related queries.
- Cancelling the confirmation leaves all selected blog items unchanged.
- Long-pressing the footer add action opens the add-to-album modal.
- Single suggestion add button supports the same long-press add-to-album modal behavior.
- Existing one-off add and bulk add still work.

## Test Plan
- Run Expo app typecheck or lint if configured.
- Manually open album detail Add tab with multiple suggestions.
- Select none, one, many, and all suggestions and verify footer state.
- Tap mark/unmark all, add selected, delete, cancel delete confirmation, confirm delete, and long-press add.
- Verify footer does not overlap the global player, nav, keyboard, or scroll-to-top button.

## Brain Update Requirements
- Update `brain/features/audio.md` with the final album suggestion footer behavior.
- Update `brain/features/blog.md` if blog deletion behavior or route contracts change.
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
- Destructive deletion must be a soft delete if that is the existing blog deletion convention.
- The confirmation modal must clearly distinguish deleting a blog item from merely removing it from an album.
- Long-press can conflict with row press gestures or reorder gestures.
- Bulk actions need to ignore already-added suggestions and show skipped counts cleanly.

## Open Questions
- None.

## Linked Task
- Task Title: Album Suggestion Selection Footer Actions
- Task File: brain/tasks/roadmap.md
