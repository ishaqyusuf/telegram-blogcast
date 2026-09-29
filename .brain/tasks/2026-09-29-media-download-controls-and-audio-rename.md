# Task: Media Download Controls and Audio Rename

- Status: In Progress
- Created: 2026-09-29
- Updated: 2026-09-29
- Plan: [Media Download Controls and Audio Rename](../plans/2026-09-29-feature-media-download-controls-and-audio-rename.md)
- Scope: Explicit download-only controls for audio, PDF, and video; a separate searchable audio title override with rename UI; direct full-transcription and copy-full-transcript actions on the audio screen.
- Implementation: Audio/PDF/video download controls, audio title override and search, and direct full-transcription/copy controls implemented. Prisma client generated. The additive column was pushed to production and verified against the default database target; `db:migrate` could not proceed because Prisma requested a reset for existing drift. Automated tests and UI acceptance remain to finish.
