# Plan: AI Album Index Review And Approval

## Type
Feature

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-02

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: After saving the automatic album index JSON, review each album, click to see tracks, remove what should not be there, and approve to complete.

## Goal Or Problem
Generated automatic album indexes should be reviewable before they change real album memberships, with a clear per-album track review, removal, and approval workflow.

## Current Context
The generation plan persists DeepSeek album index runs and normalized suggestions. Existing album add/remove mutations already enforce audio-only and same-channel constraints. The review UI should use those constraints rather than writing memberships directly from unreviewed AI output.

## Proposed Approach
Add a mobile review surface reachable from the channel option or album tooling. Show generated index runs by status. Inside a run, show suggested albums; tapping an album opens its proposed tracks. The user can remove incorrect tracks from the pending suggestion set, then approve an album or the whole run. Approval applies validated media additions through album route logic and marks suggestions/run as approved or partially approved.

## Implementation Steps
- Add route/screen for automatic album index runs, likely from a channel options menu.
- List generated runs for the selected channel with status, created time, provider/model, and counts.
- Add run detail UI with album suggestion cards and track counts.
- Let the user open each suggested album to inspect proposed tracks.
- Let the user remove a track from the pending suggestion before approval without deleting media.
- Add approval mutation that applies remaining suggestions through same-channel album add logic.
- Record approval status per suggested album and overall run.
- Show skipped/already-added/missing-media counts after approval.
- Invalidate album list/detail/suggestions/search cards after approval.
- Keep the raw AI JSON available for debugging or admin inspection if appropriate, but do not require normal users to read it.

## Affected Files Or Areas
- `apps/expo-app/src/screens/channel-chat-screen.tsx`
- `apps/expo-app/src/screens/albums-screen.tsx`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- New Expo route/screen for album index review
- `apps/api/src/trpc/routers/album.routes.ts`
- DB models from `brain/plans/2026-07-01-feature-ai-album-index-generation.md`
- `brain/features/audio.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Channel options expose an "Automatic album index" entry point after generation backend exists.
- A user can view saved generated index runs for a channel.
- A user can click a generated album suggestion to see proposed tracks.
- A user can remove an incorrect proposed track before approval.
- Approving applies remaining media to the target album using existing album constraints.
- Approved suggestions/run statuses are persisted.
- Approval reports added, skipped, already-added, and failed items.
- Album detail/list state refreshes after approval.

## Test Plan
- Run API and Expo typechecks if configured.
- Manually review a generated run with multiple album suggestions.
- Remove one proposed track and approve; verify it is not added.
- Approve a suggestion containing already-added media and verify skipped count.
- Verify cross-channel media cannot be approved into the album.
- Verify album detail reflects approved tracks after refresh.

## Brain Update Requirements
- Update `brain/features/audio.md` with automatic album index review behavior.
- Update `brain/api/contracts.md` with review/approval endpoint contracts.
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
- Review UI must distinguish removing a pending suggestion from removing an existing album track.
- Approval should be idempotent so retrying after partial failure does not duplicate tracks.
- Runs can become stale if albums or media change after generation; approval should revalidate current DB state.

## Open Questions
- Resolved: approval is per suggested album. Users can add one proposed track, selected tracks, or all pending tracks for that album suggestion.

## Linked Task
- Task Title: AI Album Index Review And Approval
- Task File: brain/tasks/roadmap.md

## Completion Notes
- Added Settings entry **Album Organizer**.
- Added Expo routes for channel selection, channel summary/proceed, saved discovery runs, and per-album discovery review.
- Added channel summary counts for unalbumed audio and album count.
- Saved discoveries are loaded from persisted `AlbumAutoIndexRun` rows, so users can reopen generated results without regenerating.
- Added per-track dismiss/restore, single-track add, selected add, and add pending actions.
- Added API mutations for dismissing/restoring media suggestions and approving an album suggestion through the existing album add constraints.
- Validation passed: focused Biome check for touched API/Expo files; focused Expo ESLint for Album Organizer, Settings, and layout; `bun --cwd packages/db prisma-generate`.
- Validation limitation: full API and Expo typechecks still fail on unrelated existing project errors outside this slice.
