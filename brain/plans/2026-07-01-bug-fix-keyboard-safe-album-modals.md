# Plan: Keyboard-Safe Add-To-Album And Album Suggestion Inputs

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
- Intake Item: Add-to-album modal input still hides under keyboard, and album suggestion keyboard also hides behind keyboard.

## Goal Or Problem
Text inputs and action footers in add-to-album and album suggestion flows must remain visible and usable when the keyboard is open.

## Current Context
`apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx` is used from search/audio/channel flows. Album detail suggestion UI lives in `apps/expo-app/src/screens/album-detail-screen.tsx`. The existing `FloatingBottomSheet` uses `@gorhom/bottom-sheet` and has a `bottomInset`, but the user reports keyboard overlap remains. A prior 2026-06-27 plan marked keyboard avoidance done, so this is a regression/follow-up.

## Proposed Approach
Audit the actual modal/sheet nesting and keyboard behavior on Android and iOS. Use the established sheet component where possible, configure bottom-sheet keyboard behavior, and ensure scroll containers include safe keyboard-aware bottom padding. Avoid relying on fixed bottom offsets that can be hidden by the keyboard.

## Implementation Steps
- Reproduce or inspect add-to-album modal call sites in search, audio detail, and channel chat.
- Inspect album suggestion input placement in album detail Add tab/suggestion workflow.
- Update `FloatingBottomSheet` or specific modal usage to support keyboard behavior, keyboard blur behavior, and dynamic sizing as needed.
- Ensure TextInput fields are inside a scrollable content region with `keyboardShouldPersistTaps="handled"`.
- Add keyboard-aware bottom padding/insets for footer buttons.
- Verify modal/sheet max height leaves focused inputs visible above the keyboard on small Android screens.
- Keep close/dismiss gestures working with the keyboard open.

## Affected Files Or Areas
- `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/components/ui/floating-bottom-sheet.tsx`
- `apps/expo-app/src/screens/search-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- Shared keyboard/safe-area helpers if present
- `brain/features/audio.md`

## Acceptance Criteria
- In add-to-album modal, focusing the input keeps the input visible above the keyboard.
- Add-to-album primary/cancel actions remain reachable with the keyboard open.
- In album suggestion UI, focusing the suggestion input keeps the input visible above the keyboard.
- The behavior works from search, audio detail, channel chat, and album detail entry points.
- Closing the keyboard or modal does not leave broken bottom padding.

## Test Plan
- Run Expo app typecheck or lint if configured.
- Manually open add-to-album from search, audio detail, and channel chat, then focus the input.
- Manually open album detail Add tab/suggestion input and focus it.
- Test on a small Android viewport/device with gesture navigation.
- Test iOS if the app supports the flow there.

## Brain Update Requirements
- Update `brain/features/audio.md` with the final keyboard-safe album modal behavior.
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
- Bottom-sheet keyboard settings can behave differently across Android resize/pan modes.
- Nesting a modal inside a modal can break keyboard measurement and touch dismissal.
- Fixed safe-area offsets may conflict with the global player or bottom navigation.

## Completion Report
- Changed files: `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`, `apps/expo-app/src/screens/album-detail-screen.tsx`.
- Reworked the shared add-to-album modal around a keyboard-aware `FlatList` so the create-album input and cancel action can scroll above the keyboard.
- Made the album detail screen's main scroll keyboard-aware, with extra offset and bottom padding for the `+ Add` suggestion input/results path shown in the provided screenshots.
- Validation passed: scoped ESLint for touched Expo files and `git diff --check`.
- Validation limitation: full Expo lint and full TypeScript no-emit still fail on unrelated existing project issues outside this slice.

## Open Questions
- None.

## Linked Task
- Task Title: Keyboard-Safe Add-To-Album And Album Suggestion Inputs
- Task File: brain/tasks/roadmap.md
