# Book reader and offline library tickets — 2026-09-24

This ticket set tracks the work requested in this thread. The existing `app.config.ts` edit predates these tickets.

## B01 — Android reader acceptance

- Open an installed Android development build, load a book with an uncaptured next page, swipe in the book's reading direction, and record the loading, capture, and resulting page states.
- Verify that a second open resumes at the last page and that the same page opens without a network connection once cached.
- Keep screenshots and any blocked conditions with this artifact.

## B02 — Reader acquisition and progress

- Keep an uncaptured adjacent page in the reader flow with a clear loading state and retry or verification control.
- Save the page on the server, persist it locally, and transition to the formatted reader without another user action.
- Prioritize a page requested by a swipe over background work.

## B03 — Offline cache and resume

- Read cached pages first, check the server for updates when online, and retain usable cached content if refresh fails.
- Resume from the last actually viewed page, including a page reached inside a continuous reader window.
- Offer whole-book download and an accurate count of server-available versus source-missing pages.

## B04 — Three book screen designs

- Compare three full-screen detail layouts using the same book content and real controls in a Workspace artifact.
- Recommend one, implement it in React Native, and compare the emulator result with the design.

## B05 — Book cover from a link

- Accept an HTTPS image URL, copy the image into Vercel Blob, and save the Blob URL as the cover.
- Validate the source, type, and size; protect the fetch from private-network access and redirects to private hosts.
- Make the cover prominent on the book screen, report invalid links, and refresh book lists after success.

## B06 — Complete source-page acquisition

- Walk missing Shamela pages in order through the existing capture transport, then sync captured pages into local storage.
- Checkpoint progress, pause on app background, loss of network, verification challenge, error, or apparent rate limit, and allow an explicit resume.
- Show captured, remaining, and failed counts; avoid silently claiming full offline coverage when the server has only partial pages.

## B07 — Final verification

- Run focused tests and type/lint checks, repeat Android reader and offline checks, and record exact results and limitations.

## B08 — Recent play list

- Keep card titles to one truncated line.
- Return one most recent entry per media ID in the recent play list.

## B09 — Main Books list workshop

- Compare three interactive Books list layouts, recommend one, and apply the user's selected direction, 02 Reading First.

## B10 — Commit, push, and mobile release

- Commit and push the feature code and review artifacts.
- Verify server deployment and publish an Android update to a compatible installed build; record channel, runtime, and commit.

## Status at handoff

| Ticket | Status | Evidence or remaining work |
| --- | --- | --- |
| B01 | Verified | Android interior swipe fetched source pages 112 and 114 and opened them in the reader. Offline reopen of saved page 114 worked. From the Books list, a page turn advanced printed page 89 to 90, Android Back returned to Books, and continue reading reopened page 90. |
| B02 | Implemented and verified | Reader capture/transition works; local saved content now wins over a pending server stub. |
| B03 | Implemented and verified for saved pages | Local-first reading, offline reopen, and last-page return worked. Whole-book coverage awaits B06. |
| B04 | Implemented | Three detail concepts at `workshop/index.html`; selected 02 Cover Gallery is on Android. |
| B05 | Implemented; live import unverified | HTTPS image import, validation, private-network protection, Blob upload, owner check, and prominent cover UI are present. Mock-upload tests pass. A real cover URL and Blob credential were not exercised in this run. |
| B06 | Paused by server write failure | Book 4 progressed to 3 of 734 pages saved locally. Page 2 imported after a fresh app restart; the source WebView now resets between URL changes. Page 4 failed on a database connection error, then on a save timeout/network request failure. The app paused and saved its checkpoint. Cooldown handling is implemented for a real source rate-limit response; no 429 was observed. |
| B07 | Complete for focused checks | 50 focused tests pass; Biome on new files and `git diff --check` pass. Existing unrelated TypeScript errors prevent a clean whole-repo typecheck. |
| B08 | Implemented and verified | Live recent-play API returned 49 records with 49 unique media IDs; card titles are one line. |
| B09 | Implemented | Three list concepts at `books-list-workshop/index.html`; user selected 02 Reading First, now visible in the Android Books list. |
| B10 | Preview released and installed | Feature commit `7422e146` pushed to `main`; Vercel deployed it. Android EAS Update group `0da4f727-229f-491c-98ac-41dbd46e0c60` published to preview runtime `1.0.111`. Fresh preview APK build `1feaf280-e587-4011-9fc4-529df7256857` installed on the emulator; the Books list showed 6 books and a reader page loaded. Production has no listed Android EAS build. See `release.md`. |
