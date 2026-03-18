# Books Feature

## Purpose
Tracks the current scope, architecture, and roadmap for the books experience across the app and API.

## How To Use
- Update after any significant books-reader, offline, annotation, or search change.
- Keep current-state notes separate from planned implementation work.
- Link API, DB, and task docs when plans become active implementation.

## Template

### Summary
- Feature name: Books
- Goal: Deliver a rich Arabic-first reading experience with metadata, page reading, search, highlights, comments, and offline support.
- Status: Partially implemented with several roadmap items documented.

### Current Surfaces
- Screens:
  - `/books` via `books-screen.tsx`: library grid and shelf filter.
  - `/books/[bookId]` via `book-detail-screen.tsx`: book metadata and chapter tree.
  - `/books/[bookId]/reader/[pageId]` via `book-reader-screen.tsx`: page reader.
  - `/books/[bookId]/search` via `book-search-screen.tsx`: search within book.
  - `/book-fetch` via `book-fetch-screen.tsx`: add book from Shamela URL via AI.
- Components:
  - `book/book-card.tsx`
  - `book/book-page-view.tsx`
  - `book/footnotes-sheet.tsx`
  - `book/chapter-tree.tsx`
  - `book/highlight-toolbar.tsx`
  - `blog-home/blog-home-books.tsx`

### Current API Surface
- tRPC router: `apps/api/src/trpc/routers/book.routes.ts`
- Known procedures:
  - Shelves: `getShelves`, `createShelf`
  - Authors: `getAuthors`, `createAuthor`
  - Books: `getBooks`, `getBook`, `createBook`, `updateBook`, `deleteBook`
  - Planned/download-related: `getBookMeta`, `getBookForDownload`
  - Volumes: `createVolume`
  - Pages: `getPage`, `fetchPage`, `fetchNextPage`, planned `searchBookContent`
  - Highlights: `addHighlight`, `deleteHighlight`, planned `syncHighlights`
  - Comments: `addPageComment`, `deletePageComment`, planned `syncComments`
  - Sync: `syncBookFromShamela(shamelaUrl, aiProvider)`

### Data Model Snapshot
- Core relationship:
  - `BookShelf -> Book -> BookVolume -> BookPage -> BookPageParagraph`
  - `BookPage -> BookPageFootnote`
  - `BookPage -> BookPageHighlight`
  - `BookPage -> BookPageComment`
  - `BookAuthor <-> Book` many-to-many
  - `AiTokenUsage` — tracks provider, model, operation, inputTokens, outputTokens, bookId?, pageId?

### AI Integration
- Metadata extraction prompt (`SHAMELA_BOOK_META_PROMPT`)
- Table-of-contents extraction prompt (`SHAMELA_TOC_EXTRACT_PROMPT`)
- Page-content extraction prompt (`SHAMELA_EXTRACT_PROMPT`)
- Providers: Claude Sonnet 4.6 (Anthropic), GPT-4o (OpenAI), Gemini 2.0 Flash
- **Anthropic uses `url-context-1` beta** — URL passed as a `document` content block; Claude fetches Shamela natively, bypassing server-side IP blocks
- OpenAI/Gemini: server fetches HTML first, embeds in prompt
- `callAI(provider, prompt, maxTokens, sourceUrl?)` → `{ text, inputTokens, outputTokens, model }`
- `recordTokenUsage(db, result, provider, operation, bookId?, pageId?)` — non-fatal, writes to `AiTokenUsage`
- `getTokenUsage` tRPC query — admin visibility into AI costs

### Current Gaps And Future Work
- Reading progress and last-page tracking
- Bookmarks
- Auto-fetch all pages in sequence
- Better offline support and incremental sync

### Planned Implementation Notes

#### Chapter Tree
- Goal: replace flat page list in `book-detail-screen.tsx` with a hierarchical tree.
- Structure: volume -> chapter -> topic rows.
- Behaviors:
  - Group pages by volume and chapter.
  - Show fetched counts and per-item status.
  - Navigate to fetched pages directly.
  - Trigger inline fetch for pending pages.

