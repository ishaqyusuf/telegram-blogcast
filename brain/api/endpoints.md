# API Endpoints

## Purpose
High-level map of the API surface and where endpoint logic lives.

## How To Use
- Update when routers or major REST surfaces are added, removed, or renamed.
- Keep this file navigational; detailed payloads belong in `contracts.md`.
- Link route-specific feature docs when they exist.

## Template

### Primary API Surface
- `apps/api` is the main backend application.
- tRPC routers live under `apps/api/src/trpc/routers`.
- Additional server query logic lives under `apps/api/src/queries`.

### Known Router Domains
- Albums
- Blogs
- Books
- Channels
- Podcasts
- App/root router composition

### Channels Router Highlights
- `channel.importTelegramAudioLink`: imports one public Telegram audio post link into the same Blog/File/Media shape used by the channel fetcher. Duplicate channel/message imports return the existing blog instead of creating a second record.

### Internal Worker Endpoints
- `POST /api/internal/transcription-jobs/claim`: local transcriber claims the next queued, retryable failed, or stale running transcription job.
- `POST /api/internal/transcription-jobs/:id/progress`: worker updates DB-backed queue progress, stage, chunk counters, worker ID, and heartbeat.
- `POST /api/internal/transcription-jobs/:id/complete`: worker saves returned transcript segments and marks the job completed.
- `POST /api/internal/transcription-jobs/:id/fail`: worker records an error, marks the job failed, and increments retry count.

### Books Router Highlights
- `book.syncBookFromShamela`: imports or re-imports a Shamela book URL, stores `BookImportHistory`, refreshes metadata, and syncs TOC chapter stubs.
- `book.getBookImportHistory`: returns recent book import attempts for the fetch screen/history UI.
- `book.fetchPage`: imports or re-imports a single Shamela page, records `BookPageImportHistory`, refreshes paragraphs/footnotes, and remaps annotations against the new paragraph set.
- `book.fetchNextPage`: fetches the next sequential Shamela page using the same preservation logic as `fetchPage`.
- `book.importBookPageManually`: creates or reuses a book, splits pasted page text into paragraphs, stores the page, and records a `manual_paste` page-import history entry.
- `book.getBookPageImportHistory`: returns recent page-level import attempts for a specific book.
- `book.addHighlight`, `book.syncHighlights`, `book.addPageComment`, `book.syncComments`: now persist paragraph anchor metadata used during page re-import remapping.
