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
- The audio detail screen prevents automatic screen sleep while focused, including paused playback, transcript reading, and inline tabs. Leaving the route releases its wake lock; background playback alone does not keep the display on.
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
- `apps/expo-app/src/components/audio-blog-view/karaoke-transcript.tsx`
- `apps/expo-app/src/components/audio-blog-view/transcript-read-mode.tsx`
- `apps/expo-app/src/components/audio-blog-view/selectable-transcript-surface.tsx`

### State And Persistence
- Store: `apps/expo-app/src/store/audio-store.ts`
- Android playback engine: `react-native-track-player` for native media-session playback, notification controls, lock-screen controls, and headset/Bluetooth remote events.
- iOS currently keeps the previous `expo-av` playback path; iOS lock-screen / Control Center support is intentionally deferred.
- Android native service:
  - `apps/expo-app/index.js` registers the playback service before Expo Router starts.
  - `apps/expo-app/src/services/audio-player/playback-service.ts` retains remote-event fallbacks and foreground synchronization; Android media-session buttons execute against the native player first so they remain functional without a live headless JavaScript listener.
  - `apps/expo-app/src/services/audio-player/setup-track-player.ts` configures media notification capabilities, custom Android actions, and background behavior.
  - `apps/expo-app/src/store/audio-store.ts` requests Android 13+ notification permission before playback starts and synchronizes completed remote-action snapshots into the foreground player state.
- Known tracked state:
  - URI
  - Local path
  - Playback position
  - Volume
  - Duration
  - `isPlaying`
  - Download progress
- Completed audio downloads are moved from validated `.part` files into app-private document storage, resolved by stable media identity before any remote URL, and validated against the known file size when available. The Expo filesystem in the current Android build can write temporary files under Android/media but rejects final media file promotion there; existing Android/media downloads remain readable.
- Offline audio lookup checks both current app-private storage and legacy scoped media files. When the original filename changes, a file under the same media ID is recovered only if its size matches the recorded size. A failed background download exposes a retry state instead of silently appearing unsaved.
- Feed and album play controls use a filled blue offline state only when a complete readable phone file exists. Download completion and app foregrounding refresh every visible copy.
- Audio detail opens with available metadata from its feed, album, playlist, history, or mini-player entry point while `getBlog` refreshes in the background. The full detail query remains in the bounded persisted content cache for repeat and offline visits.
- Feed audio cards and album tracks show a separate download badge beside the play control only while the audio is not saved. Once a complete readable phone file exists, the badge disappears and the filled blue play/pause control indicates offline availability without a check mark; its accessibility label still identifies downloaded audio. Download saves without playback; Play streams immediately and caches the audio concurrently. The audio detail player also offers a Download action. Completed files are reused offline.
- Audio options on the detail screen and album tracks expose Rename. The nullable `Media.titleOverride` takes display precedence over the original media title/filename; clearing it restores the original. Both names remain searchable in blog/album discovery.
- The Rename sheet keeps its input, validation message, and Save action visible above the Android keyboard. API failures leave the form and typed name in place and show a readable inline error; a missing deployed mutation is identified as an API update still pending.
- The audio detail Details tab offers full Transcribe/Transcribed and Copy actions. Transcribe queues the whole audio and shows queued/running progress; Copy fetches and copies all saved transcript segments for that audio to the system clipboard.
- Recently Played is recorded from the global player for feed, album, detail, and Android system-control playback. The active media is saved when playback starts, pauses, seeks, changes track, or the app backgrounds, plus every 30 seconds while playing. Opening an audio detail page alone does not add it to history.
- Loading a different audio item uses its latest in-session position when present, otherwise reads server history (with a bounded timeout), and seeks before play; a completed track starts from the beginning. The persisted native/local position still restores the currently loaded track after app restart. The history screen's Play button opens and starts the selected audio at its saved position.

