# Spec: Audio Transcript Streaming, Karaoke Sync, And Local Service IP Settings

## Status
Done

## Completed Date
2026-07-10

## Created Date
2026-07-10

## Triage Label
ready-for-agent

## Source
Direct user request: audio screen read mode and karaoke are still buggy; persisted transcripts should load seamlessly in chunks; production startup local-service failures should not show disruptive errors; Settings should allow saving and reusing a manual IP for Telegram updates, Facebook import, and transcription services.

## Problem Statement

When the user opens an audio screen with a saved transcript, the screen can freeze before the transcript or read mode appears. The app appears to load, transform, and render the whole transcript at once, which is too heavy for long audios. Tapping the book/read button can freeze before the reader opens, and the reader can continue to feel slow while the full transcript is mounted.

Karaoke mode is also unreliable during playback. The active transcript line or word can hang, stop moving, or drift away from the audio position. The user expects the transcript to move with the audio smoothly and consistently.

In production builds, the app also tries to contact local services on startup for Telegram/channel updates. If the local server is off, the IP changed, or the automatically detected IP is wrong, the app can show an error on the screen. The user does not want startup failures for optional local services to interrupt the app. They also need a Settings workflow where they can manually enter the actual service IP and reuse it for transcription, Telegram updates, and Facebook import, with saved IP history.

## Solution

The audio screen should treat transcripts as windowed data, not one giant document. When a saved transcript exists, the initial audio screen and read mode should load only a small time window around the current playback minute, then fetch or reveal nearby windows as playback advances or the user scrolls. Long transcripts must be rendered with virtualization so opening audio, tapping read mode, and scrolling remain responsive.

Karaoke mode should be rebuilt around one shared transcript playback synchronization model. The active segment and active word should be derived from the current playback clock using stable timestamp lookups. Auto-scroll should move only when the active segment changes, should pause when the user scrolls manually, and should resume cleanly when requested.

Settings should expose a shared Local Services IP configuration. The saved IP should be used to build the service URLs for Telegram/channel updates, transcription, and Facebook media import using their correct ports. The app should remember IP history, allow quick selection from previous IPs, and keep automatically detected IPs as candidates without forcing them over a manual saved IP. Startup local-service checks should fail gracefully: cache the last known state, back off after failures, and avoid showing blocking errors on app launch.

## User Stories

