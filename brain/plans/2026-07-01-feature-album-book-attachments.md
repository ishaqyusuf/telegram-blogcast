# Plan: Album Book Attachment Management

## Type
Feature

## Status
Done

## Created Date
2026-07-01

## Last Updated
2026-07-02

## Completion Notes
- Album detail now previews attached books and opens a manage-books modal.
- The manage-books modal supports search over loaded library books, marks already-attached books, attaches available books, detaches references with confirmation, and navigates to book detail.
- Detach remains non-destructive and only soft-removes the `AlbumBookReference`.

## Intake
- Intake File: brain/intake/2026-07-01-album-search-audio-ai-followups.md
- Intake Item: Add book(s) to album feature.

## Goal Or Problem
Users should be able to attach one or more books to an album, view attached books from album detail, and remove book attachments when needed.

## Current Context
`AlbumBookReference` already exists in `packages/db/src/schema/book.schema.prisma`, and `album.getAlbum` includes `bookReferences`. `album.attachBook` and `album.detachBook` already exist in `apps/api/src/trpc/routers/album.routes.ts`. Books feature docs describe album/book references as modeled, but the album UI workflow is not complete.

## Proposed Approach
Complete the mobile UI around existing album/book APIs. Add a book section or manage-books sheet in album detail that lists attached books, allows searching/selecting books from the library, attaches multiple books one at a time or in a batch-like UI, supports optional notes if useful, and detaches references without deleting books.

## Implementation Steps
- Audit album detail book reference rendering and existing book list/search components.
- Ensure album detail query returns enough book reference data for display.
- Add a "Books" or "References" section to album detail.
- Add a manage-books modal/sheet with search over existing books using `book.getBooks` or an appropriate book search query.
- Attach selected books through `album.attachBook` and invalidate album detail.
- Detach attached books through `album.detachBook` with a non-destructive confirmation if needed.
- Show empty, loading, and already-attached states.
- Optionally support editing the `AlbumBookReference.note` if the existing API supports it through attach/upsert.

## Affected Files Or Areas
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/books-screen.tsx` or shared book picker components
- `apps/api/src/trpc/routers/album.routes.ts`
- `apps/api/src/trpc/routers/book.routes.ts`
- `packages/db/src/schema/book.schema.prisma`
- `brain/features/audio.md`
- `brain/features/books.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- Album detail shows attached books when they exist.
- A user can open a manage-books flow from album detail.
- A user can search/select an existing book and attach it to the album.
- A user can attach more than one book to an album.
- A user can remove a book reference from the album without deleting the book.
- Already-attached books are clearly marked or disabled in the picker.
- Album detail refreshes after attach/detach.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck or lint if configured.
- Manually attach one book, multiple books, and an already-attached book.
- Manually detach a book and verify the book remains in the library.
- Verify attached book taps navigate to book detail/reader if supported.

## Brain Update Requirements
- Update `brain/features/audio.md` with album book attachment workflow.
- Update `brain/features/books.md` with album-to-book management UI.
- Update `brain/api/contracts.md` if attachment response shapes change.
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
- Book list queries may be heavy if the library grows; add search/debounce rather than rendering everything unbounded.
- Imported/read-only book status should not affect attaching the book to an album.
- The current attach mutation is upsert-like; UI should treat re-attach as idempotent.

## Open Questions
- None.

## Linked Task
- Task Title: Album Book Attachment Management
- Task File: brain/tasks/roadmap.md
