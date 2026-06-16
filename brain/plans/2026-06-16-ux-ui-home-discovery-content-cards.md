# Plan: Premium Home Discovery And Content Cards Redesign

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
Redesign the primary Expo discovery experience so the home feed, channel discovery, search entry points, post cards, and mini-player feel like a polished premium media app while preserving the product's Islamic learning, Arabic-first, and semantic-theme constraints.

## Current Context
The active home route redirects from `/` to `/home`, which renders `apps/expo-app/src/screens/blog-home.tsx`. Home-related components live in `apps/expo-app/src/components/blog-home/`, `apps/expo-app/src/components/blog-card/`, and `apps/expo-app/src/components/home-feed/`. Existing feature docs define blog as a core content pillar alongside audio and books. The design language asks for clean, media-focused presentation with GND-compatible tokens and RTL-aware content.

## Proposed Approach
Rework the home/discovery surfaces around a premium media hierarchy: compact app chrome, strong content cards, scan-friendly rails, clear recency and channel cues, polished skeletons, responsive empty/error states, and persistent playback context. Keep the design dark-mode native from the start by using the theme foundation rather than one-off colors.

## Implementation Steps
- Audit the current home route, blog home screen, blog card variants, search entry, channels preview, featured content, books CTA, albums rail, recently viewed, recently played, and bottom/mini-player interactions.
- Define one shared card visual language for post cards, media cards, channel chips, section headers, and horizontal rails.
- Redesign `blog-home.tsx` around a tighter information hierarchy: top app chrome, content discovery sections, recent listening/reading, and actionable compose/import controls only where relevant.
- Update `components/blog-card` so text, audio, image, and mixed-media posts share spacing, metadata, actions, pressed states, and dark-mode contrast.
- Remove or replace temporary home-feed mock presentation if it is not part of the active home experience.
- Ensure search and channel entry points use the same premium surface treatments and do not feel like leftover utility pages.
- Add polished loading, offline, empty, and error states using shared primitives.
- Verify Arabic text alignment, truncation, and `writingDirection` behavior in cards and rails.

## Affected Files Or Areas
- `apps/expo-app/src/app/index.tsx`
- `apps/expo-app/src/app/home.tsx`
- `apps/expo-app/src/app/search.tsx`
- `apps/expo-app/src/app/channels.tsx`
- `apps/expo-app/src/screens/blog-home.tsx`
- `apps/expo-app/src/screens/search-screen.tsx`
- `apps/expo-app/src/screens/channels-screen.tsx`
- `apps/expo-app/src/screens/channel-chat-screen.tsx`
- `apps/expo-app/src/components/blog-card/`
- `apps/expo-app/src/components/blog-home/`
- `apps/expo-app/src/components/home-feed/`
- `apps/expo-app/src/components/global-audio-bar/index.tsx`
- `brain/features/blog.md`

## Acceptance Criteria
- `/home`, `/search`, `/channels`, and `/channels/[channelId]` share a coherent premium media visual language.
- Blog cards, channel cards, rails, section headers, skeletons, empty states, and error states render correctly in light and dark modes.
- The home screen presents audio, blog, book, channel, and recent activity affordances without visual clutter or duplicated demo sections.
- Arabic/RTL content remains readable and aligned in cards and section previews.
- Existing blog navigation, channel navigation, compose/import entry points, and global audio bar behavior continue to work.

## Test Plan
- Run `bun run --cwd apps/expo-app lint`.
- Run `bun run typecheck` from the repo root if the workspace typecheck is healthy.
- Manually test `/home`, `/search`, `/channels`, and `/channels/[channelId]` in light and dark modes.
- Manually test loading, empty, long-title, Arabic text, audio-post, image-post, and no-network states where available.

## Brain Update Requirements
- Update `brain/features/blog.md` with the new home/discovery presentation and any changed component responsibilities.
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
- Home has legacy/demo paths such as `home2` and `screens.example`; preserve active routes until cleanup confirms replacements.
- Content availability may vary by API state, so empty and skeleton states need real attention.
- Do not literal-copy Spotify branding; use the product's semantic tokens and content identity.

## Open Questions
- None for the Expo home/discovery redesign.

## Linked Task
- Task Title: Premium Home Discovery And Content Cards Redesign
- Task File: brain/tasks/roadmap.md