#### Highlights UI And Offline Sync
- Goal: full highlight UX with offline-first persistence.
- Reader behavior:
  - Long-press paragraph
  - Show floating toolbar with color swatches and delete action
  - Render tinted paragraph backgrounds
- Local SQLite table plan:
  - `local_highlights(localId, serverId, pageId, paragraphId, color, note, createdAt, updatedAt, deletedAt, syncStatus)`
- Sync pattern:
  - Write locally first
  - Push pending creates/deletes in background
  - Merge server highlights on book open

#### Comments UI And Offline Sync
- Goal: offline-first comments with the same sync pattern as highlights.
- Local SQLite table plan:
  - `local_comments(localId, serverId, pageId, paragraphId, content, createdAt, updatedAt, deletedAt, syncStatus)`
- Sync pattern:
  - Local write first
  - Background push and reconciliation
  - Merge server comments on book open

#### Search
- Add or maintain route: `/books/[bookId]/search`
- Search fields:
  - `chapterTitle`
  - `topicTitle`
  - paragraph text
- Planned server endpoint:
  - `searchBookContent(bookId, query)` using PostgreSQL `ILIKE`
- Planned offline search:
  - SQLite FTS5 over local paragraph text

#### Offline Download
- Proposed stack:
  - `expo-sqlite`
  - `drizzle-orm`
  - `expo-network`
- Local SQLite tables:
  - `local_books`
  - `local_volumes`
  - `local_pages`
  - `local_paragraphs`
  - `local_footnotes`
  - `local_highlights`
  - `local_comments`
- Download flow:
  1. User taps Download on book detail.
  2. App checks connectivity.
  3. `getBookForDownload(bookId)` returns fetched content and user data.
  4. App writes a batch to SQLite with progress reporting.
  5. Zustand `book-offline-store` stores `contentHash`, `downloadedAt`, and `lastSyncedAt`.
- Update detection:
  1. On open, fetch `getBookMeta(bookId)`.
  2. Compare remote `contentHash` to local.
  3. Show new-content banner when mismatched.
  4. Allow incremental re-download.

### Planned File Touchpoints
- `apps/expo-app/src/screens/book-detail-screen.tsx`
- `apps/expo-app/src/screens/books-screen.tsx`
- `apps/expo-app/src/screens/book-reader-screen.tsx`
- `apps/expo-app/src/screens/book-search-screen.tsx`
- `apps/expo-app/src/components/book/chapter-tree.tsx`
- `apps/expo-app/src/components/book/highlight-toolbar.tsx`
- `apps/expo-app/src/components/book/book-page-view.tsx`
- `apps/expo-app/src/db/local-schema.ts`
- `apps/expo-app/src/db/local-db.ts`
- `apps/expo-app/src/store/book-offline-store.ts`
- `apps/expo-app/src/hooks/use-book-offline.ts`
- `apps/expo-app/src/hooks/use-highlights-sync.ts`
- `apps/expo-app/src/hooks/use-comments-sync.ts`
- `apps/api/src/trpc/routers/book.routes.ts`
- `packages/db/src/schema/book.schema.prisma`

### Implementation Order From Prior Notes
1. Chapter tree component
2. Prisma book metadata additions
3. Book download/meta endpoints
4. Local SQLite setup
5. Offline state store and hook
6. Download UI
7. Highlight UI
8. Highlight sync
9. Comment sync
10. Bulk highlight/comment endpoints
11. Search endpoint
12. Search screen and route
13. Offline search

### Dev Notes
- `_trpc` and `_qc` are globally accessible via `src/components/static-trpc.tsx`.
- Some book mutations were previously noted as using hardcoded `userId = 1`.
- Shamela imports rely on raw HTML plus AI extraction.
- Arabic RTL content is a core constraint for page rendering.
- Proposed sync conflict strategy: server wins for book content, last-write-wins for user data.
