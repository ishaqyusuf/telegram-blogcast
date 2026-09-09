# Task: Transactional SQLite Book Cache

## Status
In Progress

## Priority
Medium

## Created Date
2026-09-08

## Last Updated
2026-09-09

## Global Ticket
- Ticket Position: 3/8

## Source Context
[Mobile Book Local Cache plan](../plans/2026-09-08-feature-mobile-book-local-cache.md). User requests Android/media/com.alghurobaa.podcast/Books/book-{databaseBookId}/, mobile implementation, and progress tracking.

## Plan Status
In Progress

## Plan File
[Plan](../plans/2026-09-08-feature-mobile-book-local-cache.md)

## Implementation Progress
- Completion: 75%
- Current Checklist: 4/4
- Blockers: No implementation blocker; Android and release evidence still pending.

## Implementation Checklist
- [x] Add account-scoped page, tree, metadata, mirror, library, and download tables in the existing DB.
- [x] Test rollback, stale responses, repeated migrations, and durable checkpoints.
- [x] Support existing legacy offline downloads without deleting user data.
- [ ] Review content-version changes, eviction protection, and database compatibility on Android.

## Validation Evidence
- Final concurrency review resolved non-atomic server page writes: reimport and editor saves share a per-book/source-page PostgreSQL advisory transaction lock; content-version decisions occur under that lock and all replacement content commits together. Real local PostgreSQL verifies concurrent first imports, failure rollback with retained prior content/history, stale editor conflict, and coherent reader responses during interleaved import (12 assertions). Reader snapshot validation preserves parallel queries and uses three bounded attempts. No schema change was needed.
- Android database compatibility and eviction protection were exercised through the native cache, restore/cleanup, profile and capacity tests recorded in Tickets 4/6/7/8. Live DB/WAL files remain private and were not moved. This review item is technically verified; final ticket closure is held for the required story commit/release gates rather than reporting 100% prematurely.
- Legacy downloads are recovered lazily by application book/page IDs into the new private cache without replacing newer content. Paragraph source marks, footnotes, source-page adjacency, titles, and volume metadata are retained. Legacy copies remain non-exportable and read-only for editing until refreshed online; existing annotations still render.
- The offline shelf merges legacy and current records without double-counting recovered pages. Local chapter/swipe source resolution checks legacy downloads before requesting the server or WebView. Old TOC nodes are structurally validated and displayed with completeness explicitly unverified, not promoted to a complete tree.
- Removed the unused use-book-offline stub and obsolete destructive bulk-download writer after confirming no callers remain. Existing persisted data is preserved.
- Focused run: 26 tests passed across legacy recovery, reader-page serialization, and cache repository (113 assertions). Native typechecking had no diagnostics in changed production modules at the last check.
- Legacy cleanup protection fixed with a shared SQL predicate: active notes, drafts, and pending deletions keep legacy-only pages accessible through the reader, source navigation, chapter index, and shelf. Hidden unprotected pages do not reappear, and reading a protected page does not re-pin a removed download. Guest-private records cannot expose another profile's pages. Original archives remain untouched and storage UI labels their exclusion explicitly.
- New regression tests reproduced the hidden protected-page failure before the fix; all seven legacy tests now pass. The combined legacy/repository run passed 24 tests before the additional profile-isolation case.
- Reimport version reset reproduced in an API route regression test and fixed: imported raw content advances the prior contentVersion instead of implicitly resetting it to zero; old edited documents are not copied into the replacement. Cache stale-response/version tests still pass. Concurrent server imports remain part of final route review.
- Latest focused run: 28 tests passed, 123 assertions across legacy recovery, cache repository, API download manifest and page reimport version. Typecheck has no diagnostics in the changed production cache modules; missing Bun test declarations remain.
- Remaining review: Android database compatibility and final concurrency review.
- Focused cache format, file recovery, SQLite, local-first resource, page mapping, resolver, and download tests have passed during implementation.
- Existing page-loader regression tests have passed.
- Package typechecking retains pre-existing diagnostics and missing Bun test types; no new production-file diagnostics were observed in the last scoped review.
- No Android acceptance, final review, commit, deployment, or preview verification is claimed for this feature yet.
