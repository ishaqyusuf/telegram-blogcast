# Plan: Album Author Management From Track Authors

## Type
Feature

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-02

## Completion Notes
- `album.getAlbum` now returns media authors, `album.updateAlbum` can set/clear `albumAuthorId`, and `album.updateAuthor` supports editing existing author names.
- Album detail lists unique track authors, marks the selected album author, supports assign/clear toggling, and supports create/edit author flows.
- Track rows show their own author as fallback metadata when the album author is unset.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: In album screen, list the authors on the audios, unique with no duplicates. Toggle feature to add author to album or remove. Allow edit or add new author.

## Goal Or Problem
Album detail should surface unique authors from its audio tracks and let the user assign, remove, add, and edit one album-level author. When no album author is set, each track should fall back to displaying its own author.

## Current Context
Prisma already has `Author`, `Media.authorId`, and `Album.albumAuthorId`. `album.getAlbum` and `album.getAlbums` include the album author, and `album.getAuthors`/`album.createAuthor` exist. Current schema supports one album-level author through `albumAuthorId`, while individual tracks can each have an author.

## Proposed Approach
Use the existing single-author album model. Show a unique de-duplicated list of authors from the album's audio media. Let the user set or clear `albumAuthorId` by toggling one listed author, and allow creating/editing author records from the same album UI. If `albumAuthorId` is empty, do not invent a combined album author; render per-track authors as the fallback.

## Implementation Steps
- Extend `album.getAlbum` if needed so media rows include `author` and `authorId`.
- Add or update album mutations to set/clear `albumAuthorId`.
- Add an author update mutation if only create currently exists.
- In album detail, render unique media authors with no duplicate names.
- Show which author is currently assigned as the album author.
- Add toggle behavior: tapping an unassigned listed author assigns it to the album; tapping the assigned author removes/clears it.
- When no album author is assigned, render each track's own author in the track list and keep album-level author display empty or explicitly unset.
- Add UI to create a new author and assign it to the album or to selected media where appropriate.
- Add edit UI for author name/nameAr and refresh album/media author lists after save.
- Keep author display readable for Arabic and English names.

## Affected Files Or Areas
- `packages/db/src/schema/audio.schema.prisma`
- `packages/db/src/schema/media.schema.prisma`
- `apps/api/src/trpc/routers/album.routes.ts`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/albums-screen.tsx`
- `brain/features/audio.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Album detail lists unique audio authors with no duplicate author rows.
- The current album author is visibly marked.
- A user can assign a listed audio author to the album.
- A user can remove/clear the album author.
- When the album author is cleared or unset, track rows display their own authors when available.
- A user can create a new author and make it available in the album author flow.
- A user can edit an existing author name/nameAr and see the updated author in album UI.
- API rejects invalid/deleted author ids and refreshes album data after changes.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck or lint if configured.
- Manually create or identify an album with multiple audio tracks sharing authors and verify de-duplication.
- Assign, clear, create, and edit an author from album detail.
- Verify album list/detail reflect the updated album author.

## Brain Update Requirements
- Update `brain/features/audio.md` with album author management behavior.
- Update `brain/api/contracts.md` if author mutation contracts change.
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
- Author uniqueness currently uses nullable unique `name` and `nameAr`, so blank or duplicate edits need careful validation.
- Some imported media may have no author; UI should show an empty state rather than duplicate unknown rows.
- Clearing the album author should not erase track-level authors.

## Open Questions
- None.

## Linked Task
- Task Title: Album Author Management From Track Authors
- Task File: brain/tasks/roadmap.md
