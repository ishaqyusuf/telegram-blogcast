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
- Quick seek controls are part of the intended experience.
- Android system player controls expose play/pause, seek, and 15-second jump backward/forward actions through media notifications, lock screen, and compatible headset/Bluetooth controls. The operating system owns the final notification/card visual treatment; the app supplies metadata, artwork, progress, and actions.
- Custom skip icons exist because the desired transport affordance was not available out of the box.
- Audio comments default to timestamp metadata on the play screen and render seekable timestamp chips.
- Album suggestions are same-channel audio candidates, ranked by matching tags.
- Playlists accept audio media only and skip duplicate additions.
- Transcripts are persisted after successful Local Whisper transcription and read back through the transcript view.
- Audio transcript chunks require the local MLX Whisper transcriber. Hosted OpenAI/Gemini transcription is not used for chunk transcription.
- Web uses the API default local transcriber URL `http://127.0.0.1:8787`; mobile must use a reachable Mac LAN URL such as `http://192.168.x.x:8787`.
- Transcription controls are disabled when the local transcriber health check fails. Start it with `bun run transcriber:dev`.
- Local transcription can be queued when the LAN transcriber is unavailable. Queued jobs are stored in local SQLite, require a reachable HTTP(S) audio URL or Telegram file ID, show failures in the local transcription panel, and can be retried later.

### Organization Rules
- Albums are channel/series-oriented. Adding media to an album enforces audio-only input and one-channel membership; empty albums infer their channel from the first added track.
- Albums can reference books through `AlbumBookReference`, allowing a series to be connected to its source text.
- Individual audio media can reference book pages through `MediaBookPageReference`, including timestamp ranges and notes. Album/book and media/page references can be removed from the mobile UI, and book-page reference taps open audio at the referenced timestamp when available.
- Playlists are user-curated and can mix audio across channels unless future product rules tighten them.
- Audio menus and channel chat expose add-to-album and add-to-playlist actions for audio media.
- Local Whisper transcription is routed through the tRPC API with a LAN transcriber URL, keeping web and mobile on the same typed chunk transcription contract.

### Future Improvements
- Stronger offline download and sync behavior
- Cross-device playback continuity
- Richer transcript integration
- Smarter queueing and playlists
- Playlist drag/drop reordering UI; API reorder support exists.
