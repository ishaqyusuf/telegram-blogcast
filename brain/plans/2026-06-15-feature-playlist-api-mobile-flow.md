# Plan: Add Playlist API And Mobile Playlist Flow

## Type
Feature

## Status
Implemented

## Created Date
2026-06-15

## Last Updated
2026-06-15

## Completion Notes
- Added a dedicated playlist tRPC router and registered it in the app router.
- Mobile now has playlist list/detail routes, playlist creation, add-to-playlist modal, audio blog menu integration, and channel chat integration.
- Playlist add rejects missing or non-audio media and skips duplicates at the application layer.
- Playlist detail supports simple up/down episode reordering through the reorder API.

## Intake
- Intake File: brain/intake/2026-06-15-blog-audio-organization-import.md
- Intake Item: Blog audio menu should add to playlist and users should be able to create playlists.

## Goal Or Problem
Enable user-controlled playlists for audio media, including creating playlists and adding audio from blog menus, without overloading album semantics.

## Current Context
Database models `Playlist` and `PlaylistEpisode` already exist in `packages/db/src/schema/media.schema.prisma`, and `Media` has a `PlaylistEpisode[]` relation. No playlist tRPC router or mobile playlist screens were found. Albums are channel/series-oriented; playlists should serve user-curated listening collections.

## Proposed Approach
Add a dedicated playlist tRPC router and mobile playlist screens. Keep playlist behavior simpler than albums at first: create, list, detail, add/remove media, reorder episodes, and launch audio from a playlist row. Integrate "Add to Playlist" beside "Add to Album" in audio blog and channel chat menus.

## Implementation Steps
- Create `apps/api/src/trpc/routers/playlist.routes.ts`.
- Add procedures: `getPlaylists`, `getPlaylist`, `createPlaylist`, `addMediaToPlaylist`, `removeMediaFromPlaylist`, and `reorderEpisodes`.
- Register router in `apps/api/src/trpc/routers/_app.ts`.
- Ensure only audio media is accepted by `addMediaToPlaylist`.
- Avoid duplicate playlist episodes for the same playlist/media pair.
- Add mobile routes `/playlists` and `/playlists/[playlistId]`.
- Build `AddToPlaylistModal` mirroring the existing album modal but using playlist procedures.
- Add "Add to Playlist" to audio blog action menus and channel chat context menu for audio posts.
- Invalidate playlist queries after create/add/remove/reorder.

## Affected Files Or Areas
- `apps/api/src/trpc/routers/playlist.routes.ts`
- `apps/api/src/trpc/routers/_app.ts`
- `packages/db/src/schema/media.schema.prisma`
- `apps/expo-app/src/app/_layout.tsx`
- `apps/expo-app/src/app/playlists.tsx`
- `apps/expo-app/src/app/playlists/[playlistId].tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/screens/channel-chat-screen.tsx`
- `apps/expo-app/src/components/channel-chat`
- `brain/features/audio.md`

## Acceptance Criteria
- A user can create a playlist from mobile.
- A user can add an audio blog to a playlist from an audio menu.
- A user can view playlist detail with ordered episodes.
- A user can remove and reorder playlist episodes.
- Adding non-audio media to a playlist is rejected.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck if configured.
- Manually create a playlist and add the same audio twice; verify no duplicate episode.
- Manually play an audio item from playlist detail.

## Brain Update Requirements
- Update `brain/features/audio.md` with playlist behavior.
- Update `brain/api/contracts.md` with playlist router contracts.

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
- `PlaylistEpisode` lacks a unique compound constraint for playlist/media duplicates; implementation may need application-level duplicate checks or a schema migration.
- Current API uses a default user in some places; playlist ownership should follow the repo's auth pattern or explicitly match existing default-user behavior.

## Open Questions
- TODO: Confirm whether playlists should be user-global, channel-scoped, or support both.

## Linked Task
- Task Title: Add Playlist API And Mobile Playlist Flow
- Task File: brain/tasks/roadmap.md
