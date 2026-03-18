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

### Important Components
- `apps/expo-app/src/components/global-audio-bar/index.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-blog-player.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-blog-bottom-nav.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-blog-content.tsx`
- `apps/expo-app/src/components/audio-blog-view/audio-transcript.tsx`

### State And Persistence
- Store: `apps/expo-app/src/store/audio-store.ts`
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
- Custom skip icons exist because the desired transport affordance was not available out of the box.

### Future Improvements
- Stronger offline download and sync behavior
- Cross-device playback continuity
- Richer transcript integration
- Smarter queueing and playlists
