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
- Completion: 17%
- Current Checklist: 2/6 - Import the page and capture chapters
- Blockers: None

## Implementation Checklist
- [x] Prepare the running emulator development client and verify the current code/deployed API.
- [ ] Import page 106 and separately capture the book-root chapters.
- [ ] Verify chapter hierarchy, search, and incremental scrolling.
- [ ] Verify chapter-tap page resolution and next/previous controls/swipes.
- [ ] Verify recovery and annotation preservation where practical; fix observed defects.
- [ ] Save screenshots, document actual results and limitations, and commit changes.

## Validation Evidence
- d74e74aa deployed Ready (dpl_BbTcfAucSGLrqRBsx2mM18ZzxQxu). Live bookChapter.bookState now HTTP 200 for book 3: pending tree, no import jobs, saved page available. Review refinement moves cache override to packages/db/turbo.json so env/dependency/output inheritance is retained; dry graph verified cache=false, ^build dependency and POSTGRES_URL allowlist. Added a visible test highlight on the reader before chapter retry.
- Ownership fix 9e69f198 pushed and deployed Ready as dpl_3kue5Xq8E4vQjnNjrVv89ajKbMMT. Both review axes found no correctness issues; expanded log assertions pass. View Saved Page opens formatted Arabic reader (printed page 83, source page 106) after a long load.
- Second live defect: bookChapter.bookState returns 500, unknown Book.chapterImports in generated Prisma client. Vercel logs prove @acme/db:build was a Turbo cache hit while node_modules retained an old generated client. Disable caching for the DB build because its generation side effect is outside declared outputs. No database schema change needed. Live redeployment/retry pending.
- Emulator saved page 106 and navigated to book root 23833 (277,669 HTML characters). Separate chapter action failed with "Update the app to manage chapter imports securely." Root cause: active HTTP adapter used an inline context without bookImportOwnerHash, bypassing the implemented helper. Fixed the adapter to use createTRPCContext and redact bearer/cookie/import headers in error logs. HTTP regression plus capture tests: 13 pass. API typecheck has only existing album/blog/query-response errors. Deployment and device retry pending; checklist 2 remains incomplete.
- Production-mode JavaScript served via Expo development client successfully loads the deployed Books library. Expo's dev virtual env module was reading local .env through a generated module; --no-dev inlines the explicit server settings. No app/local environment files were changed to solve this harness issue.
- Preview APK artifact returned 404 (expired); user approved using installed Expo development build instead. Native binary is version 1.0.109, with current JavaScript served through Metro. This is not an OTA or exact Preview-binary acceptance test.
- Initial Metro bundle retained an obsolete local API address. Restarted Metro with explicit preview API settings and cleared transform cache; validation is continuing.
- Running emulator: emulator-5556, Pixel_3a_API_34. The existing com.alghurobaa.podcast is a development build; Preview is not installed. Physical device R5CX153J81W is offline and will not be targeted.
