# Plan: Streaming Search Keyword Suggestions

## Type
Feature

## Status
Done

## Completion Notes
- Added live keyword suggestion API and search-screen suggestion rendering while typing.
- Recent searches are hidden while a new keyword is being typed.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Search screen should stream search keyword suggestions and display them like recent search keywords; recent search should be hidden when typing a new keyword.

## Goal Or Problem
Improve search discovery by showing live keyword suggestions while the user types and hiding recent searches during active typing so suggestions do not compete with the current query.

## Current Context
Search screen exists at `apps/expo-app/src/screens/search-screen.tsx`, with `use-search.ts` and `components/search-input.tsx`. Existing broader home/discovery redesign mentions search entry points, but this request is a focused search interaction.

## Proposed Approach
Add debounced or streaming keyword suggestion retrieval to the search screen. When the input is empty, show recent searches as today. When the user types, hide recent searches and render live suggestions using the same visual treatment as recent search chips/list items. Selecting a suggestion should populate/search the keyword and update recent search history.

## Implementation Steps
- Audit existing search state, recent search storage, and query APIs.
- Add a keyword suggestion data source from existing indexed terms, recent channel/blog terms, or a new API endpoint if needed.
- Debounce typing and stream/update suggestions without blocking text input.
- Hide recent searches whenever the trimmed input has content.
- Render live suggestions with the same pattern used for recent search keywords.
- On suggestion press, set the query, execute search, and record the suggestion as a recent search.
- Add loading/empty/error handling that stays visually quiet.

## Affected Files Or Areas
- `apps/expo-app/src/screens/search-screen.tsx`
- `apps/expo-app/src/hooks/use-search.ts`
- `apps/expo-app/src/components/search-input.tsx`
- `apps/api/src/trpc/routers/blog.routes.ts`
- `apps/api/src/queries/blog.ts`
- `brain/features/blog.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Empty search input shows recent search keywords as before.
- Typing a new keyword hides recent searches.
- While typing, keyword suggestions appear in the same visual style as recent searches.
- Selecting a suggestion searches for that keyword and records it in recent searches.
- Suggestion loading does not freeze or visibly lag text input.

## Test Plan
- Run Expo app typecheck if configured.
- Manually open search with empty input and verify recent searches show.
- Manually type a keyword and verify recent searches hide and live suggestions appear.
- Manually select a suggestion and verify results load and recent search updates.
- Manually test no-suggestion and slow-network states.

## Brain Update Requirements
- Update `brain/features/blog.md` with search suggestion behavior.
- Update `brain/api/contracts.md` if a new keyword suggestion endpoint is added.

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
- "Stream" may mean true incremental server streaming or simply live debounced suggestions; choose the simplest behavior unless product confirms otherwise.
- Suggestions should not expose deleted/private content.
- Rapid typing can create stale responses unless requests are cancelled or ignored by sequence.

## Open Questions
- TODO: Confirm whether "stream" requires true streaming transport or live debounced suggestions are acceptable.

## Linked Task
- Task Title: Streaming Search Keyword Suggestions
- Task File: brain/tasks/roadmap.md
