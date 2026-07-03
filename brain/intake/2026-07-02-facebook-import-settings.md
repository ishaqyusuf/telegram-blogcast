# Brain Intake: Facebook Import Settings

## Status
Implemented

## Created Date
2026-07-02

## Last Updated
2026-07-02

## Raw Input
Feature: facebook-telegram-import blog update. Settings > Facebook Import should show all Facebook blogs and import status. Clicking Start Import begins the import.

## Generated Plans
- [x] Facebook Import Settings Dashboard And Status Flow - `brain/plans/2026-07-02-feature-facebook-import-settings-dashboard.md` - Status: Implemented

## Recommended Execution Order
1. Facebook Import Settings Dashboard And Status Flow - builds on the existing local import architecture and formalizes the current Facebook saved import script into an app-visible workflow.

## Agent Recommendations
- Facebook Import Settings Dashboard And Status Flow: open-code - requires API/service wiring, status modeling, and Expo settings navigation.

## Merged Items
- "facebook-telegram-import blog update", "Settings > Facebook Import", "show all facebook blogs", "import status", and "Start Import" were merged into one feature plan because they describe one import-control workflow.

## Duplicate Or Existing Items
- Existing `brain/plans/2026-06-15-feature-local-blog-import-screen.md` implemented the Telegram/channel `/blog-import` control screen. This request is related but not a duplicate because it targets Facebook saved blog imports and a Settings entry.
- Existing `scripts/facebook-saved/import-to-db.ts` imports Facebook saved export JSON into `Blog` rows with `source = "facebook"` and collection-backed `Channel` rows, but it is script-only and not surfaced in Expo Settings.

## Needs Clarification
- Resolved: "all Facebook blogs" means DB rows with `Blog.source = "facebook"` and `sourceUrl`.
- Resolved: Start Import uses already-imported Facebook blog rows, downloads their media from Facebook, uploads to Telegram, and attaches the returned Telegram file metadata back to the blog.

## Implementation Notes
- Settings now includes `Facebook Import`, backed by `facebookImport` tRPC procedures for summary, item listing, bridge health, and background batch start.
- The local bridge lives in `services/facebook-media-bridge`. It resolves/downloads Facebook media with `yt-dlp --cookies-from-browser`, uploads to the configured Telegram bot channel, and returns Telegram `file_id`/`file_unique_id`.
- Durable per-blog import state is stored under `Blog.meta.facebook.mediaDownload`; attached media uses normal `File` + `Media` rows.

## Skipped Items
- None.

## Approval Notes
- None.

## Handoff Notes
- Use `brain-batch-handoff` to convert approved plans into handoffs and queue items.
