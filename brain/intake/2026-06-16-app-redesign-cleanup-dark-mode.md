# Brain Intake: App Redesign Cleanup And Dark Mode

## Status
Proposed

## Created Date
2026-06-16

## Last Updated
2026-06-16

## Raw Input
intake
redesign entire app to spotify-ui level
clean up unused codes
optimize and make all screens dark mode support.

## Generated Plans
- [ ] Theme Foundation And Dark Mode Audit - `brain/plans/2026-06-16-ux-ui-theme-foundation-dark-mode.md` - Status: Proposed
- [ ] Premium Home Discovery And Content Cards Redesign - `brain/plans/2026-06-16-ux-ui-home-discovery-content-cards.md` - Status: Proposed
- [ ] Premium Audio Playback Albums And Playlists Redesign - `brain/plans/2026-06-16-ux-ui-audio-playback-albums-playlists.md` - Status: Proposed
- [ ] Premium Books Library And Reader Redesign - `brain/plans/2026-06-16-ux-ui-books-library-reader.md` - Status: Proposed
- [ ] Utility Import Settings And Empty-State Screen Polish - `brain/plans/2026-06-16-ux-ui-utility-import-settings-empty-states.md` - Status: Proposed
- [ ] Expo Unused Code And Asset Cleanup - `brain/plans/2026-06-16-cleanup-expo-unused-code-assets.md` - Status: Proposed
- [ ] Expo Performance Optimization Pass - `brain/plans/2026-06-16-refactor-expo-performance-optimization.md` - Status: Proposed

## Recommended Execution Order
1. Theme Foundation And Dark Mode Audit - establishes semantic tokens, route-level dark-mode expectations, and shared UI primitives before visual screen work.
2. Expo Unused Code And Asset Cleanup - removes legacy/example clutter early so redesign work does not preserve unused surfaces by accident.
3. Premium Home Discovery And Content Cards Redesign - updates the first-run and primary discovery surface once the foundation is stable.
4. Premium Audio Playback Albums And Playlists Redesign - applies the premium media direction to the highest-value listening flows.
5. Premium Books Library And Reader Redesign - applies the premium media direction while preserving Arabic-first reading constraints.
6. Utility Import Settings And Empty-State Screen Polish - finishes the secondary, maintenance, and error surfaces so the app feels complete.
7. Expo Performance Optimization Pass - measures and optimizes after visual structure is settled enough to avoid rework.

## Agent Recommendations
- Theme Foundation And Dark Mode Audit: open-code - token and navigation work needs careful repo-local implementation.
- Expo Unused Code And Asset Cleanup: open-code - requires static import checks, dependency auditing, and safe deletion.
- Premium Home Discovery And Content Cards Redesign: antigravity - benefits from visual iteration and screenshot review across device sizes.
- Premium Audio Playback Albums And Playlists Redesign: antigravity - media-player polish and interaction states need visual QA.
- Premium Books Library And Reader Redesign: antigravity - typography, RTL reading, and long-form layout need visual QA.
- Utility Import Settings And Empty-State Screen Polish: open-code - mostly route-level consistency and component reuse.
- Expo Performance Optimization Pass: open-code - profiling, list rendering, and cache behavior need code-level verification.

## Merged Items
- "redesign entire app to spotify-ui level" and "make all screens dark mode support" were split into foundation plus screen-group plans so each handoff has clear file boundaries and acceptance criteria.
- "optimize" was converted into a dedicated performance pass rather than being mixed into visual redesign tasks.
- "clean up unused codes" was converted into a cleanup plan focused on Expo example screens, copied assets, duplicate theme hooks, and dead demo domains.

## Duplicate Or Existing Items
- None found. Existing 2026-06-15 plans cover albums, playlists, transcription, import, comments, and merge workflows but not a whole-app visual redesign, dark-mode audit, cleanup, or performance pass.

## Needs Clarification
- Does "entire app" include the Next.js web app in `apps/www`, or only the Expo mobile app in `apps/expo-app`? These proposed plans target Expo because the request says "screens" and the active mobile app has the broad screen inventory.
- Should "Spotify-ui level" mean a premium, dense, media-first interaction standard while preserving the existing GND/Al Ghurobaa color tokens, or should the product adopt a darker visual direction overall? Existing `brain/engineering/design-language.md` says to avoid hard-coded Spotify green/black and use semantic NativeWind tokens.
- What performance targets matter most: startup time, home feed scroll FPS, audio screen responsiveness, book reader page render time, or bundle size?

## Skipped Items
- Next.js web app redesign - skipped until scope is confirmed because `apps/www` has a separate web surface and the request did not name it directly.

## Approval Notes
- None.

## Handoff Notes
- Use `brain-batch-handoff` to convert approved plans into handoffs and queue items.
