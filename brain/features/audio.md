# Audio Feature

## Purpose
Tracks the current audio playback experience, supporting components, and future audio-related work.

## How To Use
- Update after changes to playback behavior, player UI, persistence, or offline audio flows.
- Keep deep implementation details in the relevant screen/component files.
- Link related bugs or tasks when audio regressions appear.

## Template

### Summary
- Feature name: Audio
- Goal: Provide reliable playback for audio blog content with continuity-focused controls and persistent UI.
- Status: Active and partially mature.

### Current Surfaces
- Primary screen: `audio-blog-screen.tsx`
- Supporting UI:
  - Global audio mini-player
  - Playback controls including skip and play/pause
  - Footer comment form positioned above the keyboard
  - Audio-to-book page reference panel on the audio screen
- Albums screen and album detail for channel-aware audio collections
- Playlists screen and playlist detail for user-curated audio collections

### Important Components
- `apps/expo-app/src/components/global-audio-bar/index.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-blog-player.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-blog-bottom-nav.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-blog-content.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-transcript.tsx`

### State And Persistence
- Store: `apps/expo-app/src/store/audio-store.ts`
- Android playback engine: `react-native-track-player` for native media-session playback, notification controls, lock-screen controls, and headset/Bluetooth remote events.
- iOS currently keeps the previous `expo-av` playback path; iOS lock-screen / Control Center support is intentionally deferred.
- Android native service:
  - `apps/expo-app/index.js` registers the playback service before Expo Router starts.
  - `apps/expo-app/src/services/audio-player/playback-service.ts` handles remote play, pause, seek, duck/interruption, and 15-second jump events.
  - `apps/expo-app/src/services/audio-player/setup-track-player.ts` configures media notification capabilities and background behavior.
  - `apps/expo-app/src/store/audio-store.ts` requests Android 13+ notification permission before playback starts so media controls can appear.
- Known tracked state:
  - URI
  - Local path
  - Playback position
  - Volume
  - Duration
  - `isPlaying`
  - Download progress

### UX Notes
- Persistent mini-player is a core interaction pattern.
- Opening an audio detail screen is passive: it may show the viewed audio's metadata and duration, but it must not replace, stop, seek, or pause the currently active audio until the user presses play on the viewed audio.
- Audio-detail scrub dragging is locally controlled until native seek settles; store progress events must not overwrite the thumb/time label while `isSeeking` is active.
- A naturally ended track is remembered as ended. With no repeat or queue play mode active, pressing play again seeks to 0 and restarts instead of resuming at the end or applying pause rewind.
- Quick seek controls are part of the intended experience.
- Android system player controls expose play/pause, seek, and 15-second jump backward/forward actions through media notifications, lock screen, and compatible headset/Bluetooth controls. The operating system owns the final notification/card visual treatment; the app supplies metadata, artwork, progress, and actions.
- Custom skip icons exist because the desired transport affordance was not available out of the box.
- Audio comments default to timestamp metadata on the play screen and render seekable timestamp chips.
- Album suggestions are same-channel audio candidates, ranked by matching tags.
- Playlists accept audio media only and skip duplicate additions.
- Transcripts are persisted after successful Local Whisper transcription and read back through the transcript view.
- Saved transcripts are loaded by time window on the audio screen. The first request targets the current playback minute, playback prefetches nearby windows, and read mode uses virtualized segment rows instead of mounting one full transcript document.
- Saved transcript windows take precedence over local Whisper chunk generation. Missing/generated chunks still use the local transcriber, but opening or reading an already saved transcript does not require the transcriber to be online.
- Audio transcript chunks require the local MLX Whisper transcriber. Hosted OpenAI/Gemini transcription is not used for chunk transcription.
- Web uses the API default local transcriber URL `http://127.0.0.1:8787`; mobile must use a reachable Mac LAN URL such as `http://192.168.x.x:8787`.
- Transcription controls are disabled when the local transcriber health check fails. Start it with `bun run transcriber:dev`.
- Local transcription can be queued when the LAN transcriber is unavailable. Queued jobs are stored in the API database, require a reachable HTTP(S) audio URL by the time they are claimed, and are processed by the local Python transcriber service when it is online. Mobile enqueue flows resolve Telegram file IDs into reachable URLs before saving jobs when possible.
- Transcription queue progress is DB-backed. The local service claims one job, updates `progressPercent`/`stage`/heartbeat fields, saves returned segments through the API, and marks the job completed or failed. The Expo queue screen polls and pull-refreshes those rows; it does not download media or run Whisper for queued jobs.

