# Database Relationships

## Purpose
Captures the important cross-domain relationships in the data model at a high level.

## How To Use
- Update when model ownership or cardinality changes in a way that affects features or APIs.
- Keep this high level unless a complex domain needs its own deep-dive doc.
- Link ADRs when relationship design was driven by a formal decision.

## Template

### Observed Relationship Areas
- Users/auth connect to personalized interactions and saved state.
- Channels, blogs, audio, books, and media appear to form the core content graph.
- Transcript and social/interaction schema modules suggest secondary relationships layered on content.
- Books connect back to audio through two explicit joins:
  - `AlbumBookReference` links an album/series to one or more source books.
  - `MediaBookPageReference` links a specific audio item or timestamp range to a book page.
- Imported books are canonical read-only content; user annotations, comments, and audio references live in separate models so they can change without editing source text.

### Detailed Mapping TODO
- Call out many-to-many joins that matter for feature work.
- Note cascade/delete or sync-sensitive relationships.

### Immediate Follow-Up
- When doing database work, inspect the Prisma models directly and extend this file with concrete relationship notes.
