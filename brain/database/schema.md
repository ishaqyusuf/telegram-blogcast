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
- Update `brain/database/relationships.md` when cross-model ownership changes.
