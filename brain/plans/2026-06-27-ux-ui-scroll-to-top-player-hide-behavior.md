# Plan: Universal Scroll-To-Top And Player Hide Behavior

## Type
UX/UI

## Status
Done

## Completion Notes
- Added shared scroll chrome hook and centered scroll-to-top button.
- Wired shared scroll behavior into home, search, albums, album detail, audio detail, and text blog screens.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Large scrollable screens should show a centered bottom scroll-to-top floating button, and album screen scroll should hide the bottom player; feature should be in all screens.

## Goal Or Problem
Create a consistent scroll behavior pattern for long mobile screens: users can quickly return to the top, and the bottom player can hide while scrolling to reduce obstruction.

## Current Context
The app has a persistent global audio mini-player and many large scrollable screens: home, search, albums, album detail, audio detail, text blog, channels, books, and play history. The user specifically calls out albums but wants the behavior across all screens.

## Proposed Approach
Create or reuse a shared scroll behavior helper/hook for screens with vertical scroll. Show a centered floating scroll-to-top button after the user scrolls beyond a threshold. Hide the global/bottom audio player while actively scrolling down and reveal it when scrolling stops, scrolling up, or near the bottom/top according to a predictable rule.

## Implementation Steps
- Audit major scrollable screens and the global audio bar visibility store.
- Create a reusable hook/component for scroll-to-top floating button and player hide/reveal behavior.
- Add a centered bottom floating scroll-to-top button for long screens after a threshold.
- Wire album screen first, then extend to other major scrollable screens.
- Ensure the button and hidden player do not conflict with keyboard, safe area, tab bar, or comment input footers.
- Add sensible accessibility labels and disabled states where needed.
- Keep behavior opt-in per screen if some screens have conflicting gestures.

## Affected Files Or Areas
- `apps/expo-app/src/components/global-audio-bar/index.tsx`
- `apps/expo-app/src/store/global-audio-bar-store.ts`
- `apps/expo-app/src/screens/albums-screen.tsx`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/blog-home.tsx`
- `apps/expo-app/src/screens/search-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/screens/text-blog-screen.tsx`
- Shared scroll UI/hook under `apps/expo-app/src/components` or `apps/expo-app/src/hooks`
- `brain/features/audio.md`
- `brain/features/blog.md`

## Acceptance Criteria
- Album screen hides the bottom/global player while scrolling according to the shared behavior.
- Other major long scroll screens can use the same hide/reveal behavior.
- A centered bottom floating scroll-to-top button appears after scrolling down a meaningful distance.
- Tapping the button scrolls the active screen to top.
- Button/player behavior respects safe areas, keyboard, bottom tabs, and comment footers.

## Test Plan
- Run Expo app typecheck if configured.
- Manually scroll albums, album detail, home, search, audio detail, and text blog screens.
- Verify the global player hides/reappears predictably.
- Verify scroll-to-top appears only after threshold and scrolls to top.
- Verify behavior with audio playing and paused.
- Verify behavior with keyboard open on comment/search screens.

## Brain Update Requirements
- Update `brain/features/audio.md` with global player scroll behavior.
- Update `brain/features/blog.md` if blog/search screens adopt shared scroll-to-top behavior.

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
- Nested lists/sheets may emit scroll events that incorrectly hide the global player.
- Screens with fixed footers or comment inputs may overlap the floating button.
- Hiding the player globally from one screen can leave it hidden after navigation if state cleanup is missed.

## Open Questions
- TODO: Confirm whether "all screens" includes book reader/channel chat or only major blog/audio/album/search screens.

## Linked Task
- Task Title: Universal Scroll-To-Top And Player Hide Behavior
- Task File: brain/tasks/roadmap.md
