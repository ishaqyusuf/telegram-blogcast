# Task: Book Android Emulator Acceptance

## Status
In Progress

## Priority
High

## Created Date
2026-09-08

## Last Updated
2026-09-08

## Global Ticket
- Ticket Position: 1/1

## Source Context
User requested Android emulator testing after the durable mobile book release, then explicitly chose the installed Expo development build. Use current committed JavaScript and `/book/23833/106` against the deployed backend; do not touch the physical phone or substitute web implementation. Prior release: [Durable import](./2026-09-08-durable-mobile-book-import.md).

## Implementation Progress
- Completion: 38%
- Current Checklist: 4/8 - Verify chapter and adjacent-page navigation
- Blockers: None

## Implementation Checklist
- [x] Prepare the running emulator development client and verify the current code/deployed API.
- [x] Import page 106 and separately capture the book-root chapters.
- [x] Verify chapter hierarchy, search, and incremental scrolling.
- [ ] Verify chapter-tap page resolution and next/previous controls/swipes.
- [ ] Verify recovery and annotation preservation where practical; fix observed defects.
- [ ] Add reader overflow menu and page-sorted Highlights/Bookmarks screens with two-line previews and page navigation.
- [ ] Verify selected highlight colors survive page close/reopen, and test both saved-item lists on the emulator.
- [ ] Save screenshots, document actual results and limitations, and commit changes.

## Validation Evidence
- Emulator opens nested children (Introduction: 13 subchapters), scrolling loads 40 to 80 root entries, and searching source page 106 finds two distinct chapter nodes marked Saved. Screenshots retained in /tmp. Saved-item implementation uses FloatingBottomSheet, FlatList two-line previews, local persisted page summaries and bounded server summaries; local-first highlight load and SQL conflict guard prevent server pull undoing pending offline deletion. Four new helper/API/SQLite tests pass. Mobile typecheck has existing errors plus Bun test type declarations, no changed production-file errors.
- Emulator chapter retry succeeded after 326d0a29 deployment. Import 49e74cc2-dcbc-4c3f-9960-cff29d70b0cc completed in approximately 11 seconds with 2,405 nodes, generation 1; book 3 tocStatus=complete. Automatically returned to saved page ID 170 (source 106, printed 83), formatting and purple highlight intact. New user scope adds saved-item menu/screens and explicit non-default color close/reopen testing (8 checklist items total).
- Retry reached capture transaction but Prisma rejected pg_advisory_xact_lock's void result. Cast unused result to text without changing lock semantics. Added actual API caller/PostgreSQL regression (local-only, completed fixture avoids Trigger dispatch): passes. All six local PostgreSQL tests pass, including 2,405-node import, annotation preservation, cancellation rollback and retry identity; 26 focused unit/HTTP tests also pass. Emulator retry after this fix still pending.
- d74e74aa deployed Ready (dpl_BbTcfAucSGLrqRBsx2mM18ZzxQxu). Live bookChapter.bookState now HTTP 200 for book 3: pending tree, no import jobs, saved page available. Review refinement moves cache override to packages/db/turbo.json so env/dependency/output inheritance is retained; dry graph verified cache=false, ^build dependency and POSTGRES_URL allowlist. Added a visible test highlight on the reader before chapter retry.
- Ownership fix 9e69f198 pushed and deployed Ready as dpl_3kue5Xq8E4vQjnNjrVv89ajKbMMT. Both review axes found no correctness issues; expanded log assertions pass. View Saved Page opens formatted Arabic reader (printed page 83, source page 106) after a long load.
- Second live defect: bookChapter.bookState returns 500, unknown Book.chapterImports in generated Prisma client. Vercel logs prove @acme/db:build was a Turbo cache hit while node_modules retained an old generated client. Disable caching for the DB build because its generation side effect is outside declared outputs. No database schema change needed. Live redeployment/retry pending.
- Emulator saved page 106 and navigated to book root 23833 (277,669 HTML characters). Separate chapter action failed with "Update the app to manage chapter imports securely." Root cause: active HTTP adapter used an inline context without bookImportOwnerHash, bypassing the implemented helper. Fixed the adapter to use createTRPCContext and redact bearer/cookie/import headers in error logs. HTTP regression plus capture tests: 13 pass. API typecheck has only existing album/blog/query-response errors. Deployment and device retry pending; checklist 2 remains incomplete.
- Production-mode JavaScript served via Expo development client successfully loads the deployed Books library. Expo's dev virtual env module was reading local .env through a generated module; --no-dev inlines the explicit server settings. No app/local environment files were changed to solve this harness issue.
- Preview APK artifact returned 404 (expired); user approved using installed Expo development build instead. Native binary is version 1.0.109, with current JavaScript served through Metro. This is not an OTA or exact Preview-binary acceptance test.
- Initial Metro bundle retained an obsolete local API address. Restarted Metro with explicit preview API settings and cleared transform cache; validation is continuing.
- Running emulator: emulator-5556, Pixel_3a_API_34. The existing com.alghurobaa.podcast is a development build; Preview is not installed. Physical device R5CX153J81W is offline and will not be targeted.
