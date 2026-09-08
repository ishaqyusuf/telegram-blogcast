# Task: Durable Mobile Book Import And Reader

## Status
Blocked

## Priority
High

## Created Date
2026-09-08

## Last Updated
2026-09-08

## Global Ticket
- Ticket Position: 1/1

## Source Context
Production chapter capture times out inside Vercel and mobile reports a JSON parse error for its plain-text error response. User requested Trigger integration modeled on Halaalvest and EwaTrade, provisioning through their signed-in Chrome account, Vercel credentials, and local `.env` / `.env.prod`.

Latest scope: mobile only. Do not implement web capture or a web reader. Give web suggestions only; neither curl success nor iframe display proves a reliable interactive capture mechanism. Use the mobile Shamela WebView for page capture and full root chapter expansion.

Save the requested page first, capture chapters separately from the book root, queue durable atomic import, retain annotations and metadata, support retries and saved-page navigation. Reader must support searchable/paginated chapters, chapter-tap existing-page lookup or WebView import, and next/previous fetching with mobile swipes. Source verification target is `/book/23833/106`, chapters `/book/23833`. Finish implementation and release, then leave physical-device testing to the user. User requested pausing the goal at that boundary; the agent cannot change goal pause state and must not claim it did.

## Implementation Progress
- Completion: 85%
- Current Checklist: 12/13 - Release production worker, API, and mobile preview
- Blockers: Deployment safety review requires explicit approval to store the production POSTGRES_URL in the Alghurobaa Trigger project. Do not bypass the rejected environment-sync deployment. Source-map upload remains excluded.

## Implementation Checklist
- [x] Inspect current code and Halaalvest/EwaTrade Trigger patterns.
- [x] Create Alghurobaa Podcast Trigger project and store ignored local dev/prod credentials.
- [x] Complete and verify Vercel and worker deployment environments.
- [x] Implement durable capture, atomic batched worker, retries, idempotency, and failure/cancel recovery.
- [x] Finish lean chapter storage and derived links without creating empty page stubs.
- [x] Wire page-first mobile capture to background chapter import and resumable progress.
- [x] Add paginated searchable chapter hierarchy and incremental loading on scroll.
- [x] Resolve chapter taps to saved pages or WebView import returning to the requested reader.
- [x] Implement next/previous page fetching and mobile swipe navigation.
- [x] Verify annotation/content preservation, completeness, mismatch rejection, failure and retry seams with focused checks.
- [x] Review changes and keep feature/API/database Brain docs synchronized.
- [ ] Apply production DB changes, deploy Trigger, commit/push, and publish EAS preview without unauthorized source-map uploads.
- [ ] Verify release state and provide the mobile testing handoff, recording remaining device checks honestly.

