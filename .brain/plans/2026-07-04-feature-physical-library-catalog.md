# Plan: Physical Library Catalog

## Type
Feature

## Status
Implemented

## Created Date
2026-07-04

## Last Updated
2026-07-04

## Goal Or Problem
Add a Books-area Library feature for cataloging the user's physical home library while keeping it linked to, but separate from, the existing digital Shamela-backed `Book` system.

## Implemented Approach
- Added dedicated physical-library Prisma models:
  - `LibraryItem`
  - `LibraryVolume`
  - `LibraryLocation`
  - `LibraryLabel`
- Linked physical catalog entries to digital books through nullable `LibraryItem.bookId`.
- Added a `library` tRPC router with physical catalog CRUD, location/label creation, digital book linking/unlinking, and digital candidate search.
- Added Expo routes under `/books/library` for list, create, detail, and edit.
- Added a physical Library entry point from `/books`.
- Added a "Catalog physical copy" action from digital book detail that prefills the physical catalog form with the digital book metadata.

## Acceptance Criteria
- Physical books can be cataloged with title, author, publisher, edition, print year, ISBN, description, notes, volume count, shelf/location, catalog code, purchase date/price/source, condition, labels, and optional cover URL.
- Physical catalog entries can exist without a digital book.
- Physical catalog entries can link/unlink an existing digital `Book`.
- Linked physical entries can open the digital reader/detail/search surfaces.
- Digital book metadata and Shamela refreshes do not overwrite physical catalog metadata.
- Books navigation exposes both digital books and the physical Library.

## Validation
- `bun --cwd packages/db prisma-generate`
- `bunx biome check apps/api/src/trpc/routers/library.routes.ts apps/api/src/trpc/routers/_app.ts packages/db/src/index.ts`
- `bunx eslint src/screens/library-screen.tsx src/screens/library-item-form-screen.tsx src/screens/library-item-detail-screen.tsx src/screens/books-screen.tsx src/screens/book-detail-screen.tsx src/app/_layout.tsx`

## Validation Limitations
- Full `bun --cwd apps/api typecheck` still fails on unrelated existing issues in API query/middleware/blog utility files.
- Full Expo `tsc --noEmit` still fails on unrelated existing project errors outside the Library feature. Library-specific icon type errors found during validation were fixed.

## Follow-Up Opportunities
- Add per-volume management UI for split-volume shelf locations.
- Add offline-first local SQLite support for physical catalog browsing/editing.
- Add ISBN/barcode scanning and cover-photo capture.
- Add duplicate detection between new physical entries and existing digital books.
