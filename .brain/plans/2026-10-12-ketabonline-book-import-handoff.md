# KetabOnline Book Import — Implementation Handoff

Prepared: 2026-10-12. Status: ready for implementation, not implemented.

Task: [KetabOnline book acquisition](../tasks/2026-10-12-ketabonline-book-import.md). Evidence: [investigation](../intake/2026-10-12-book-api-investigation.md), [HTTP/JSON and REA records](../intake/2026-10-12-book-api-evidence.json). Current behavior: [books](../features/books.md).

## Intended Result And Scope

Add KetabOnline as a book acquisition source in the existing mobile books flow. A user searches an Arabic title or supplies a positive KetabOnline book ID, sees edition/author/volume/page metadata, starts an import, follows durable progress, and opens saved content in the existing native reader. Complete chapters must navigate to the correct saved pages across volumes. Provide offline reading through the existing private cache/download system after its provider assumptions are corrected. Imported source text is read-only; personal annotations remain supported.

First delivery covers title search, metadata, full available text, complete per-volume TOC, progress/recovery, native reading, and offline compatibility. Category browsing can follow once the real filter contract is verified. A missing-text book needs a clear unavailable state, rather than a successful empty import. Use existing mobile patterns for loading, inline errors, retry, RTL, themes, and keyboard-safe inputs; keep technical details out of the user's flow.

This task implements al-ghurobaa, not the external demonstration site. Preserve the existing Shamela capture path governed by [ADR-001](../decisions/ADR-001-separate-shamela-page-and-chapter-capture.md) and [ADR-002](../decisions/ADR-002-automatic-webview-page-loading.md). Direct KetabOnline API acquisition is a separate provider, not a direct-HTTP replacement for Shamela WebView capture.

Defer native Shamela API integration until issued credentials and real endpoints are available. Defer its bulk archive parser and MCP. Neither Android APK was installed or observed during research; do not claim this design reproduces private Android traffic. No production rollout is authorized by this handoff alone.

## Start Here

1. Read repository `AGENTS.md`, `.brain/BRAIN.md`, `.brain/SYSTEM_OVERVIEW.md`, `.brain/system/overview.md`, `.brain/system/architecture.md`, `.brain/engineering/ai-rules.md`, `.brain/engineering/coding-standards.md`, and `.brain/tasks/in-progress.md`. Follow any current task pointers; inspect the working tree before editing.
2. Read the linked research, books feature, API contracts/endpoints/permissions, database schema/relationships/migrations, and the two Shamela ADRs. Read the applicable personal global/Expo coding standards referenced by the Brain.
3. Move this task's pointer from backlog to in-progress when implementation starts. Keep task progress here and in the dedicated task; do not rewrite the completed investigation as an implementation task.
4. Record an ADR for the provider identity model, cache compatibility, and worker ingestion boundary. The design requirements below are constraints; choose the smallest coherent implementation after inspecting current code.

The root currently defines both `db:migrate` and `db:push`. The user's AGENTS instructions require running **both `bun db:migrate` and `bun db:push` after Prisma changes**, and prohibit manually creating migration files. These instructions take precedence over older conflicting Brain guidance. Inspect the actual target/environment and migration diff first. Do not accept a destructive reset to get past drift; preserve data and report the concrete blocker if safe reconciliation cannot proceed. Preview environments may share production services; integration test fixtures require an isolated database.

## Verified KetabOnline Contracts

