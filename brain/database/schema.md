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
- `File` records are source-aware. Existing imported Telegram media uses `source = "telegram"` and Telegram file IDs; new compose uploads use `source = "vercel_blob"` with Blob URL, download URL, pathname, content type, ETag, and metadata fields.
- Update `brain/database/relationships.md` when cross-model ownership changes.
- Books schema now also owns import/audit records:
  - `BookImportHistory` for book-level imports from source links
  - `BookPageImportHistory` for page-level URL/manual imports and re-import summaries
- Book annotation records now carry stable remap anchors (`pageShamelaPageNo`, `paragraphPid`, `quoteText`) so highlights/comments can survive page content refreshes.
