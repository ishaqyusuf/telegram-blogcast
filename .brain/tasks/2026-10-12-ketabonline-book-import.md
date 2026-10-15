# Task: KetabOnline Book Acquisition And Mobile Reading

## Status
Done — implemented, validated, and released to Production backend plus the Android Preview OTA on 2026-10-13 with user approval.

## Priority
High

## Created Date
2026-10-12

## Last Updated
2026-10-15

## Request
Prepare a Brain handoff for another agent to implement easy API-based book acquisition, using the verified KetabOnline/Shamela investigation and demo diagnosis. Then (2026-10-12): "implement ketab online book import feature".

## Canonical Handoff
- [Implementation handoff](../plans/2026-10-12-ketabonline-book-import-handoff.md) — scope, source contracts, code entry points, implementation sequence, acceptance tests, and kickoff prompt.
- [Source investigation](../intake/2026-10-12-book-api-investigation.md).
- [Recorded evidence](../intake/2026-10-12-book-api-evidence.json).
- [Books feature](../features/books.md).
- Decision: [ADR-003](../decisions/ADR-003-ketabonline-provider-import.md).

## Outcome
Mobile users can search KetabOnline titles or enter a book ID, review metadata, import complete available text and chapters through a durable background job, read in the existing native reader, and retain supported offline reading and annotations.

## Implementation Checklist
- [x] Recheck current repository state and record the provider identity/cache/API design in an ADR.
- [x] Add validated KetabOnline search, metadata, ZIP/page, and per-volume index adapters.
- [x] Add backward-compatible provider identities and durable import persistence.
- [x] Implement owned, idempotent background acquisition with recovery, retries, cancellation, and completeness checks.
- [x] Adapt reader/navigation/annotation/source-policy contracts and versioned offline caches.
- [x] Add mobile discovery, metadata, import progress, retry, and missing-content states.
- [x] Validate large/small/empty books plus interruption, ownership, refresh, and legacy Shamela regressions.
- [x] Complete Brain API/database/feature/ADR updates and record actual validation and remaining release work.
- [x] Apply the schema to the production database.
- [x] Deploy the Trigger worker and the API, then ship the mobile update (Android Preview OTA).

## Code Map
- Adapter (pure): `packages/document/src/book/ketabonline.ts` (+ tests).
- Transport: `packages/jobs/src/ketabonline-client.ts`. Pipeline: `packages/jobs/src/book-source-import.ts`; dispatch `dispatch-source-import.ts`; tasks `book-tasks/import-book-source.ts`, `book-tasks/recover-book-source-imports.ts`; shared annotation rebinding `book-page-annotations.ts`.
- Localhost-only scripts: `packages/jobs/scripts/ketabonline-live-smoke.ts`, `packages/jobs/scripts/run-source-imports-locally.ts`.
- API: `apps/api/src/trpc/routers/book-source.routes.ts`; provider-aware `book-page-reader.ts`, `book-chapter.routes.ts`, `book-content-policy.ts`, bounded `book.getBook`.
- Mobile: `screens/book-source-search-screen.tsx` (`/book-ketabonline`), `components/book/book-source-import-progress.tsx`, `book-source-import-status.tsx`; cache v2 in `lib/book-cache-format.ts`, `book-cache-page.ts`, `book-cache-repository.ts`, `book-cache-restore.ts`; detail, reader and add-book screen updates.

## Validation (2026-10-12/13)
- Unit: document 28 pass (16 new adapter tests); API 69 pass plus the provider policy test; mobile book-cache 79 pass (format v2, provider page round trip, provider-vs-Shamela identity isolation, legacy v1 decode).
- PostgreSQL (isolated localhost `alghurobaa_source_import_test`): pipeline 6/6 (first import, idempotent replay, refresh with annotation rebinding and reorder/removal resequencing, missing text, chapter-phase failure then retry repair, cancellation, stale generation, single active import); router 2/2 (duplicate/concurrent starts share one job, owner-only retry/cancel and error visibility, restart after cancel, retry conflict, missing-text preview, search `localBookId`, upstream 503/HTML mapped to `BAD_GATEWAY`). Trigger dispatch was disabled in tests.
- Live smoke (opt-in script, isolated DB): 29423 → 19 pages, 1 chapter, 3.6 s; 62952 → 5,444 pages, 31,134 paragraphs, 27,295 footnotes, 2,762 chapters, 10 volumes, 11.2 s, peak RSS 674 MB, ZIP 5.27 MB / JSON 69.8 MB; replay kept every page ID and content version; 500300 → `unavailable`, no book.
- Native UI (Android emulator, dev client, local API on the isolated DB, live upstream): entry row, Arabic title search and Load more, ID entry, floating preview sheet, import to completion, read, next page, 2,762-chapter tree, chapter tap, volume-2 page, footnote sheet, 500300 explained, Open book / Update, cancel then retry to completion, offline download and offline reading/next page, keyboard open, light and dark. Evidence: [workshop and final screenshots](https://claude.ai/artifact/XyLWC183gGVm592aM36BpR).
- Fixed during QA: NativeWind TextInput crash on `text-right` (it also crashed the existing in-book search screen), search pill height, RTL labels, pluralization, stale "In library" badge.
- Not tested: physical device, TalkBack traversal, the deployed Trigger worker against Supabase latency (the pages phase is about 55 batched transactions for 62952), annotation remapping on device.

## Release Requirements
1. Approve and apply the additive schema to production (`bun db:push`). `bun db:migrate` previously demanded a destructive reset; do not accept a reset.
2. Deploy the Trigger tasks (machine `medium-1x`, `maxDuration` 900 s, concurrency 1) before or with the API so saved jobs dispatch.
3. Deploy the API, then ship the mobile update (route `/book-ketabonline`, cache format v2). Existing caches are untouched: provider books are new and only newer app builds write format-v2 files.

## Release (2026-10-13, user-approved)
- Commit `544e2451` pushed to `origin/main` (12 earlier local release commits were pushed with it).
- Production DB: read-only diff was 66 lines, purely additive (nullable columns, new table, indexes, one `ON DELETE SET NULL` FK). `db push` stopped on Prisma's generic warning for the two new unique indexes; both cover new all-NULL columns, so it was applied with `--accept-data-loss` for exactly that diff. Re-diff empty. `db:migrate` not run.
- Trigger: version `20261013.1`, 4 tasks (adds `import-book-source`, `recover-book-source-imports`).
- API: production deploy healthy at `544e2451`, aliased `https://alghurobaa-api.vercel.app`; live `bookSource.preview` verified for 29423 (available) and 500300 (explained unavailable).
- Mobile: Android Preview OTA `2026.10.13`, runtime `1.0.111`, update group `b0894a1b-f59d-49e5-9944-54930e316227`.
- Not yet observed in Production: a real import run by the deployed worker (no production book was imported during release).
- 2026-10-15 follow-up (user-approved): KetabOnline screen switched to an English, left-to-right interface (English placeholder, units and source label; LTR rows, search pill and preview sheet; Arabic only as content, counts placed before Arabic author names so lines keep LTR order). Verified on the emulator; Android Preview OTA `2026.10.15`.

## Boundaries
First provider: KetabOnline. Existing Shamela WebView capture is unchanged. Shamela issued-key integration, bulk archive decoding, and MCP recovery are separate work. Upstream category filtering remains unverified, so no category selector is shipped. No production rollout was performed.
