# Plan: Search Input Channel Picker And Removable Channel Badge

## Type
Feature

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-02

## Completion Notes
- Search input now lists recent searches, channels, and browse tags.
- Search input filters channel suggestions live while typing.
- Selecting a channel sets structured channel state and shows a removable channel badge without saving the channel title as a text search.
- Search results combine submitted text with the selected channel through `blog.search` `channelIds`.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: Search input screen should list recent searches, channels, and browse tags. The search input should filter channels. Channel click should use `?channelId=...` rather than a normal search query, and show the channel as a removable badge pill.

## Goal Or Problem
Search should support choosing a channel from the input/discovery state as a structured filter, not as a text query, and the selected channel should be visible and removable.

## Current Context
`apps/expo-app/src/screens/search-screen.tsx` already renders recent searches, browse tags, live keyword suggestions, result-time channel filters, and a local `selectedChannelId`. `blog.search` accepts `channelIds`, and `blog.searchChannels` exists, but channels currently appear after a submitted search and the selected channel state is not clearly represented as a URL `channelId` filter badge in the input state.

## Proposed Approach
Move channel discovery into the search input state. When the search input is empty, show Recent Searches, Channels, and Browse Tags. As the user types, filter channels alongside keyword suggestions without submitting a query. Pressing a channel updates route/query state to `?channelId=<id>`, sets selected channel state, and displays a badge pill near the input. Removing the badge clears the channel filter without treating the channel title as a search term.

## Implementation Steps
- Audit `search-screen.tsx` route params and current `selectedChannelId` behavior.
- Read initial `channelId` from `useLocalSearchParams` and hydrate selected channel state.
- Add or adjust a channel list query that returns channels for empty input and filtered channels while typing.
- Render the empty input sections in order: Recent Searches, Channels, Browse Tags.
- While typing, update/filter the Channels section without submitting a normal text search.
- On channel press, update router params to `?channelId=<id>`, set selected channel, and avoid saving the channel title as a recent search.
- Render selected channel as a badge pill near the input with a remove icon.
- Removing the badge clears `channelId` from route params and selected channel state.
- Ensure submitted text search can combine with selected `channelId` and pass `channelIds` to `blog.search`.

## Affected Files Or Areas
- `apps/expo-app/src/screens/search-screen.tsx`
- `apps/expo-app/src/app/search.tsx`
- `apps/api/src/trpc/routers/blog.routes.ts`
- `apps/api/src/trpc/routers/channel.route.ts`
- `apps/api/src/queries/channel.ts`
- `brain/features/blog.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Empty search screen shows Recent Searches, Channels, and Browse Tags sections.
- Typing in search filters the visible channel suggestions.
- Pressing a channel does not set the channel title as the search query and does not save it as a recent text search.
- Pressing a channel updates the route/query state with `channelId`.
- Selected channel appears as a removable badge pill.
- Removing the badge clears the channel filter and updates route/query state.
- Text search results are filtered by selected channel when a query is submitted.

## Test Plan
- Run API and Expo typechecks if configured.
- Manually open `/search` with no params and verify section order.
- Type a channel name and verify channels filter live.
- Select a channel and inspect route params/state if possible.
- Submit a text query with a selected channel and verify results are channel-filtered.
- Remove the channel badge and verify results/state update.

## Brain Update Requirements
- Update `brain/features/blog.md` with channel-aware search input behavior.
- Update `brain/api/contracts.md` if channel search/list contracts change.
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
- `searchChannels` currently requires a submitted query; empty-state channel listing may need a separate channel query.
- Clearing query text should not accidentally clear the selected channel unless the user removes the badge.
- Route param updates can cause focus loss or re-render loops if not guarded.

## Open Questions
- None.

## Linked Task
- Task Title: Search Input Channel Picker And Removable Channel Badge
- Task File: brain/tasks/roadmap.md
