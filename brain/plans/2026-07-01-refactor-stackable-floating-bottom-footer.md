# Plan: Stackable Floating Bottom Footer Registry

## Type
Refactor

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-01

## Completion Notes
- Implemented `FloatingFooterProvider`, `useFloatingFooterLayer`, and `useFloatingFooterInset`.
- Mounted the provider in the Expo root layout.
- Registered the global audio bar with reserved bottom-most id/priority so other footer content stacks above it.
- Migrated album track and suggestion selection footers into the stack.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: Make floating bottom footer content stackable so registered content stacks on top of whatever is currently there.

## Goal Or Problem
Multiple bottom-floating surfaces should not overlap. Screens and components should be able to register bottom footer content that stacks above existing bottom navigation, global player, keyboard-aware sheets, and other registered footer actions.

## Current Context
`HomeBottomNav` is an absolute bottom footer. The global audio bar has its own visibility store. Several screens also render floating controls, scroll-to-top buttons, comment inputs, and sheet footers. There is no clear shared registry for measuring and stacking bottom content, so new footer actions can overlap existing controls.

## Proposed Approach
Introduce a small shared floating footer host/registry. Components register footer layers with an id, priority/order, height/inset metadata, and render content. The host renders layers from bottom to top and exposes computed bottom offsets so floating buttons/sheets can sit above the current stack. Start by wiring the host into the main app layout and migrate the highest-risk footer surfaces used by album suggestions/global audio/nav.

## Implementation Steps
- Audit current bottom-floating surfaces: home bottom nav, global audio bar, scroll-to-top button, audio floating controls, comment inputs, add-to-album/suggestion footers.
- Add a `FloatingBottomFooterProvider`/store or equivalent under shared components/store.
- Support registering/unregistering footer layers by stable id and optional priority.
- Track layer heights with `onLayout` and expose a computed stack inset to consumers.
- Render registered layers in a single host with safe-area and keyboard-aware bottom offsets.
- Migrate at least global audio bar and album suggestion footer consumers or provide wrappers for them.
- Ensure unmount/navigation cleanup prevents stale registered footers.
- Document the pattern in feature docs or engineering notes if it becomes a shared UI primitive.

## Affected Files Or Areas
- `apps/expo-app/src/components/home-bottom-footer.tsx`
- `apps/expo-app/src/components/global-audio-bar/`
- `apps/expo-app/src/store/global-audio-bar-store.ts`
- `apps/expo-app/src/components/ui/floating-bottom-sheet.tsx`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- Shared footer provider/store under `apps/expo-app/src/components` or `apps/expo-app/src/store`
- `brain/features/audio.md`
- `brain/engineering/design-language.md`

## Acceptance Criteria
- Two or more registered footer layers render stacked, not overlapping.
- Registered content can sit above the home bottom nav/global audio player when those are visible.
- Registered content cleans up when its screen unmounts or hides.
- Consumers can access a bottom inset so scroll-to-top buttons and floating controls avoid the stack.
- Keyboard-open state does not bury registered footer content behind the keyboard.

## Test Plan
- Run Expo app typecheck or lint if configured.
- Manually test screens with global player plus another floating footer.
- Manually navigate away from a screen that registers footer content and verify no stale footer remains.
- Manually open keyboard while a registered footer is visible.
- Manually test home, search, album detail, and audio detail bottom controls.

## Brain Update Requirements
- Update `brain/features/audio.md` if global audio bar behavior changes.
- Update `brain/engineering/design-language.md` if a reusable footer stacking pattern is introduced.
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
- A global host can cause z-index or pointer-event regressions if existing footers rely on local tree order.
- Keyboard measurement varies by platform and may need a conservative fallback.
- Migrating every footer at once is risky; start with the surfaces required by album/search/audio follow-ups.

## Open Questions
- TODO: Confirm whether "registered content" refers to an existing internal footer registration helper not found during intake or a new pattern to introduce.

## Linked Task
- Task Title: Stackable Floating Bottom Footer Registry
- Task File: brain/tasks/roadmap.md