### Organization Rules
- Albums are channel/series-oriented. Adding media to an album enforces audio-only input and one-channel membership; empty albums infer their channel from the first added track.
- Albums can reference books through `AlbumBookReference`, allowing a series to be connected to its source text.
- Individual audio media can reference book pages through `MediaBookPageReference`, including timestamp ranges and notes. Album/book and media/page references can be removed from the mobile UI, and book-page reference taps open audio at the referenced timestamp when available.
- Playlists are user-curated and can mix audio across channels unless future product rules tighten them.
- Audio menus and channel chat expose add-to-album and add-to-playlist actions for audio media.
- Album suggestions support keyword-driven, channel-aware discovery. Album detail separates `Tracks` from `+ Add`; track reorder actions are only shown in `Tracks`, while the add tab can mark all/clear/add suggestions and uses toast feedback.
- Floating bottom actions use a shared stackable footer registry. The global audio bar is the reserved bottom-most registered layer, and album track/suggestion selection actions stack above it instead of hiding or overlapping the player.
- Album suggestion selection exposes a floating action row for mark/unmark all, add selected to the current album, delete selected blog items with confirmation, and add selected media to another album. Long-pressing suggestion add actions opens the full add-to-album modal.
- Add-to-album and album suggestion inputs use keyboard-aware scrolling so focused inputs and bottom actions remain reachable when the mobile keyboard is open.
- Album track rows expose direct play/resume/pause controls. The active audio row is highlighted when the currently loaded blog/media belongs to the opened album.
- Album detail manages one album-level author through `Album.albumAuthorId`: unique track authors can be toggled onto/off the album, new authors can be created, existing authors can be edited, and track rows fall back to their own author when the album author is unset.
- Album detail previews attached books and provides a searchable manage-books modal for attaching existing library books or detaching `AlbumBookReference` rows without deleting the books.
- Automatic album indexing can generate a channel-level AI proposal using existing same-channel albums and same-channel unalbumed audio candidates. Generation supports DeepSeek, Gemini, and OpenAI provider selection, sends lean author-free `id + textData` media chunks to keep requests small, can include review-only proposed new albums when no existing album fits, merges/dedupes chunk results into one reviewable run, and persists raw AI JSON, parsed JSON, normalized album/media suggestions, model/provider metadata, and failure details without changing album membership.
- Settings exposes **Album Organizer**, a channel-first review flow for automatic album indexing. It shows unalbumed audio and album counts, supports swipe-down refresh on the channel summary, lets the user choose and cache the AI provider for the next run, reopens saved discovery runs without regenerating, shows the model used for saved discoveries, lists discovered existing/proposed albums with track counts, and lets users review, dismiss/restore, edit proposed album name/type, or approve proposed tracks per album. Proposed albums are created only on approval.
- Album playback started from album detail carries the ordered playable album queue into the audio store. The global audio bar exposes album-only play modes: off/default, repeat one, play next, repeat album, and shuffle album. Default mode stops at track end; repeat and queue modes are handled by the store on natural completion.
- Audio and search cards expose album membership as badges. When an audio item is already in an album, audio detail opens the album instead of showing another add-plus affordance.
- Timestamped comments seek and start playback when tapped. Transcript segments support single tap to seek and double tap/click to seek and play.
- The global audio bar can show current time plus album track index when the active audio has album order metadata.
- Long audio/album/search/home/text screens use shared scroll chrome: the mini-player hides while scrolling and a centered scroll-to-top button appears after deep scrolling.
- Direct Local Whisper transcription is routed through the tRPC API with a LAN transcriber URL, keeping web and mobile on the same typed chunk transcription contract. Queued Local Whisper transcription is worker-owned through internal API endpoints and the local Python service.
- Blog Import can import a single public Telegram audio post link without fetching the full channel. The API resolves the exact message, saves it through the same Blog/File/Media persistence path as the channel fetcher, and returns an existing blog when the channel/message pair is already stored.
- Settings exposes a shared Local Services IP with saved history. That IP is used to derive the local API, local transcriber, and Facebook media bridge URLs with their service ports, while explicit service URL overrides continue to win.
- Startup channel-update local API checks degrade silently when the local server is offline or the IP is stale; local-service failures are surfaced from the relevant Settings/import screens instead of interrupting app launch.
- Preview/production local transcription is session-gated by the cold-launch Local Services IP choice. Dismissing setup prevents transcriber health checks, automatic missing-chunk generation, queue polling/enqueue, and direct transcription while preserving playback and saved transcript reading.

### Future Improvements
- Stronger offline download and sync behavior
- Cross-device playback continuity
- Richer transcript integration
- Smarter queueing and playlists
- Playlist drag/drop reordering UI; API reorder support exists.
