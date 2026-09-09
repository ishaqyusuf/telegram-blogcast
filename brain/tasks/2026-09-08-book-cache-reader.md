# Task: Local-First Book Screens

## Status
In Progress

## Priority
Medium

## Created Date
2026-09-08

## Last Updated
2026-09-09

## Global Ticket
- Ticket Position: 5/8

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
- [x] Load complete chapter trees locally before background refresh, preserving the chosen tree design.
- [x] Load pages locally and resolve chapter/swipe targets before server or WebView access.
- [x] Expose cached books through an offline-accessible library shelf.
- [x] Finish scoped auxiliary reader queries, local editor content, and reconnect behavior.
- [ ] Verify force-stop/reopen, offline chapter search, cached swipes, and missing-page recovery on Android.

## Validation Evidence
- Native offline chapter tap now passes after cold restart: all 2405 nodes loaded, bottom search 106 produced two matches plus ancestor rows, and selecting the matching chapter opened cached database page 170/source 106 with the retained purple highlight/bookmark. Wi-Fi/data were disabled throughout and restored afterward. Screenshots /tmp/alghurobaa-offline-chapter-106-search.png and /tmp/alghurobaa-offline-chapter-tap-reader.png. Chapter status query/polling now waits for focused, known-online state rather than making unnecessary offline requests.
- 2026-09-09 native online missing-page swipes now verified against the isolated localhost API: source 106 -> 105 -> 104 -> 103 -> 102 -> 101 automatically acquired content via the existing approved concealed WebView, returned to each formatted reader, and persisted guest page rows using database IDs 3 through 7. Newly timestamped local raw captures verify actual acquisition rather than only existing-page resolution. Screenshot /tmp/alghurobaa-cache-adjacent-reader.png shows source 101 / printed 78. The incomplete-tree CTA is expected for the isolated server fixture; the local cached hierarchy remains separate. This supersedes historical pending statements about online missing-page navigation.
- 2026-09-09 Android navigation: with Wi-Fi and mobile data disabled, swiping left moved from source page 106 (printed 83) to cached page 107 (printed 84), and swiping right returned to page 106. Another right swipe to uncached page 105 showed the explicit offline/retry screen without opening a WebView. Screenshots: /tmp/alghurobaa-offline-swipe-next.png and /tmp/alghurobaa-offline-missing-page.png. This boundary replaces the reader route with recovery UI; it does not keep the current reader visible. Both network connections were restored after the check. Online missing-page capture/return acceptance remains pending.
- 2026-09-09: after disabling Wi-Fi/mobile data and force-stopping/restarting the Expo development client, book 3 loaded all 2,405 chapters from local storage. Bottom search for `(` returned 2,379 / 2,405 nodes with ancestor context. Screenshot: /tmp/alghurobaa-chapters-offline-search.png. A development LogBox toast from unrelated offline network requests partially overlays the search area. Search was cleared and both network connections restored afterward. Cached swipes and missing-page recovery remain unverified.
- Latest combined focused run: 40 tests passed, 178 assertions across resource cancellation, page mapping, repository/legacy handling, server page reads, content export eligibility, and chapter snapshots. This is not the final full-story regression run.
- 2026-09-09: adjacent-page lookup now runs with the other independent relation reads, removing the final serial DB round trip and skipping it when no adjacent numbers exist. Host read measured 3,685 ms for page 170, versus earlier 14,139/33,978 ms observations. Native page 106 now renders with Arabic paragraphs and footnotes. Wi-Fi and mobile data were disabled, the app force-stopped/restarted, and page 106 rendered again from persisted storage. Screenshot: /tmp/alghurobaa-page106-offline-reopened.png. Full swipes/missing-page/annotation acceptance is still pending.
- Cancellation now settles immediately even for transports ignoring abort; already-aborted requests do not start transport. Reproduced both failures before fixing; seven resource tests pass. Pending remote pages are rejected before entering the UI/query cache, retaining any readable local copy.
- Native chapter tree loaded all 2,405 nodes expanded by default. Its transaction now explicitly bounds maxWait at 5 seconds and execution at 10 seconds while retaining RepeatableRead. This addresses the observed local transaction-start timeout without removing atomic snapshot validation. Offline tree search/restart verification remains in progress.
- Latest changed-module typecheck review found no production diagnostics; existing project errors and missing Bun test declarations remain. Current diagnostic API session: 7654 (60-second local-only idleTimeout); prior 60429, 43123, and 62890 are terminal. Metro: 50263.
- Combined focused regression run after this change: 35 tests passed, 149 assertions across page reads, reimport versions, download metadata, private annotation protocol/logging, and SQLite/reader serialization. git diff --check passed. Full story review and release are still pending.
- Scoped page-read optimization implemented in book-page-reader.ts: retain all page fields, paragraph styling, footnotes, legacy annotations, volume, book identity, and nested audio metadata while starting independent relation reads concurrently. No global Prisma strategy/schema change. Four focused page-reader/version/download tests passed (27 assertions); the reader test gates all seven relation calls to verify concurrent start and checks response fields/filters.
- First comparable optimized read returned HTTP 200 in 14,139 ms versus the previous 33,978 ms (eight paragraphs, app page 170). This single comparison is not a production performance guarantee. Android retry still exceeded the 20-second client deadline, so reader acceptance remains incomplete. Further query/connection latency investigation is required; do not mark the ticket done from host-only timings.
- Current local diagnostic API session is 60429 (60-second idle timeout); previous 86393 is terminal. Metro remains session 50263. No pending timing requests remain. New production helper modules had no diagnostics in the latest Expo typecheck, which still fails on existing errors/test declarations.
- 2026-09-09 Android/API diagnosis: local API is reachable through emulator host 10.0.2.2:3501; read-only capture-state and page-resolution queries returned bookId=3 and pageId=170 for Shamela 23833/106. Current Metro session 50263 uses EXPO_PUBLIC_LOCAL_NETWORK_HOST=10.0.2.2 and port 8085. Previous sessions 14658/66598 are terminal.
- Saved-page read measured 33,978 ms for eight paragraphs on the local API. Default Bun 10-second idle timeout closed the connection before a response, and the mobile 20-second deadline also prevents acceptance. Temporary diagnostic API session 86393 uses idleTimeout=60 only through a shell command; production code/timeouts are unchanged. Do not count a larger timeout as the performance fix. Review related-record loading before retrying reader/cache acceptance. Prior API session 36070 is terminal.
- Prisma joined relation loading was researched in official documentation, but enabling its preview flag changes the global default strategy. No schema/client-generation change was made for that experiment; scope the optimization and verify response parity before adoption.
- Reader window and document queries now include account scope. Route identity includes account scope, and late chunk responses cannot publish into a different route/account; chunk loading is disabled offline.
- The editor resolves the rich document, HTML, text, and base version from the saved page without a document request. Wrong-page and older query documents are rejected. Reconnect does not reinitialize an active editor; offline Save retains a private draft with an explicit upload-later message.
- Draft loading gates initialization/autosave and offers retry on failure. Page/account transitions close the editor and clear transient selection/text state. Scoped draft storage is tracked in Ticket 6.
- Focused run: 49 tests passed across cache repository/page, reader document/navigation/position. Native editor, reconnect, and account-switch behavior still requires Android acceptance.
- Focused cache format, file recovery, SQLite, local-first resource, page mapping, resolver, and download tests have passed during implementation.
- Existing page-loader regression tests have passed.
- Package typechecking retains pre-existing diagnostics and missing Bun test types; no new production-file diagnostics were observed in the last scoped review.
- Partial Android acceptance is recorded above; full acceptance, final review, commit, deployment, and preview verification remain pending. Earlier diagnostic session and timeout notes are historical observations, not current blockers or final performance results.
