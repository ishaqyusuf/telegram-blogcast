# Book Reader Loading Investigation

Status: Open follow-up. Not fixed by the compact-tree/swipe release.

## Evidence
- Android emulator development client1.0.109 with production-mode current JS and deployed Vercel API sometimes shows a long initial reader spinner, approximately1-3minutes, including after importing109. Requests eventually render; no new JavaScript error was captured.
- Other reader openings in the same session were much faster. No controlled timing profile of emulator requests/rendering has been collected.
- Host measurements: getPage170 headers approximately2.7s; getReaderWindow170 headers approximately2.6s,254417characters; combined batch through body completion200 in3.6s,382257characters. These do not prove emulator transport or rendering timing.
- Mobile httpBatchLink waits for companion queries; getReaderWindow includes neighboring page relations and scalar content. This is a candidate, not an established cause. Production-wide background work/network and native rendering also need measurement.

## Next Investigation
1. Record privacy-safe per-request start, headers, body decode and React/native first-content timestamps on device. Do not log tokens, HTML or annotation text.
2. Compare critical getPage alone vs its actual mobile batch and fresh vs warm reader mounts.
3. Apply the smallest demonstrated fix. If separating the reader window query, allow the single-page fallback to scroll immediately and preserve relative position when the window arrives.
4. Retest repeated108/109 navigation, text selection, highlights and chapter opening. Use a real Preview binary for separate OTA acceptance when available.

## Scope
No performance fix is claimed. Feature QA and release evidence are in ../tasks/2026-09-08-book-android-emulator-acceptance.md. No database schema change is currently indicated.
