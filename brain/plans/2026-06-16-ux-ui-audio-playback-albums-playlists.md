# Plan: Premium Audio Playback Albums And Playlists Redesign

## Type
UX/UI

## Status
Proposed

## Created Date
2026-06-16

## Last Updated
2026-06-16

## Intake
- Intake File: brain/intake/2026-06-16-app-redesign-cleanup-dark-mode.md
- Intake Item: redesign entire app to spotify-ui level

## Goal Or Problem
Make the Expo audio experience feel like a first-class premium media product across audio detail, global playback, albums, playlists, play history, transcripts, and channel audio actions.

## Current Context
Audio is an active core feature. The feature doc names `audio-blog-screen.tsx`, the global mini-player, playback controls, albums, playlists, transcript view, and timestamped comments as important surfaces. The current route inventory includes `/blog-view-2/[blogId]`, `/blog-view-2/[blogId]/transcribe-audio`, `/albums`, `/albums/[albumId]`, `/playlists`, `/playlists/[playlistId]`, and `/play-history`. Recent plans added playlist APIs, albums, transcription, and timestamped comments, so this plan is visual/interaction polish rather than backend capability work.

## Proposed Approach
Redesign audio surfaces around polished media controls, consistent album/playlist cards, predictable queue and history affordances, transcript/comment readability, and theme-aware playback chrome. Preserve existing playback state and API contracts while improving layout, hierarchy, press states, and screen consistency.

## Implementation Steps
- Audit all audio-related routes for theme gaps, inconsistent spacing, duplicate card styles, and hard-coded colors.
- Redesign the global audio bar as persistent playback chrome with clear title/channel metadata, progress, play/pause, skip controls, sleep timer state, and dark-mode contrast.
- Redesign the audio blog detail screen around a premium media header, transport controls, transcript/comment affordances, related metadata, and accessible loading/error states.
- Align album and playlist list/detail screens with shared cover art, generated color, track row, count, action menu, and empty-state patterns.
- Polish play history as a resumable listening surface with progress affordances and clear continue actions.
- Ensure transcript, local transcribe, and timestamped comments use theme-aware sheets and typography.
- Keep channel chat audio actions visually consistent with albums/playlists and preserve add-to-album/add-to-playlist behavior.
- Update audio feature docs with the final visual and interaction patterns.

## Affected Files Or Areas
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/screens/albums-screen.tsx`
- `apps/expo-app/src/screens/album-detail-screen.tsx`
- `apps/expo-app/src/screens/playlists-screen.tsx`
- `apps/expo-app/src/screens/playlist-detail-screen.tsx`
- `apps/expo-app/src/screens/play-history-screen.tsx`
- `apps/expo-app/src/screens/channel-chat-screen.tsx`
- `apps/expo-app/src/components/global-audio-bar/`
- `apps/expo-app/src/components/audio-blog-view/`
- `apps/expo-app/src/components/comments-sheet/`
- `apps/expo-app/src/components/channel-chat/`
- `apps/expo-app/src/store/audio-store.ts`
- `brain/features/audio.md`

## Acceptance Criteria
- Audio detail, global audio bar, albums, album detail, playlists, playlist detail, play history, transcript, and audio comments share one premium media visual language.
- Playback controls remain functional and visually legible in both light and dark modes.
- Album/playlist cards and track rows have consistent cover treatment, metadata hierarchy, pressed states, loading states, and empty states.
- Timestamped comments and transcripts remain readable and seekable where currently supported.
- No existing audio, playlist, album, or transcription API behavior is regressed.

## Test Plan
- Run `bun run --cwd apps/expo-app lint`.
- Run `bun run typecheck` from the repo root if the workspace typecheck is healthy.
- Manually test audio playback, pause/resume, skip controls, seek/progress, global bar route navigation, albums, playlists, play history, transcript modal/screen, and comments sheet in both themes.
- Manually test no-audio, loading, long-title, and missing-media states.

## Brain Update Requirements
- Update `brain/features/audio.md` with the redesigned audio surface responsibilities and any changed component roles.
- Update `brain/tasks/done.md` after implementation.

## Lower-Agent Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Required checks are listed: Yes
- Brain update requirements are listed: Yes
- Ready for handoff: Yes

## Completion Report Requirements
Lower agent must report:
- Changed files
- Checks run
- Brain docs updated
- Unresolved issues
- Any skipped acceptance criteria

## Risks / Edge Cases
- Audio playback state is delicate; visual changes must not reset player state or break persisted progress.
- Generated cover colors can remain hard-coded palette values if contrast is validated in both themes.
- Local transcription depends on LAN health checks; keep unavailable states clear.

## Open Questions
- None for the Expo audio redesign.

## Linked Task
- Task Title: Premium Audio Playback Albums And Playlists Redesign
- Task File: brain/tasks/roadmap.md
