# Database Schema

## Purpose
Summarizes where the database schema lives and which major data domains exist.

## How To Use
- Update when schema files or major domain models change.
- Keep detailed field-by-field notes in domain docs or generated schema references if needed.
- Use this as the orientation layer before editing Prisma files.

## Template

### Source Of Truth
- Prisma schema modules live in `packages/db/src/schema`.
- The root schema entrypoint is `packages/db/src/schema/schema.prisma`.

### Current Domain Modules
- `audio.schema.prisma`
- `album-auto-index.schema.prisma`
- `blogs.schema.prisma`
- `book.schema.prisma`
- `channels.schema.prisma`
- `interaction.schema.prisma`
- `locations.schema.prisma`
- `media.schema.prisma`
- `social.schema.prisma`
- `transcript.schema.prisma`
- `user.schema.prisma`

### Working Notes
- Books, blogs, channels, media, transcripts, and interactions are first-class modeled domains.
- Physical home-library cataloging is modeled separately from digital books with `LibraryItem`, `LibraryVolume`, `LibraryLocation`, and `LibraryLabel`.
- `File` records are source-aware. Existing imported Telegram media uses `source = "telegram"` and Telegram file IDs; new compose uploads use `source = "vercel_blob"` with Blob URL, download URL, pathname, content type, ETag, and metadata fields.
- `Blog.telegramMessageId` stores the Telegram source message ID alongside existing JSON meta. The nullable unique `(channelId, telegramMessageId)` pair prevents duplicate Telegram imports while allowing non-Telegram/manual posts.
- Update `brain/database/relationships.md` when cross-model ownership changes.
- Books schema now also owns import/audit records:
  - `BookImportHistory` for book-level imports from source links
  - `BookPageImportHistory` for page-level URL/manual imports and re-import summaries
- Book annotation records now carry stable remap anchors (`pageShamelaPageNo`, `paragraphPid`, `quoteText`) so highlights/comments can survive page content refreshes.
- Book source/editability metadata distinguishes user-created editable books from imported read-only Shamela books.
- Offline/local book metadata includes Shamela source URL fields so downloaded books can preserve their refresh/redownload source.
- Cross-domain book/audio references are modeled with `AlbumBookReference` and `MediaBookPageReference`.
- Physical catalog entries use nullable `LibraryItem.bookId` to link an owned printed item/set to an existing digital `Book`; physical ownership metadata remains outside `Book`.
- Automatic album index generation is modeled in `album-auto-index.schema.prisma` with `AlbumAutoIndexRun`, `AlbumAutoIndexAlbumSuggestion`, and `AlbumAutoIndexMediaSuggestion`. Runs store channel/provider/model/status, bounded input JSON, raw AI response JSON, parsed JSON, counts, and failure errors; child rows store normalized existing-album or proposed-album suggestions plus snapshots for review. Proposed album suggestion rows keep `albumId` null until approval creates the album.
- `TranscriptionJob` owns DB-backed queue state for local Whisper work, including progress percentage, stage, worker ID, lock time, heartbeat, optional chunk counters, retry count, and error message.