1. As a listener, I want an audio screen with a saved transcript to open quickly, so that I can start listening without waiting for the entire transcript to load.
2. As a listener, I want the transcript area to show the current minute first, so that I immediately see the part that matches the audio position.
3. As a listener, I want the app to avoid loading every transcript segment on first render, so that long lectures do not freeze the screen.
4. As a listener, I want transcript chunks to appear as I scroll, so that I can move through the transcript without a heavy first load.
5. As a listener, I want read mode to open quickly after I tap the book button, so that the reader feels instant instead of frozen.
6. As a listener, I want read mode to land near the current audio time, so that I do not have to search manually for the current passage.
7. As a listener, I want read mode to load previous and next transcript chunks while I scroll, so that reading still feels continuous.
8. As a listener, I want the app to use already saved transcript data when it exists, so that it does not unnecessarily call the local transcriber again.
9. As a listener, I want the current transcript line to highlight while audio plays, so that I can follow the speech.
10. As a listener, I want word-level highlighting to move smoothly when word timestamps exist, so that karaoke mode feels connected to the recitation or lecture.
11. As a listener, I want karaoke mode to keep following playback after seeking, so that the transcript catches up immediately to the new time.
12. As a listener, I want karaoke mode to keep following playback after pause and resume, so that it does not get stuck on an old line.
13. As a listener, I want karaoke mode to keep following playback after background/foreground transitions, so that returning to the app shows the correct transcript position.
14. As a listener, I want manual scrolling to pause auto-follow, so that the app does not fight me while I inspect another part of the transcript.
15. As a listener, I want a clear way to return to live transcript following, so that I can jump back to the playing position.
16. As a listener, I want tapping a transcript segment to seek to that timestamp, so that I can replay a passage easily.
17. As a listener, I want double-tapping a transcript segment to seek and play, so that I can quickly restart from that passage.
18. As a listener, I want long-press transcript selection/comment behavior to keep working in the virtualized transcript, so that the performance fix does not remove existing workflow.
19. As a listener, I want empty, partial, processing, and completed transcript states to be clear, so that I know whether content is missing, loading, or ready.
20. As a listener, I want transcript chunk failures to be recoverable, so that one failed window does not break the entire audio screen.
21. As a listener, I want the app to prefetch nearby transcript windows during playback, so that the next minute is usually ready before I reach it.
22. As a listener, I want transcript chunks to dedupe cleanly, so that overlapping windows do not show repeated lines.
23. As a listener, I want the app to handle long Arabic transcript text smoothly, so that RTL layout remains readable without freezing.
24. As a listener, I want opening the books tab or book reference area to stay responsive, so that transcript work does not block the rest of the audio screen.
25. As a production app user, I want the app to open normally when the local Telegram fetcher is offline, so that optional local services do not interrupt normal use.
26. As a production app user, I want failed local-service checks to be cached or degraded silently, so that I do not see repeated startup errors.
27. As a production app user, I want a manual retry action for local service checks, so that I can check again after starting the server.
28. As a production app user, I want Settings to let me enter the actual service IP, so that I can use the app when automatic IP detection is wrong.
29. As a production app user, I want the saved IP to be reused for Telegram/channel updates, so that update checks target the correct local API host.
30. As a production app user, I want the saved IP to be reused for local transcription, so that audio transcription targets the correct transcriber host.
31. As a production app user, I want the saved IP to be reused for Facebook media import, so that the Facebook bridge targets the correct host.
32. As a production app user, I want the app to use the correct port per service, so that one saved IP can produce valid URLs for all local services.
33. As a production app user, I want saved IP history, so that I can switch between recent networks without retyping.
34. As a production app user, I want newly entered IPs to be saved automatically after a successful check, so that useful addresses remain available.
35. As a production app user, I want invalid or unreachable IPs to show non-blocking feedback in Settings, so that the app remains usable.
36. As a developer, I want transcript performance behavior to be tested through realistic long-transcript data, so that regressions are caught before shipping.
37. As a developer, I want local service URL resolution to have focused tests, so that Settings, Telegram updates, Facebook import, and transcription stay aligned.
38. As a developer, I want startup local-service failures to be tested as optional failures, so that production builds do not regress into blocking error modals.

## Implementation Decisions

