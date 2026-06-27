# Plan: Album Screens Search Tabs And Sheet Polish

## Type
UX/UI

## Status
Done

## Completion Notes
- Albums screen now supports search and shared scroll-to-top/player-hide behavior.
- Add-to-album sheet sorts album choices, shows channel context, uses a toast after add, and keeps footer actions compact.
- Album detail now has Tracks and + Add tabs, with reorder actions confined to Tracks.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Albums screen search, floating sorted add-to-album modal, new/edit album keyboard avoidance with floating rounded footer, album suggest input keyboard avoidance, Tracks/Add tab behavior, and added-to-album toast.

## Goal Or Problem
Polish the album management surfaces so search, add, edit, reorder, and suggestion workflows feel coherent on mobile and remain usable when the keyboard is open.

## Current Context
`albums-screen.tsx`, `album-detail-screen.tsx`, and `add-to-album-modal.tsx` already exist. Album add flow and same-channel enforcement are implemented. The user now wants search in albums, sorted album lists, floating modal/sheet styling, keyboard-safe footers, a Tracks/Add tab split, reorder affordances only in the Tracks tab, and a toast instead of a heavier added modal.

## Proposed Approach
Keep album API behavior stable and refine mobile surfaces. Add album search on the albums screen, sort album choices in add-to-album flows, use keyboard-aware sheet/footer patterns for create/edit/suggest forms, replace add confirmation modal with a toast, and structure album detail around Tracks and Add tabs with context-specific actions.

## Implementation Steps
- Add a search input/state to `apps/expo-app/src/screens/albums-screen.tsx` and filter or query albums by title/channel metadata.
- Sort album choices in add-to-album modal by useful order such as most recent, title, or existing local pattern.
- Convert add-to-album UI to a floating sheet/modal with consistent rounded footer actions.
- Make new album input keyboard-aware and keep save/cancel actions in a floating rounded footer above the keyboard.
- Apply the same keyboard-aware footer treatment to edit album and album suggestion inputs.
- Add Tracks and Add tabs to album detail.
- In Tracks tab, show reorder right action/handle only when that tab is active.
- In Add tab, render the suggestion workflow from the channel-based album suggestions plan.
- Replace the added-to-album modal with a simple toast and refresh relevant queries.

## Affected Files Or Areas
- `apps/expo-app/src/screens/albums-screen.tsx`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`
- `apps/expo-app/src/components/ui` or shared sheet/toast primitives
- `brain/features/audio.md`

## Acceptance Criteria
- Albums screen supports searching albums.
- Add-to-album modal is floating, visually compact, and shows albums in a deterministic sorted order.
- New album, edit album, and album suggest inputs stay visible above the keyboard with floating rounded footer actions.
- Album detail has Tracks and Add tabs.
- Reorder controls appear only on the active Tracks tab.
- Adding to album shows a toast, not a blocking success modal.
- Existing add, edit, reorder, and suggestion actions continue to work after navigation and refresh.

## Test Plan
- Run Expo app typecheck if configured.
- Manually search albums by title and verify empty/no-result states.
- Manually open add-to-album from a blog/audio card, create a new album with the keyboard open, and verify footer actions remain reachable.
- Manually edit an album with the keyboard open.
- Manually switch Tracks/Add tabs and verify reorder controls only appear in Tracks.
- Manually add a suggested track and verify a toast appears.

## Brain Update Requirements
- Update `brain/features/audio.md` with album screen/search/tab behavior.

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
- Keyboard avoidance can regress on smaller Android screens or with gesture navigation.
- Reorder state must not persist while switching away from the Tracks tab.
- Sorting album choices should not hide recently used albums users expect near the top.

## Open Questions
- TODO: Confirm preferred album sort order: alphabetical, newest updated, most recently used, or channel-first.

## Linked Task
- Task Title: Album Screens Search Tabs And Sheet Polish
- Task File: brain/tasks/roadmap.md