## Validation Evidence
- Final relevant suites: 35/35 unit/API/parser/capture/navigation tests and 5/5 PostgreSQL integration tests passed (40 total). AST verification found zero style/className combinations across the four changed mobile book screens. Git diff check passed. Temporary PostgreSQL was stopped after validation.
- Full API typecheck still reports the three pre-existing album/blog/query-response errors. Mobile and jobs checks also retain existing project errors; no errors identify the changed production book/import files. New jobs test import.meta/CommonJS errors were fixed before the final run.
- Implementation is ready for a local commit. Push/API rollout and EAS publication are intentionally held until the Trigger worker can be deployed with its required database environment; this avoids publishing a mobile flow whose worker is unavailable.
- Final follow-up reviews found no further material issues. Physical-device focus/navigation acceptance remains deferred. Unit/API/capture/navigation suites: 23/23 pass; PostgreSQL integration suite: 5/5 pass.
- The final inspected production diff contained only `ALTER TABLE BookChapterImport ADD COLUMN ownerHash TEXT`. Production db push succeeded on 2026-09-08. No destructive schema changes were used.
- Trigger deployment with database environment sync was rejected by the safety reviewer because explicit approval for transmitting the production database connection string is required. User approval has been requested; no workaround deployment or secret transfer was attempted.
- Post-review focused API suite: 8/8 pass including installation ownership, concealed owner hash, and retry generation limit. PostgreSQL integration: 5/5 pass including cancellation from a separate connection while the worker holds the Book lock; all tree writes rolled back and page/annotation snapshots remained unchanged.
- API and database Brain contracts now describe durable acceptance, lean batched publication, per-install ownership, pagination, and compatibility behavior. Mobile-only scope is explicit. Follow-up reviewers are checking the fixes.
- Production schema diff was inspected and contained only the new BookChapterImport table, indexes, and book FK. `bun --env-file=../../.env.prod x prisma db push` succeeded on the existing production PostgreSQL database on 2026-09-08. No existing columns were dropped or existing content rewritten.
- Removed the unused synchronous HTML tree writer and stopped the older AI TOC path from creating page stubs. Legacy node columns are retained for compatibility; the active worker stores no URLs or metadata JSON.
- An AST check confirms zero style/className combinations in all four touched mobile book screens. Focused unit/API/gesture/capture suites: 19/19 pass, plus four PostgreSQL integration tests.
- Two independent read-only reviews completed. Fixes cover per-install import ownership and capture/retry limits, cancellation without waiting for the book lock, isolated recovery failures, malformed chapter links, recovered saved-page navigation, and removal of the detail screen's legacy server-fetch/unbounded TOC path. Focused regression checks and follow-up review are pending; completion remains 77%.
- The ownership fix adds nullable ownerHash to BookChapterImport; Prisma was regenerated and the inspected additive change was pushed to production successfully. Worker/API/mobile release remains gated on environment-transfer approval.
- Local PostgreSQL integration suite: 4/4 passed in isolated `alghurobaa_chapter_test` on localhost port 55438. Full retained fixture imported 2,405 nodes and 222 roots across 500-node batches in about 238ms locally (not a production performance claim). All non-root parent links resolved; page count remained one; formatted content, paragraphs, highlights, comments, and metadata were byte-for-byte equivalent as returned by Prisma.
- A test-only PostgreSQL trigger forced final publication failure after tree writes. The transaction restored the previous tree, retry preserved node IDs, and no page content changed. Cancelled and stale-generation runs made no tree writes.
- Legacy `book.captureShamelaChapters` now delegates to the durable capture route rather than running a long transaction. API capture suite: 6/6 passed for page-first new/pending/complete books, reused queued captures, wrong/root URL rejection, and the saved-page prerequisite. Worker-level missing/unloaded/foreign-link validation remains in the worker validation suite rather than being falsely reported as synchronous capture success.
- Temporary PostgreSQL data directory: `/tmp/alghurobaa-book-pg-20260908`; it contains only synthetic test records. The local instance can be restarted with pg_ctl for subsequent schema tests; production data was not used.
- Current checkout is `main`; existing timeout/batching edits were preserved.
- Trigger project created in existing School Clerk organization through Chrome: `proj_ryiraaguagaettphjklm`, dashboard slug `alghurobaa-podcast-KxDL`.
- Root `.env` and `.env.prod` contain matching project ID and environment-specific keys; values were not printed. Permissions set to 0600. `.env.prod` added to `.gitignore`.
- Vercel UI confirmed production `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_ID`, plus Preview `TRIGGER_SECRET_KEY`. Preview currently shares the same Trigger production worker as the shared backend database. No worker deployed yet.
- `.env.prod` now includes the same project's existing production POSTGRES_URL for worker deployment, copied without exposing its value. Trigger deployment env sync is explicitly limited to POSTGRES_URL and optional POSTGRES_SCHEMA.
- Durable model and worker connected through new `bookChapter` router. Queued captures use an outbox sweeper; stopped runs are reconciled using Trigger run state. Full DB transaction/retry verification remains outstanding.
- Mobile capture now submits to `bookChapter.capture`. Dismissible status/retry/cancel controls and reader/detail recovery use durable server state. Chapter screen uses 40-item server pagination per parent, global title/page-number search, and a saved-page resolution query before WebView navigation.
- Next/previous controls and RTL-aware swipes already existed; missing-page navigation now rechecks the database and guards duplicate in-flight requests.
- Focused validation: 13 tests pass across chapter validation (retained sample: 2,405 nodes), WebView expansion/failure safety, and reader navigation helpers. This does not prove physical-device behavior or deployed worker success.
- Prisma 7.7.0 client generated successfully. API typecheck reports three unrelated existing errors (album telegramMessageId, blog JSON shape, missing query-response type). Mobile typecheck reports existing project errors; no errors matched the changed chapter/import/reader files. Jobs typecheck reports legacy sales/notifications/utils scaffold errors, none in the new worker files.
- Trigger CLI network/authentication issue resolved with approved network access and Chrome authorization. CLI verified successful login under dedicated `alghurobaa` profile for the current account. No live login process remains. Jobs scripts explicitly select this profile rather than the unrelated default redland profile.
- Trigger production dry-run succeeded with the actual project/account and generated worker bundle at `packages/jobs/.trigger/tmp/build-VYX3w7`. No deployment or environment sync was performed (`--dry-run --skip-sync-env-vars`). The public project-ref fallback was added because CLI env-file loading alone happened after config evaluation. The production script preloads `.env.prod` with Bun.
- Removed the jobs package's obsolete Prisma 6 client/instrumentation dependencies; workers use the shared Prisma 7 database client. `bun install --ignore-scripts` updated the lockfile.
- `git diff --check` passed. Remaining delivery work includes lean schema consolidation, database-backed atomicity/retry tests, legacy synchronous chapter route removal/compatibility, detail-screen styling cleanup, final review, schema push, Trigger deployment, git push, and EAS preview.
- No Android tests run in this work phase. Physical-device acceptance is deferred to the user's requested testing session.

## Implementation Notes
- Do not use the reference projects' in-process fallback for chapter imports: it cannot survive a Vercel request ending.
- Retain captures in PostgreSQL; send only import identity/generation to Trigger. Never send whole book HTML through task logs or embed credentials in mobile bundles.
- Existing production deployment is `bc84fed7`; current changes are not yet deployed.