- Treat this as one product spec with three coordinated work areas: transcript windowing, transcript playback synchronization, and local service network configuration.
- Add a read-only transcript window contract for saved transcripts. The contract should accept a media identifier plus a time window or cursor and return only the persisted transcript segments needed for that window, along with transcript status, coverage/window metadata, and enough cursor data to load previous and next windows.
- Keep the existing full transcript contract available for small transcripts or admin/debug flows, but the audio screen and read mode should not depend on fetching the full transcript before first paint.
- For audio screen initial render, request the window around the current playback minute. If the audio is not the active audio, use the beginning of the audio or the route seek timestamp as the anchor.
- Use a default visible transcript window of about one minute for saved transcript reads. The implementation may include a small before/after buffer to avoid abrupt edges, but it should not load the whole transcript on initial render.
- Preserve local chunk transcription for missing transcript ranges, but separate "read saved transcript window" from "generate/transcribe this chunk." Opening a saved transcript must not require the local Whisper service.
- Normalize all transcript windows into a shared segment model before rendering. Segments from saved data and newly transcribed chunks should dedupe by stable identity and timestamp range.
- Replace read mode's full-document render with a virtualized transcript reader. The reader should render segment or paragraph rows, not a single full transcript string with a full-screen selectable input overlay.
- Preserve selection, copy, and comment behavior at the visible row/window level. If whole-document freeform text selection is too expensive, prefer row-based or segment-based selection over reintroducing a full transcript overlay.
- Keep RTL transcript layout and Arabic readability as first-class behavior in both karaoke and read mode.
- Rework karaoke and read mode to use the same transcript synchronization logic. There should be one source for active segment index, active word index, and follow/pause state semantics.
- Use timestamp-aware lookup for active segment and word selection. Active lookup should be efficient for long transcripts and should not scan every segment on every playback tick.
- Throttle or narrow playback-position driven React updates so that playback progress does not rerender every visible row unnecessarily.
- Auto-scroll should happen when the active segment changes and follow mode is enabled. It should not continually issue scroll commands on every store update.
- User scroll should pause follow mode. The UI should expose a clear live/follow action to resume and jump back to the playing segment.
- Seeking from transcript text should update playback position and active transcript state together. Double tap should keep the existing "seek and play" behavior.
- Opening read mode should not synchronously build full transcript text for long audio. Any document construction should be per window or done incrementally after the modal has painted.
- When no saved transcript window is available but the audio is queued/running/processing, show a lightweight loading or partial state without blocking the screen.
- When a transcript window fails to load, record that window as failed, show a recoverable message for that window, and allow retry without marking the whole transcript unusable.
- Settings should introduce a shared Local Services IP section. This section owns the active IP, last successful IP, and IP history.
- A saved manual IP should take precedence over automatic Expo host detection for local service URLs in production and preview builds.
- Automatic IP detection should remain useful as a candidate, especially in development, but it should not overwrite a working saved IP unless the user selects or confirms it.
- Derive service URLs from the active IP and service ports: local API for Telegram/channel updates, local transcriber for Whisper transcription, and Facebook media bridge for Facebook import.
- Keep service-specific URL overrides possible where they already exist, but Settings should make the common case one saved IP with per-service ports.
- The app should normalize user input whether the user enters a bare IP, host with port, or full URL. When a bare IP is entered, build the service URLs with the known service ports.
- IP history should dedupe normalized hosts, keep the most recent entries first, and cap the list to a small number of useful recent addresses.
- The Telegram/channel startup prompt should not present an error modal just because the local API is offline in production. Offline local service state should be cached and visible from the relevant Settings or update screen.
- Startup local-service checks should use short timeouts and backoff after failure. They should not block navigation, app launch, audio restoration, or transcript display.
- The Telegram update prompt should only appear on startup when the local API is reachable and there is a meaningful user action to take, such as available channel updates or required Telegram authentication on a reachable fetcher.
- Facebook import should use the shared saved IP when building the bridge URL and should show bridge unavailability inside the Facebook Import screen instead of producing global startup errors.
- Transcription health checks should use the shared saved IP-derived transcriber URL and should remain non-blocking. Audio transcript reading should still work for already saved transcript windows when the transcriber is offline.
- The main tRPC/local API URL story should be reviewed as part of this work because current local API defaults are split between app/web/API port assumptions. The implementation should settle which local service uses which port and reflect that consistently in Settings copy and URL builders.

## Testing Decisions