### UX Notes
- The audio detail screen uses one dark vertical lesson page: a full-screen transcript-led player followed by inline Details, Comments, and Books tabs. The album context and lesson title sit above the transcript, leaving the lower player for the scrubber and transport. Comments is selected by default. Selecting a tab reveals it with part of the transport still visible; scrolling up restores the player. The player shortcut in each inline section returns to the top.
- Transcript text scrolls independently of the lesson page. Read is a transparent ghost action at the left of its footer; Live sits at the far right and resumes follow after manual transcript scrolling when the viewed audio is active. The separate Live transcript heading is removed.
- Download/Saved, full Transcribe/Transcribed, and Copy are in Details. The Comments tab uses the existing timestamped comment list and composer, including keyboard-aware reveal. Audio options and comment deep links open that inline tab. A local floating transport and scroll-to-top bubble do not cover the inline sections; the global bar may still appear for a different active track.
- Persistent mini-player is a core interaction pattern.
- The mini-player is suppressed throughout Search and on an audio detail route whose viewed media matches the active media; playback continues and eligible routes restore the player normally.
- Opening an audio detail screen is passive: it may show the viewed audio's metadata and duration, but it must not replace, stop, seek, or pause the currently active audio until the user presses play on the viewed audio.
- Oversized Facebook audio is intentionally not loaded into the in-app player. Its thumbnail and metadata remain visible, and the play action opens the Telegram message for files through 50 MiB or the original Facebook post for larger files.
- Audio-detail scrub dragging is locally controlled until native seek settles; store progress events must not overwrite the thumb/time label while `isSeeking` is active.
- Audio-detail time labels preview the seek position while dragging and use hour-aware `HH:MM:SS` formatting for audio at least one hour long.
- A naturally ended track is remembered as ended. With no repeat or queue play mode active, pressing play again seeks to 0 and restarts instead of resuming at the end or applying pause rewind.
- Quick seek controls are part of the intended experience.
- Android system player controls use a Spotify-style action set: playback speed, back fifteen seconds, system-managed play/pause, forward fifteen seconds, and open comments. Android owns final placement and may reorder the expanded actions.
- Speed and comments are real app-specific media-session actions rather than disguised previous/next controls. Album previous/next capabilities remain reserved for real queue navigation.
- Notification speed cycles natively through `1× → 1.25× → 1.5× → 1.75× → 2× → 1×` and immediately republishes the matching monochrome speed-state icon.
- These controls depend on the checked-in native `react-native-track-player` patch and require a new Android development/preview binary. An OTA update alone cannot install this behavior.
- Audio comments default to timestamp metadata on the play screen and render seekable timestamp chips.
- Album suggestions are same-channel audio candidates, ranked by matching tags.
- Playlists accept audio media only and skip duplicate additions.
- Transcripts are persisted after successful Local Whisper transcription and read back through the transcript view.
- Saved transcripts are loaded by time window on the audio screen. The first request targets the current playback minute, playback prefetches nearby windows, and read mode rebuilds its selectable document incrementally while retaining the visible segment anchor.
- Saved transcript windows take precedence over local Whisper chunk generation. Missing/generated chunks still use the local transcriber, but opening or reading an already saved transcript does not require the transcriber to be online.
- Saved transcript windows render from local SQLite first. Complete cached ranges are read without requesting the same window again; the first window is refreshed in the background to detect a newer transcript revision. Once a full transcript is available, missing 300-second ranges are fetched and stored in SQLite in the background so subsequent transcript navigation reads locally. Newly generated chunks are also fetched through the saved-window path and persisted locally.
- Karaoke and read mode render the same continuous RTL transcript document. Adjacent timed segments receive only the natural wrapping space required by their source boundaries; source-provided Arabic whitespace, punctuation, line breaks, and tashkeel remain verbatim, with no synthetic paragraph breaks.
- Android and iOS use a locked-down local WebView for the shared flowing surface and native read-mode selection handles, while web uses the equivalent DOM surface for click-and-drag selection. Transcript strings and separators are inserted as text nodes, never interpreted as HTML.
- Active, past, and future runs share identical typography and node structure; playback progress changes color only and cannot reflow text. Measured word timestamps highlight only inside their exact interval. Missing or evenly estimated timings highlight the active segment instead of presenting false word precision.
- Highlight timing projects from the latest native player sample using playback rate, stops projection during pause, buffering, and seeking, and updates only at transcript boundaries. Word changes never trigger scrolling.
- A non-empty read-mode selection exposes Copy, Comment, Share, and dismiss actions. Copy and Share preserve the exact selected flowing text; Comment uses the original drag anchor to resolve a deterministic transcript timestamp, including backward cross-segment selections.
- Opening read mode is initially hidden, jumps without animation to the current active segment, then reveals. Later segment transitions follow smoothly. Manual scrolling or selecting pauses follow mode; the floating Live control clears selection, catches up instantly, and is the sole current-position control.
- Read opens a dark full-screen reading surface matching the lesson direction. Its compact header shows the transcript context; the top tools show follow/paused state, adjustable text size, Tashkeel, and Copy. Selection actions appear only when text is selected. A compact bottom dock shows playback status, timestamped Comment, scrubber, speed, skips, and Play/Pause, with system insets respected.
- The audio player header keeps only navigation, playback context, and the overflow menu. Read transcript, transcription/CC, and Local Services actions live in the Audio options bottom sheet instead of competing with the transcript viewport.
- Prepending or appending transcript windows restores the visible segment by stable identity and rebases selected document offsets, so incremental loading does not jump the viewport or corrupt a selection.
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
- Album suggestions support keyword-driven, channel-aware discovery. Every suggested audio row identifies its source channel. The Add tab exposes a channel filter: empty albums can choose the source channel before their first addition, while albums with established membership show that channel as locked so the UI stays aligned with server-side one-channel enforcement. Album detail separates `Tracks` from `+ Add`; track reorder actions are only shown in `Tracks`, while the add tab can mark all/clear/add suggestions and uses toast feedback.
- Floating bottom actions use a shared stackable footer registry. The global audio bar is the reserved bottom-most registered layer, and album track/suggestion selection actions stack above it instead of hiding or overlapping the player. Every bottom-sheet primitive suppresses the global audio bar from presentation through completed dismissal, with an id-based registry so overlapping sheets cannot reveal it early.
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
- Album/search/home/text screens use shared scroll chrome: the mini-player hides while scrolling and a centered scroll-to-top button appears after deep scrolling. Audio detail uses its inline section and Player shortcut instead.
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
