# Task: Recoverable Book Folder Synchronization

## Status
In Progress

## Priority
Medium

## Created Date
2026-09-08

## Last Updated
2026-09-09

## Global Ticket
- Ticket Position: 4/8

## Source Context
[Mobile Book Local Cache plan](../plans/2026-09-08-feature-mobile-book-local-cache.md). User requests Android/media/com.alghurobaa.podcast/Books/book-{databaseBookId}/, mobile implementation, and progress tracking.

## Plan Status
In Progress

## Plan File
[Plan](../plans/2026-09-08-feature-mobile-book-local-cache.md)

## Implementation Progress
- Completion: 75%
- Current Checklist: 4/4
- Blockers: Literal grant-revocation and physical full-volume acceptance require a controlled test environment; existing native denial/capacity tests do not claim those cases.

## Implementation Checklist
- [x] Implement verified staging and previous-copy recovery for SAF files.
- [x] Implement durable retry jobs with generation-safe acknowledgement and cancellation tests.
- [x] Finish automatic foreground synchronization and user-triggered folder restore.
- [ ] Verify permission revocation, partial files, disk exhaustion, and folder switching on Android.

## Validation Evidence
- Post-release platform check: emulator-5556 exposes uri_grants but cmd uri_grants help reports No shell command implementation. Activity-manager help exposes no single-grant revoke command, and the installed Expo legacy SAF API exposes acquisition but not releasePersistableUriPermission. Device storage monitor supports force-low/force-not-low/reset only, which simulates warning broadcasts rather than actual write exhaustion. No grants, app data, or storage state were modified during this inspection. Do not substitute those commands for actual revocation/ENOSPC acceptance or clear app data to manufacture a pass.
- Native missing-grant test temporarily selected an ungranted Download/alghurobaa-cache-check/Books URI through test configuration. Real SAF sync failed all three eligible jobs with readSAFDirectoryAsync: location isn't readable; the cached page remained readable. Restored the original preferred folder configuration. Live Android storage UI subsequently confirms the original path and 0 pending files / 0 need retry. This exercises actual permission denial/recovery, not literal persisted-grant revocation. No original exports were deleted.
- Separate native Expo SQLite quota test preserved the original page after SQLITE_FULL and successfully retried after increasing the quota; fixture database was closed/deleted. This does not establish physical SAF-volume exhaustion, which remains an explicit acceptance limitation.
- Android destination-switch acceptance passed: selected the separate Android/media/com.alghurobaa.podcast/Books/Books folder via SAF. Previously acknowledged eligible content was republished: pages 170 and 172, chapters.json, and manifest.json, with zero pending/retry jobs. Six restored-but-unverified pages remained excluded from export, as intended. Screenshot /tmp/alghurobaa-folder-switch-verified.png. Selected the original preferred parent Books folder again through the picker afterward; no original exports were deleted. Empty Download/alghurobaa-cache-check/Books and the nested test export remain emulator-only test artifacts. Permission revocation and disk-exhaustion acceptance remain open.
- 2026-09-09 Android reimport exposed a real SAF short-write defect: canonical page-170.json retained 32 trailing characters from its previous content (9275 versus 9243 bytes), while staging was valid. Expo's installed legacy adapter opens the default content-provider output stream without explicit truncation. Reproduced with a non-truncating file adapter regression, then changed recoverable publication to remove/recreate each destination before writing, preserving the existing backup/staging ordering. Added interruption-after-canonical-removal coverage. Native Sync / Retry Files repairs the export byte-for-byte against staging, removes .pending, and reports 0 pending / 0 need retry. SQLite content and annotations were never lost. File/repository/download tests: 38 passed, 139 assertions; scoped lint passes. Permission revocation, disk exhaustion and destination switching are still separate pending checks.
- Canonical read failures now fall back to a validated .previous copy, not just JSON-validation failures. If both copies cannot be read, restore reports the read error rather than treating them as missing. Added a failing-before/passing-after recovery regression and a no-silent-permission-failure check. File/repository tests: 29 passed, 109 assertions; scoped lint and whitespace checks passed. Native permission-revocation/oversized-file cases remain unverified.
- 2026-09-09 restore review fix: restored pages/chapters now check the existing scoped cache/library/tree source identity transactionally before insertion. A self-consistent but wrong-source folder can no longer mix pages from another Shamela book under an already-known app book ID. Two failing regressions were reproduced then passed; combined cache/annotation run has 33 passing tests and 132 assertions. Existing valid restore, previous-file recovery, annotation protection, and profile isolation tests remain green. Native wrong-folder verification remains pending.
- 2026-09-09 Android missing-page restore was exercised after explicit cache cleanup: six removed pages were restored from the existing Books folder, two protected pages were skipped, and zero failures were reported. This now verifies actual native restoration, not only the earlier existing-page no-op. Screenshot: /tmp/alghurobaa-six-pages-restored.png. Folder switching, permission revocation and disk exhaustion remain unverified.
- 2026-09-09 follow-up race review: download and mirror services now acquire synchronous worker leases before their first async operation and release in finally. Maintenance acquisition refuses while either worker is active, independent of React render timing. Downloads and mirrors may still overlap each other. Added coverage for two workers, double release, maintenance exclusion and restart after release. 26 focused tests passed, 110 assertions; scoped ESLint and git diff --check passed.
- 2026-09-09 lifecycle review: maintenance now acquires an exclusive, idempotently released lock. Unmount aborts the operation but does not release that lock until the promise settles; stale releases cannot unlock later work. Cleanup checks cancellation after repository acquisition. Folder identity keys the maintenance UI so old discovered-book actions do not survive a destination switch. Storage controls observe the global lock, including after remount. This is a focused lifecycle fix, not a claim that every download/sync acquisition race has been reviewed.
- Focused validation after the lifecycle fix: 20 tests passed, 85 assertions across maintenance state and cache repository. Scoped ESLint and git diff --check passed. Expo typecheck remains exit 2 on project diagnostics/missing Bun test types; no changed production-file diagnostics. Session 75110 is terminal.
- Android dev-client check: storage screen rendered the preferred folder, 2 local pages and 1 tree, with 0 pending/failed mirror jobs. Find Books discovered book-3; Restore Missing Pages returned `0 restored / 1 already saved / 0 failed`, preserving existing content. Screenshot: /tmp/alghurobaa-restore-existing-page-skipped.png. Empty-cache restore, folder switching and native failure injection remain pending.
- Focused ESLint for the restore implementation and repository test passed; git diff --check passed. Expo typecheck still exits 2 on project diagnostics, including missing bun:test/bun:sqlite declarations in this test file; no book-cache-restore.ts diagnostic was reported. Terminal check sessions 22247 and 25540 are complete.
- 2026-09-09 review: reproduced a pause-during-chapter-read race with a failing SQLite regression. Restore now checks cancellation after the asynchronous file read before saving the tree. All 19 repository tests pass (78 assertions). Native folder failure cases remain pending.
- Android verification: book-3/manifest.json, pages/page-170.json, and chapters.json were written under Android/media/com.alghurobaa.podcast/Books. The page file was read back: app bookId=3/pageId=170, sourcePageNo=106, eight paragraphs and one footnote; only the content-format keys are present, with no highlights/comments/drafts/owner identifier. This proves successful native page/tree export, not permission-revocation or disk-exhaustion acceptance.
- Fixed export eligibility: imported Shamela books often have the shared legacy owner ID 1, so ownerUserId=null excluded genuine public content. Server policy now explicitly requires published, read-only Shamela content with a positive source ID. Pages expose a server eligibility flag and trees use the same policy; mobile refuses unverified/legacy/restored copies and old responses lacking the flag. Policy and mobile serialization tests cover public legacy ownership, private/unpublished/user content, and missing verification.
- Folder changes now transactionally requeue acknowledged public exports using durable eligibility and a per-account destination marker. Private and unverified restored content is excluded; cleanup removes eligibility alongside evicted pages.
- Regression run: 22 tests passed across book-cache-repository.test.ts and book-cache-files.test.ts, including reopen, account isolation, eligibility revocation, migration, and destination-marker rollback. Android folder-switch verification remains pending.
- Pre-eligibility cache records without pending export jobs are deliberately not inferred public; they need a verified server refresh before automatic export eligibility is established.
- Recovery tests cover damaged canonical files with valid previous copies, missing-page-only restore, manifest/source identity, ignored pending files, and no file-sync jobs for unverified restored data. Public restore copies are read-only until online refresh.
- Focused cache format, file recovery, SQLite, local-first resource, page mapping, resolver, and download tests have passed during implementation.
- Existing page-loader regression tests have passed.
- Package typechecking retains pre-existing diagnostics and missing Bun test types; no new production-file diagnostics were observed in the last scoped review.
- No Android acceptance, final review, commit, deployment, or preview verification is claimed for this feature yet.
