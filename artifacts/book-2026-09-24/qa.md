# Android book feature check — 2026-09-24

## Reader

- Pixel 3a API 34 emulator, package `com.alghurobaa.podcast`.
- Opened book 3 at source page 111. A right swipe inside the Arabic reader requested missing source page 112, imported it, and displayed printed page 89. A later right swipe requested source page 114 and displayed printed page 91. The API also returned fetched pages 113 and 115 after prefetch.
- With Wi-Fi and mobile data disabled, reopened saved page 114 and saw the full Arabic text. Network was restored afterward. See `android-offline-reader.png`.
- The swipe from the outermost left edge triggered Android Back. When a reader was opened from the Books list, an interior swipe advanced from printed page 89 to 90, then the edge Back gesture returned to Books. The earlier Back result went to a reader route created by a test deep link. Normal in-reader page turns use `router.replace`, so they do not add a reader route to Back history.
- Tapping the Books list's continue-reading card after that Back gesture reopened printed page 90. See `android-resume-page-90.png`. A full process-kill/cold restart was not repeated after this final page turn.

## Whole-book source acquisition

- Book 4 reported 734 source pages. Source page 2 timed out twice in a warm app session, while [the source page](https://shamela.ws/book/1679/2) was accessible in a browser. A clean app restart imported page 2. The source WebView now remounts when the requested URL changes; the next capture attempt advanced to page 4 without another restart.
- At page 4, the API reported that it could not reach its Supabase database. A later read request succeeded, but a retry of the page 4 write timed out with a network request failure. Capture remains paused at **3 of 734 pages saved on this device**. The capture UI now shows a service-unavailable message for a recognized database outage instead of the raw Prisma error. This was not an HTTP 429. See `android-database-outage.png` and `android-save-timeout.png`.
- Capture pauses with a visible retry action and persists progress. A confirmed rate limit enters a five-minute cooldown and retries when the app is active and online; this branch is covered by unit tests, not a live 429.
- Full offline availability for book 4 remains incomplete while the server write path is failing.

## Visuals and API

- Detail design: `workshop/index.html` (02 Cover Gallery selected); Android comparison at `android-book-detail.png`.
- Books list: `books-list-workshop/index.html` (02 Reading First selected by the user); Android comparison at `android-books-list-reading-first.png`.
- Recent-play API check returned 49 rows with 49 distinct media IDs.
- Cover import validation and Blob upload behavior passed mock tests. No user-supplied image URL was imported into live Blob storage.

## Automated checks

- 50 focused tests passed across cover import, source capture, reader navigation, page loader, reading position, and offline state.
- Biome passed for six new source/test files, and `git diff --check` passed.
- Whole-repo TypeScript checking is still blocked by unrelated existing errors in `album.routes.ts`, `blog.routes.ts`, and `utils/query-response.ts`.
