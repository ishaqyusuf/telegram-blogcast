# Task: Resumable Downloads And Storage Controls

## Status
In Progress

## Priority
Medium

## Created Date
2026-09-08

## Last Updated
2026-09-09

## Global Ticket
- Ticket Position: 7/8

## Source Context
[Mobile Book Local Cache plan](../plans/2026-09-08-feature-mobile-book-local-cache.md). User requests Android/media/com.alghurobaa.podcast/Books/book-{databaseBookId}/, mobile implementation, and progress tracking.

## Plan Status
In Progress

## Plan File
[Plan](../plans/2026-09-08-feature-mobile-book-local-cache.md)

## Implementation Progress
- Completion: 80%
- Current Checklist: 5/5
- Blockers: No implementation blocker; Android and release evidence still pending.

## Implementation Checklist
- [x] Implement bounded server page discovery and persisted download checkpoints.
- [x] Expose download, pause, resume, and restart controls with focused cancellation/retry tests.
- [x] Implement safe cache removal and protected-page accounting without erasing user data.
- [x] Implement foreground resume and folder recovery controls.
- [ ] Verify download progress, low storage, and storage removal on Android.

## Validation Evidence
- Native download feedback/retry test passed using a one-shot repository rejection with database or disk is full. UI showed the exact failure and Resume Download, cursor/completed stayed zero, and the original method restored itself. Retry committed seven available fixture pages, then correctly reported that the server's incomplete chapter tree must be captured. It did not claim snapshot completion. Screenshot /tmp/alghurobaa-download-storage-error.png. This is native UI fault injection plus separately proven real SQLite capacity rollback, not physical device-volume exhaustion.
- Follow-up low-storage review fixed masked transaction errors: preserve the original work failure when native rollback also fails, while retaining commit failures. Deterministic regression reproduced the masking before the fix. Native capacity preservation/retry was verified before this error-reporting change; native UI low-storage feedback and physical volume exhaustion remain distinct unverified cases.
- Native low-capacity repository check passed in a separate Expo SQLite fixture: max_page_count=32 caused a 65536-character replacement to fail without replacing the original page; quota 256 allowed retry. Fixture database was closed/deleted. This verifies native persistence recovery, not low-storage feedback through the complete download UI or actual device-volume exhaustion; that distinction remains open.
- 2026-09-09 native cleanup/recovery acceptance: automatic cleanup reported 0 removed / 8 retained for the pinned downloaded book. Explicit book-3 cleanup reported 6 removed / 2 protected retained; exported files and the chapter tree remained. Find Books followed by Restore Missing Pages reported 6 restored / 2 already saved / 0 failed. Screenshot: /tmp/alghurobaa-six-pages-restored.png. Bookmark records are separate from content protection: bookmark-only pages are replaceable, while annotations/drafts protect page content. Low-storage acceptance is still outstanding.
- 2026-09-09 Android download acceptance: started book 3 from its detail screen. Pause was available alongside Starting download. The pause settled with 8/8 server-available pages retained and chapters pending; Resume completed with Chapters saved, 8/8, Snapshot complete. This is the server-available snapshot, not the entire Shamela book. Screenshot: /tmp/alghurobaa-download-snapshot-complete.png.
- Actual public folder now contains page-3.json, page-4.json and page-170.json through page-175.json (eight distinct application-ID files; page-170.json.previous is recovery history). Native low-storage and removal acceptance remain pending. API session 7654 was polled and remains live; it still predates the DB logger change and needs restart before logger runtime verification.
- 2026-09-09 review: reproduced two late-cancellation failures where pausing during chapter capture or final manifest validation incorrectly reported complete. Added abort boundaries before manifest validation and before completion. Completed local checkpoints remain retained; user pause reason is persisted. The service also rechecks cancellation/profile/background state after initial manifest and chapter responses before saving.
- Pause is now available while the requested book is starting, with a separate startup progress label. Other books remain disabled during the active job; Restart also respects maintenance. Native startup-pause acceptance remains pending.
- Focused download/maintenance suite: 9 tests passed, 38 assertions. Scoped ESLint and git diff --check passed. The native low-storage/full-download acceptance checklist remains open.
- Real SQLite tests cover pinned pages, notes, drafts, pending deletions, cross-account isolation, and insert-only restoration. Foreground recovery distinguishes explicit user pauses from interruptions; Android checks remain pending.
- Focused cache format, file recovery, SQLite, local-first resource, page mapping, resolver, and download tests have passed during implementation.
- Existing page-loader regression tests have passed.
- Package typechecking retains pre-existing diagnostics and missing Bun test types; no new production-file diagnostics were observed in the last scoped review.
- No Android acceptance, final review, commit, deployment, or preview verification is claimed for this feature yet.
