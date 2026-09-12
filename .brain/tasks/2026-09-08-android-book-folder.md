# Task: Android Book Folder Access

## Status
In Progress

## Priority
Medium

## Created Date
2026-09-08

## Last Updated
2026-09-09

## Global Ticket
- Ticket Position: 1/8

## Source Context
[Mobile Book Local Cache plan](../plans/2026-09-08-feature-mobile-book-local-cache.md). User requests Android/media/com.alghurobaa.podcast/Books/book-{databaseBookId}/, mobile implementation, and progress tracking.

## Plan Status
In Progress

## Plan File
[Plan](../plans/2026-09-08-feature-mobile-book-local-cache.md)

## Implementation Progress
- Completion: 75%
- Current Checklist: 4/4
- Blockers: No implementation blocker; Android and release evidence still pending.

## Implementation Checklist
- [x] Implement Android SAF selection and persist the chosen Books folder.
- [x] Expose folder selection, retry, and disconnect controls without deleting files.
- [x] Verify the preferred path and permission persistence on Android.
- [ ] Verify production, preview, and development application-ID behavior.

## Folder Acceptance Details
- Prefer Android/media/com.alghurobaa.podcast/Books/book-{databaseBookId}/ with pages/page-{databasePageId}.json.
- Show the actual granted folder and verify access survives app restart.
- Permission denial or revocation must leave private SQLite reading and saving functional.
- If the preferred folder is unavailable, explain why and offer an explicit alternative Books-folder selection; never silently redirect exports.
- Verify grants independently for installed development, preview, and production variants.
- Changing the selected folder must republish eligible existing content, not only future page changes; coordinate with Ticket 4.

## Validation Evidence
- After restart, native directory listing succeeded and the updated empty-folder message appeared: No book folders found. Download a book and sync its files first. Screenshot: /tmp/alghurobaa-books-folder-verified.png. This verifies persisted read access, not book mirror/export acceptance.
- Android emulator-5556, installed Expo development client with package com.alghurobaa.podcast: current code bundled through Metro 8085 and Book Storage rendered. Created Android/media/com.alghurobaa.podcast/Books through the system picker. SAF read/write probe succeeded and the screen displayed Change Folder and Sync / Retry Files for the exact path. Force-stopped and reopened the app; selected path and controls persisted. Folder search ran after restart; added explicit empty-folder feedback rather than leaving the user without a result.
- Initial permission attempt was interrupted by the dev launcher trying an old localhost connection. Reconnected explicitly to Metro 8085 and repeated the grant successfully. This is development evidence only; no preview/production-variant acceptance is claimed.
- Metro process session 14658 remains available. Current test API URL points to an unreachable local host on port 3501; configure a reachable API before page/import acceptance. No production annotation smoke-test writes were attempted.
- Focused cache format, file recovery, SQLite, local-first resource, page mapping, resolver, and download tests have passed during implementation.
- Existing page-loader regression tests have passed.
- Package typechecking retains pre-existing diagnostics and missing Bun test types; no new production-file diagnostics were observed in the last scoped review.
- No Android acceptance, final review, commit, deployment, or preview verification is claimed for this feature yet.
