# Plan: Search Result Blog Type Badge Pills

## Type
UX/UI

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-02

## Completion Notes
- Search results now show horizontal blog type pills with counts from the full result set.
- Selecting a type passes a structured `type` filter to `blog.search` and combines with channel/text filters.
- Search pagination continues through `useInfiniteQuery`, while top type counts come from unpaginated metadata.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: Search result should also have the blog type horizontal badge pills.

## Goal Or Problem
Search results should expose blog type context through horizontal badge pills so users can quickly understand or filter result types such as audio, text, image, video, and PDF.

## Current Context
`blog.search` returns `type` for each result. `search-screen.tsx` maps results into `BlogCard`, and current search UI already has channel filters and tag chips. The request specifically calls for blog type horizontal badge pills in the search result surface.

## Proposed Approach
Add a horizontal pill row in the search results area for blog types found in the current result set or supported by the API. Use the row either as filter controls or as visible type summaries depending on current local patterns; if filterable, keep selected type state local and make it combinable with text query and selected channel. Ensure individual result cards still show type information consistently.

## Implementation Steps
- Audit existing `BlogCard` type badges and search result header/filter rows.
- Decide whether the pills are filter controls, informational type counts, or both; default to filter controls if consistent with channel filters.
- Derive available type pills from result counts or a fixed supported type list.
- Render pills horizontally above search results with accessible labels and selected state.
- If filterable, add selected type state and filter client-side or extend `blog.search` with a type parameter.
- Ensure selected type combines with channel filter and submitted text query.
- Keep audio album badges/add-to-album actions visible on audio result cards.

## Affected Files Or Areas
- `apps/expo-app/src/screens/search-screen.tsx`
- `apps/expo-app/src/components/blog-card/`
- `apps/api/src/trpc/routers/blog.routes.ts`
- `brain/features/blog.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Search results show a horizontal row of blog type badge pills.
- Pills are readable and usable on narrow mobile screens.
- If a type pill is selected, results are limited to that blog type and the selected state is visible.
- Type pills work together with selected channel filters.
- Audio result album badges and add-to-album behavior continue to work.

## Test Plan
- Run API and Expo typechecks if configured.
- Manually search for a term that returns multiple blog types.
- Verify the type pill row scrolls horizontally and does not overlap results.
- Select and clear type filters if implemented as filters.
- Verify channel filter plus type filter combination.

## Brain Update Requirements
- Update `brain/features/blog.md` with search result type badge behavior.
- Update `brain/api/contracts.md` if a search type filter parameter is added.
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
- If result sets are paginated later, counts derived only from the first page may be misleading.
- A fixed type list can show empty filters; hide zero-count types unless a selected empty state is useful.
- The row should not duplicate existing card-level type badges in a confusing way.

## Open Questions
- TODO: Confirm whether "badge pills" are meant to be filters or just visible type labels/counts.

## Linked Task
- Task Title: Search Result Blog Type Badge Pills
- Task File: brain/tasks/roadmap.md