Community reference implementation: [ragaeeb/ketab-online-sdk](https://github.com/ragaeeb/ketab-online-sdk). Prefer a small typed adapter around the verified upstream contract, or audit the SDK's behavior before adopting it. This is an observed service contract, not a guaranteed official API commitment.

Base URL: `https://backend.ketabonline.com/api/v2`.

| Operation | Verified request or field | Implementation requirement |
| --- | --- | --- |
| Title search | `GET /books?q=<encoded Arabic>&page=1&limit=3` | Encode query with URLSearchParams; validate pagination and application status. |
| Book metadata | `GET /books/{id}` | Inspect HTTP status and response `code`, `status`, `data`; handle unavailable metadata explicitly. |
| Content location | Metadata `files.data.url` | `data.url` was empty in a valid response. Validate returned download URL before fetching. |
| ZIP | `https://s2.ketabonline.com/books/{id}/{id}.data.zip` | Verified naming pattern, not a substitute for valid metadata; one `{id}.data.json` was observed. |
| Recursive TOC | `GET /books/{id}/index?is_recursive=1&part=<volume number>` | Fetch every volume/part; ZIP-only indexes can omit almost the entire TOC. Validate full response/pagination rather than assuming a single response always contains everything. |

The SDK exposes `getBooks({query,page,limit})`, `getBookInfo(id)`, `getBookContents(id)`, and `getBookIndex(id,{isRecursive:true,part})`. `getBookContents` fetches the ZIP; it does not establish a complete chapter tree.

Observed page fields: `id`, `page`, `index`, `content`, `seal`, `quran`, `hadeeth`, `shrooh`, `rowa`, `part`, `reciters`. `content` is formatted Arabic HTML, including paragraph IDs such as `p-1`. `part` is an object with `id` and `name`; do not assume part IDs equal ordinal volume numbers. Derive and validate volume mapping from metadata and payload. Printed page numbers can repeat between volumes.

Observed index fields: `id`, `parent`, `title`, `book_id`, `page_id`, `to_page_id`, `page`, `part_name`, `title_level`, `reciters`, `children`. Preserve hierarchy and source page references, not just chapter title text. Treat annotation/audio-related source fields as provenance; do not turn unverified external references into valid local media relations.

Source identity is `(provider, external book ID, external page ID)`, with separate reading order, printed page label, and volume identity. A ZIP's `source: المكتبة الشاملة` does **not** prove an original Shamela book ID or edition match. Never deduplicate across providers based on equal numeric IDs or similar titles.

## Reproduction Samples And Known Failures

| Book ID | Verified data on 2026-10-12 | Required behavior |
| --- | --- | --- |
| `29423` | قيام الليل .. رياض الصالحين .. وملاذ المحبين; 19 pages, 1 volume, 1 TOC node; ZIP 20,591 bytes | Small live smoke test; native reader and chapter navigation work. |
| `62952` | مصنف عبد الرزاق - ط التأصيل الثانية; 5,444 unique nonempty pages, 10 volumes; ZIP 5,267,564 bytes, JSON 69,781,888 bytes | Full import on an appropriately sized worker; bounded reader/API responses. |
| `500300` | Listed by demo; metadata 404; ZIP 200 with empty pages/index arrays | Explain missing text; do not mark complete/readable or create fake content. |

For `62952`, metadata declares 2,762 index entries but ZIP embeds only **3**. Per-volume recursive API counts were `[301,234,218,239,289,325,343,282,246,285]`, totaling 2,762 unique index IDs, all targeting existing source pages. Reverify current snapshots before treating historical counts as exact permanent expectations.

The demo's large-book route returned HTTP 503 / Cloudflare `1102`, which denotes CPU or memory limit exhaustion. Its code downloads/parses the full book in the server function and maps all pages in the reader. Which resource was exhausted was not established without logs. Avoid this acquisition/rendering boundary in al-ghurobaa.

`category_id=1` and `category_id=2` returned the same first rows as the unfiltered list, with unrelated category IDs. The real category filter remains unknown; author filtering was not tested. Do not expose a nonfunctional filter. Arabic title search `رياض` worked and is sufficient to start phase one.

## Existing Code And Critical Compatibility Work

| Area | Entry points | What to inspect/change |
| --- | --- | --- |
| Schema | `packages/db/src/schema/book.schema.prisma` | `Book`, `BookPage`, `BookVolume`, `BookTocNode`, import/history/annotation relations. |
| Book API/write paths | `apps/api/src/trpc/routers/book.routes.ts` | Source detection, edit permissions, metadata, writes, refresh, download contracts. |
| Reader/navigation | `apps/api/src/trpc/routers/book-page-reader.ts`, `book-chapter.routes.ts`; mobile `use-book-page-resource.ts`, `book-reader-navigation.ts` | Provider-aware page lookup, adjacency, chapters and missing-page behavior. |
| Content policy | `apps/api/src/trpc/routers/book-content-policy.ts` | Distinguish private cache access from public content export and publication. |
| Durable worker pattern | `packages/jobs/src/book-chapter-import.ts`, `dispatch-chapter-import.ts`, `book-tasks/import-shamela-chapters.ts`, `book-tasks/recover-chapter-imports.ts` | Ownership, outbox/recovery, generations, transaction boundaries, retry/cancel. |
| Document conversion | `packages/document/src/book/document.ts`, `reader.ts`, `shamela.ts` | Use canonical reader documents; preserve Arabic formatting, paragraphs and footnotes. |
| Mobile flow | `apps/expo-app/src/screens/book-fetch-screen.tsx`, `book-detail-screen.tsx`, `book-chapters-screen.tsx`, `book-reader-screen.tsx` | Reuse navigation, import status, chapters and reader components. |
| Offline state/cache | `apps/expo-app/src/lib/book-cache-format.ts`, `book-cache-page.ts`, `book-cache-reader.ts`, `book-cache-repository.ts`, `book-cache-download-service.ts`; `src/db/book-cache-db.ts`, `src/store/book-offline-store.ts` | Versioned identity, download/restore validation, account scope and legacy compatibility. |

Paths in the same table cell without a full prefix share the preceding directory. Inspect current exports and tests rather than assuming every helper is reusable as-is.

Important existing assumptions:

- `BookPage.shamelaPageNo` and `shamelaUrl` are currently required, with uniqueness on `(bookId, shamelaPageNo)`. `Book` has `shamelaId`/`shamelaUrl`; TOC and adjacency contracts also carry Shamela fields. Do not put KetabOnline IDs or URLs into these fields just to satisfy validation. Add compatible provider identities and adapt internal lookup/navigation; retain readable legacy Shamela data and contracts where needed.
- Source/editability checks currently recognize Shamela. KetabOnline content must also be immutable as imported text without accidentally forbidding personal highlights/comments/audio links or granting edits to another user's book.
- `book-cache-page.ts` derives `sourceBookId` from `shamelaId`. Its fallback decode constructs `https://shamela.ws/book/...` and labels the source Shamela. Cache files currently use strict version 1 schemas. If provider fields change the file contract, introduce an explicit new format with backward-compatible version 1 decoding/migration; never reinterpret old numbers as another provider. Preserve local book/page IDs and protected annotations during restore/refresh.
- `canExportBookContent` currently permits published read-only Shamela books with a valid Shamela ID. Do not fake source metadata or broaden this to all imported/private books. Specify private offline cache eligibility separately from public/export permission. A public upstream download alone does not establish redistribution rights; keep public export disabled for the new provider unless its intended policy has been established.
- Existing annotation anchors include Shamela-specific page numbers. Define safe provider-aware anchors and remapping, and preserve existing annotations, reading position, and media references during retries/refreshes.
- The chapter import outbox stores HTML and has source-specific parsing/size assumptions. Reuse its durable pattern, not its raw-HTML model or parser for a 70 MB JSON book. `@zip.js/zip.js` already exists in the jobs package; assess existing dependencies before adding another ZIP library.

## Implementation Sequence

### 1. Provider adapter and source identities

Create typed validation/normalization functions for search results, book metadata, ZIP pages and recursive indexes. Parse positive IDs, status envelopes, optional fields and volume/page labels without conflating printed numbering with source IDs. Keep network code separate from pure conversion so synthetic fixtures can test it without hitting upstream on each test run.

Choose additive database/contract changes for provider book/page identity, stable source ordering and volumes. Enforce appropriate uniqueness in the database, including ownership/import scope where applicable; do not introduce globally shared private records accidentally. Record the schema/cache/API decision in an ADR and generate the migration using repository scripts.

### 2. Durable acquisition pipeline

The API accepts a provider/book ID and returns a local import identity promptly. A Trigger job acquires metadata, downloads/unpacks/validates content, persists pages in bounded batches, fetches all volume indexes, validates the tree, and publishes completion. API and mobile clients receive compact progress and normal paginated/page responses, never the whole expanded source JSON.

Persist queue acceptance before dispatch and use recovery for dispatch failures or abandoned jobs. Reuse current ownership patterns deliberately: authenticated ownership where available, installation ownership for any supported anonymous flow. Status/retry/cancel cannot be controlled by another owner. Send only import ID/generation to the worker, not source data or credentials.

Use database-enforced deduplication for duplicate start requests and stable provider page mappings for retry. Track phases, pages/chapters completed, errors and generation. Retry should resume safely or deterministically replay idempotent writes. Cancel stops future publication; stale generations cannot overwrite a newer run. Avoid a transaction spanning upstream downloads or the entire book.

Keep text availability and TOC completeness separate, as in existing page-first capture. A safe saved page can be readable while indexes remain incomplete, but a whole-book import is complete only after all validated pages and all volume indexes are accounted for. A failed/cancelled refresh must preserve the previous usable snapshot and annotations. Use explicit batch/checkpoint/publication semantics; do not erase old trees/pages at the beginning of a refresh.

Do not use an in-process fire-and-forget worker in Vercel. A capacity-tested Trigger task is appropriate; measure and bound parsing/download memory and execution time. Streaming ZIP download alone does not make `JSON.parse` of a 70 MB document bounded; choose a tested parser/budget and worker allocation.

### 3. Pages, documents and chapters

Convert formatted HTML to the existing document/paragraph/footnote representation deterministically; do not send structured source pages through AI. Preserve paragraph IDs within each page, Arabic text, formatting, headings, inline references and footnotes supported by the reader. Sanitize scripts/event handlers and unsafe URLs through the established document boundary. Record unsupported fields honestly rather than silently turning them into incorrect content.

Map each external page ID to its stable local page ID. Store source ordering and volume/printed-page labels separately. Resolve previous/next from validated source order, not `printedPageNo ± 1`. Chapter taps must resolve the target provider page correctly; KetabOnline cannot fall through to constructing a Shamela WebView URL.

Flatten recursive indexes with parent/child integrity, deterministic sibling order and depth. Reject duplicates with conflicting content, cycles, cross-book index records and missing target pages before claiming a complete tree. Compare page/index counts to available metadata, taking response pagination and zero-index books into account. Fetch every volume even if ZIP includes a few chapters. Do not publish a truncated tree as complete after one failed part request.

Refresh retains local identities and uses content versions/hashes appropriate to a validated snapshot. Reuse annotation-remapping logic after removing provider assumptions. Preserve unresolved annotations for recovery rather than discarding them when content changes.

### 4. API, mobile and offline integration

Expose title search, metadata, start/status/retry/cancel through typed tRPC procedures consistent with current router organization. Procedure names are a design choice; document input/output/ownership/error contracts. Bound search pagination, status payloads, chapters and page chunks. Use recoverable structured errors for upstream HTTP failures, invalid archives, unavailable text and partial index failure; never surface an HTML/plain-text error as a JSON parse failure.

Add source selection/discovery within the existing add-book flow, metadata preview, and persistent import status. Let the user leave/reopen the app while the worker continues; reconcile status on return. Show progress from known counts/phases, not an invented percentage. Support retry/cancel, first available page opening and honest incomplete-TOC state.

Adapt cache schemas, encoding/decoding, repository identity validation, download/restore and native navigation together. A cached KetabOnline page must retain its actual provider offline and never become a Shamela page after metadata fallback. Verify legacy cache files remain readable. Support private offline download of completed available content without automatically granting public folder export. Render bounded page content and incremental chapter lists; do not mount thousands of pages.

### 5. Input/network boundaries

Client input is a validated provider ID, not an arbitrary download URL. Follow metadata download links only after validating HTTPS and the verified content host/path; reject or revalidate redirects. Set finite timeouts and explicit compressed/uncompressed size, ZIP entry and JSON/schema limits that accommodate the verified large sample. Reject corrupt/mismatched book IDs, archive traversal entries and decompression bombs. Do not log complete book bodies, ownership tokens or secrets. Handle upstream rate limiting with bounded backoff and limited concurrency; avoid repeatedly downloading the same content for every reader request.

## Acceptance And Validation

Implement focused tests for behavior and failure seams, using synthetic or minimal fixtures rather than committing whole downloaded books. Live smoke tests are opt-in and record current upstream counts separately from deterministic tests.

1. Arabic title search is URL-encoded, paginated and returns useful metadata; invalid IDs/upstream failures are explained. Categories are absent unless actual filtering is verified.
2. Book `29423` imports, opens in the native reader, and its chapter selects the saved target page. Formatting/footnotes are tested with representative content fixtures.
3. Book `62952` imports all current pages and every volume's TOC on the worker. Historical baseline: 5,444 pages, 2,762 TOC nodes across 10 volumes. Capture counts, duration, memory/capacity evidence and response sizes; no full-book API/mobile payload or demo-style request exhaustion.
4. Book `500300` is rejected/explained as missing content even if a ZIP request returns 200. No misleading success or fabricated empty page stubs.
5. Recursive TOC with partial ZIP indexes, repeated printed page numbers, arbitrary part IDs, nested children, missing targets and duplicate IDs is handled correctly. One failed volume keeps TOC incomplete and retry repairs it.
6. Duplicate start, retry after partial write, dispatch failure/recovery, worker interruption, cancellation, and stale generations do not duplicate books/pages or destroy prior snapshots. A second connection/owner cannot retry/cancel or read private job state.
7. Refresh preserves annotation anchors or explicitly retains unresolved anchors, stable local page IDs, reading position and media references; unchanged pages do not churn identities. Source text stays read-only.
8. Provider source policy distinguishes private cache from public export. User/private books remain protected; old Shamela policy and WebView acquisition tests keep passing.
9. Legacy version 1 cache files decode as before. New provider files round-trip, survive app restart/offline lookup and never synthesize Shamela URLs. Interrupted cache downloads preserve previously valid files and protected annotations.
10. Exercise Android discovery/metadata/import/retry/cancel, background/reopen, cross-volume chapter navigation and offline reading in RTL/light/dark modes. Search remains usable with the keyboard open. Record whether testing used emulator or physical device and what remains untested.

Run targeted `bun test` suites in the affected API/jobs/document/mobile areas, plus real isolated PostgreSQL tests for ownership, idempotency and rollback/publication boundaries. Existing useful suites include `book-chapter-import.integration.test.ts`, `book-page-write.postgres.test.ts`, `book-content-policy.test.ts`, `book-cache-format.test.ts`, `book-cache-page.test.ts`, `book-cache-repository.test.ts`, and `book-reader-navigation.test.ts`; extend them only for meaningful new behavior. Check current package scripts for typecheck/lint/build commands and run checks for changed packages. Distinguish pre-existing failures from new failures with evidence. Run `git diff --check` and complete the Brain impact check.

## Completion And Release Handoff

Update the books feature with actual behavior, API endpoints/contracts/permissions with implemented procedures, database schema/relationships/migrations with generated changes, and the ADR with the chosen durable design. Record validation evidence and residual limitations in the dedicated task. Keep ledgers pointer-only; move it to done only when the requested implementation and validation are actually finished.

Report API, worker, DB and mobile changes together so a subsequent release can order schema/worker/API/mobile rollout safely. Do not reuse the older Shamela task's deployment/secret-transfer authorization as blanket authority for this new work. If release was not requested, finish a concrete reviewable implementation and document release requirements without claiming a deployed integration.

## Prompt To Give The Implementing Agent

> Implement `.brain/tasks/2026-10-12-ketabonline-book-import.md` using `.brain/plans/2026-10-12-ketabonline-book-import-handoff.md` as the canonical handoff. Read AGENTS and relevant Brain context first, inspect current code and working-tree changes, and move the task to in-progress. Build KetabOnline title search/metadata, durable whole-book text plus all-volume TOC acquisition, provider-aware native reading and compatible private offline caching. Preserve existing Shamela WebView behavior, annotations and legacy cache files. Use the linked verified evidence; do not repeat Android reverse engineering or claim unknown category/credential contracts. Complete meaningful tests and Brain documentation. Deliver a reviewable implementation and validation report; production deployment is outside this handoff's authorization.
