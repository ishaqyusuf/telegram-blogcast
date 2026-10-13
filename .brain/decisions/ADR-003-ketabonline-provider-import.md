# KetabOnline Provider Import

Status: Accepted
Date: 2026-10-12

## Context
KetabOnline publishes whole-book text as a validated ZIP (one `<id>.data.json`) and complete chapter trees through a per-volume recursive index API. The existing reader, chapter tree, offline cache and annotation models were built around Shamela page-by-page WebView capture (ADR-001, ADR-002), with `shamelaId`/`shamelaPageNo` naming throughout. The handoff required provider-aware identity, durable worker acquisition, bounded responses and backward-compatible caches, without disturbing Shamela capture.

Verified constraints (2026-10-12): `index?is_recursive=1` without `part` silently stops at 1,000 root rows; `part` is the volume *name* (`"1"`..), not the opaque part ID; the ZIP for book 62952 embeds 3 of 2,762 index entries; book 500300 returns metadata 404 while its ZIP returns 200 with no pages.

## Decision
**Identity.** `Book.sourceProvider` + `Book.sourceBookId` (unique together) and `BookPage.sourcePageId` (unique per book) identify provider content. `shamelaId`/`shamelaUrl` stay null for provider books; IDs are never deduplicated across providers or inferred from titles. `BookPage.shamelaPageNo` keeps its existing role as the per-book reading sequence (as for user-created books): provider pages get `1..N` in validated order (volume ordinal, then source page ID). Printed page numbers and volumes are stored separately; adjacency comes from that sequence, never `printed ± 1`. `BookVolume.sourcePartId` records the opaque part ID. `shamelaUrl` is `""` (the existing non-Shamela convention).

**Acquisition.** `BookSourceImport` is a durable outbox row created by the API before dispatch; Trigger task `import-book-source` receives only `{importId, generation}`. `activeKey = "<provider>:<id>"` (unique, nulled when terminal) makes duplicate starts share one job. The worker: metadata → bounded ZIP download (64 MiB compressed / 160 MiB entry, streamed inflate with a byte cap, exact entry name, HTTPS host/path allow-list, no redirects) → validated pages → idempotent batched upserts keyed by `(bookId, sourcePageId)` with per-page content hashes (unchanged pages are skipped on replay) → atomic page publication → every volume index fetched by part name → full-tree validation (parents, duplicates, page targets, expected count) → single-transaction chapter publication and completion. Each batch commits together with a generation-guarded progress update, so cancellation or a newer generation rolls back that batch and stops. Refreshes keep local page IDs; new pages that would collide are written as provisional/pending and the publish step resequences through a negative range, retires removed pages (soft delete, retired sequence range) and recomputes adjacency. A failed chapter phase leaves saved pages readable and the previous tree untouched; retry repairs it. Missing text (`not_found`/zero pages) ends as `unavailable` without creating a book. Machine `medium-1x` (2 GB), concurrency 1, `maxDuration` 900 s; a five-minute recovery schedule dispatches stranded queued jobs and reconciles dead runs.

**Content.** KetabOnline HTML is converted deterministically (no AI) with `htmlparser2` into the existing paragraph/footnote rows: text only (scripts, handlers and links are dropped), source `p-N` numbers kept as `pid` when monotonic, inline `(n)` markers kept in text with `footnoteIds`, footer notes after `g-page-separator` as footnotes, Quran/holy-text/hadith/basmala spans as `c5` source marks. Unverified page fields (`quran`, `hadeeth`, `shrooh`, `rowa`, `reciters`, `seal`) are recorded in `rawJson.unsupportedFields`, not rendered. Running chapter titles are derived per volume after the tree publishes.

**Annotations.** Annotation rebinding moved to `@acme/jobs/book-page-annotations` and is shared by Shamela page saves and provider refreshes; unresolved anchors keep their pid/quote.

**Policy and cache.** Provider books are read-only (`editable=false`, `sourceType="ketabonline"`), keep personal highlights/comments/audio links, and are never public-exportable (`canExportBookContent` requires a Shamela book with no provider). Every readable page remains privately cacheable. Offline page files gain an explicit format version 2 (`sourceProvider`, provider `sourceBookId`, local sequence as `sourcePageNo`) used only for provider pages; version 1 is unchanged and still decodes. The SQLite `source_book_id` index stores only Shamela identities, so provider IDs never match Shamela links, and restore accepts only version-1 files.

**API bounds.** Interactive search/preview make one short upstream call. `getBook` returns one page row plus `pageCounts` (and an optional `focusPageId`) for provider books instead of thousands of rows; chapter browsing uses the existing paginated/virtualized tree.

## Consequences
- Shamela WebView capture, its chapter capture and legacy caches are unchanged; `shamelaPageNo` keeps a dual meaning (Shamela page ID for Shamela books, local sequence otherwise), documented here.
- Category browsing is not exposed: upstream category filters were not verified to work.
- Public folder export/restore excludes provider books until a redistribution policy exists.
- Refresh replaces changed pages in place one batch at a time (each page atomically); a cancelled refresh can leave a mix of old and refreshed pages, but never removes pages, chapters or annotations before publication.