- Good tests should assert user-visible behavior and contract behavior, not internal component structure. For transcripts, tests should prove that long transcripts open quickly by rendering only a bounded window and that active highlighting follows playback state changes.
- Primary test seam: the audio transcript experience at the screen/component boundary using a long saved transcript fixture and a fake playback clock. This should cover initial audio screen render, opening read mode, scrolling to adjacent windows, seeking, pause/resume, and live-follow resume.
- API contract seam: the saved transcript window contract. Tests should cover first window by current time, previous/next cursor behavior, empty windows, partial transcript coverage, overlapping window dedupe assumptions, and ordering by timestamp.
- Synchronization seam: the shared transcript timing/sync helpers. Existing transcript timing tests are good prior art and should be extended for long transcript lookup, segment boundary behavior, word boundary behavior, and seek jumps.
- Settings/network seam: local service URL resolution from saved IP, automatic candidate IP, history entries, and service ports. Tests should cover bare IP input, full URL input, invalid input, dedupe, history cap, and per-service URL construction.
- Startup degradation seam: Telegram/channel update prompt behavior when the local API is unreachable. Tests should assert that production startup does not show a blocking unavailable prompt and that manual retry still works.
- Facebook import seam: bridge URL resolution should use the shared saved IP and expose bridge offline state inside the screen.
- Transcription seam: saved transcript windows should render when the transcriber is offline; only missing/generated chunk transcription should require local Whisper health.
- Manual QA should include an installed production or preview build with the local servers off, then on, then moved to a different IP.
- Manual QA should include a long audio with a completed transcript, starting playback near the beginning, middle, and late in the audio, then opening read mode from each position.
- Manual QA should include fast seeking, backgrounding/foregrounding, manual transcript scroll, live-follow resume, and double-tap seek/play.
- Performance validation should observe JS-thread jank during audio open and read-mode open on a long transcript. The target is no visible freeze before the first transcript window appears.
- Run focused Expo lint/typecheck for touched mobile files when implementation begins.
- Run focused API tests/typecheck for any transcript window API changes.
- If full package typechecks still fail on unrelated existing issues, report those separately and ensure no new errors point at the touched transcript, settings, or local-service files.

## Out of Scope

- Replacing the underlying audio playback engine.
- Reworking album playback, playlists, or global audio bar behavior beyond transcript sync interactions.
- Re-transcribing all existing audio in a migration.
- Building offline full-text search for transcripts.
- Adding hosted transcription providers for chunk generation.
- Changing the Facebook media bridge download/upload architecture beyond using the shared saved IP.
- Changing EAS Update publishing behavior, except ensuring local-service failures are not confused with app-update failures.
- Supporting arbitrary remote public service configuration beyond the local/LAN service IP and existing service URLs.

## Further Notes

- This spec intentionally treats the previous "read mode performance" work as insufficient because the user is still seeing freezes in real use.
- The current implementation already has useful building blocks: transcript timing helpers, chunk transcription, IP history helpers, local API auto-connect behavior, Facebook bridge health checks, and settings persistence. The implementation should reuse and unify those pieces.
- The highest-risk part is preserving transcript selection/comment behavior without returning to a full transcript overlay that freezes long audio.
- The second highest-risk part is the local API URL story because different screens currently resolve local service URLs in different ways. The finished work should make the resolved URLs visible enough in Settings that the user can tell what IP and port each service will use.

## Implementation Summary

- Added `blog.getTranscriptWindow`, a saved-transcript tRPC query that returns only persisted transcript segments for a bounded time window plus previous/next cursor metadata.
- Changed the audio screen to request the current saved-transcript minute first, prefetch nearby windows during playback, dedupe overlapping saved/generated transcript rows, and skip local Whisper generation when a saved transcript window exists.
- Reworked read mode around a virtualized segment list so opening the reader no longer builds or mounts the whole transcript as one document.
- Preserved segment seek, double-tap seek/play, and long-press segment selection/comment workflows at the virtualized row level.
- Added shared Local Services IP settings with normalization, saved history, derived API/transcriber/Facebook bridge URLs, and service-specific URL overrides kept intact.
- Routed transcription, Blog Import/Telegram local API usage, and Facebook import through the shared saved IP when present.
- Made startup channel-update local API failures degrade silently instead of showing a blocking unavailable prompt on app launch; manual checks still surface local service errors in context.

## Verification

- Passed: `bun --cwd apps/api test src/queries/blog.test.ts`
- Passed: `bun test apps/expo-app/src/lib/local-service-urls.test.ts`
- Passed: `bun test apps/expo-app/src/components/audio-blog-view/transcript-timing.test.ts`
- Passed: focused Expo ESLint for touched mobile files.
- Passed: `bun --cwd apps/api test`
- Passed: repo-level `bun test`
- Passed: `git diff --check`
- Limitation: API Biome and API/Expo typechecks were terminated by SIGKILL in this environment before producing diagnostics.
