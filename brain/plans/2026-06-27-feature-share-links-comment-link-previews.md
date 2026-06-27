# Plan: Share Links And Comment Link Previews

## Type
Feature

## Status
Done

## Completion Notes
- Added canonical blog/album share-link helpers and native app link config for production web links.
- Blog menu can copy links, and comments render compact internal link preview cards.

## Created Date
2026-06-27

## Last Updated
2026-06-27

## Intake
- Intake File: brain/intake/2026-06-27-album-blog-audio-polish.md
- Intake Item: Link share should support a share link that opens the app; copy link and paste in another comment; copied link should auto display caption text like WhatsApp.

## Goal Or Problem
Enable shareable app links for blogs/audio/albums and make pasted internal links in comments render with a useful caption preview instead of plain URL-only text.

## Current Context
The Expo app uses Expo Router with blog/audio/album routes. Comments are stored through blog APIs. Existing docs do not describe app deep links or comment link previews, so this plan should add the contract and UI behavior carefully.

## Proposed Approach
Define canonical internal share URLs for supported entities. Configure Expo linking/deep-link handling so opening a share link routes to the app screen. Add copy/share actions in blog menus. On comment input paste or comment render, detect supported internal links and resolve a lightweight caption preview from existing blog/album metadata.

## Implementation Steps
- Audit Expo app linking configuration and route paths for blogs, audio blogs, text blogs, and albums.
- Define canonical share URL format and map it to Expo Router routes.
- Add share/copy actions to the floating blog menu or existing blog options sheet.
- Configure app linking so supported links open the app and navigate to the right screen.
- Add comment input/render detection for supported internal links.
- Resolve link caption metadata such as title, type, channel, album, or excerpt through existing API/cache where possible.
- Render pasted internal links with a compact preview card/caption similar to messaging apps.
- Keep unsupported external links as normal text or existing link behavior.

## Affected Files Or Areas
- `apps/expo-app/src/app/_layout.tsx`
- `apps/expo-app/src/app/blog-view-2/[blogId]/index.tsx`
- `apps/expo-app/src/app/blog-view-text/[blogId]/index.tsx`
- `apps/expo-app/src/app/albums/[albumId].tsx`
- `apps/expo-app/src/components/blog-card/blog-card-options-sheet.tsx`
- `apps/expo-app/src/components/comments-sheet/comment-input.tsx`
- `apps/expo-app/src/components/comments-sheet/comments-list.tsx`
- `apps/api/src/trpc/routers/blog.routes.ts`
- `apps/api/src/trpc/routers/album.routes.ts`
- `brain/features/blog.md`
- `brain/features/audio.md`
- `brain/api/contracts.md`

## Acceptance Criteria
- A user can copy/share a link for a supported blog/audio item.
- Opening a supported share link on a device with the app installed routes into the correct app screen.
- Pasting a supported internal link into a comment can display a caption/preview based on linked content metadata.
- Posted comments containing supported links render a preview/caption.
- Unsupported links do not break comment submission or display.

## Test Plan
- Run Expo app typecheck if configured.
- Manually copy/share a blog link and open it from outside the app.
- Manually paste a copied internal link into a comment and verify preview/caption appears.
- Manually submit the comment and verify the stored comment renders the preview after reload.
- Manually test unsupported external links and plain text comments.

## Brain Update Requirements
- Update `brain/features/blog.md` with share-link and comment preview behavior.
- Update `brain/api/contracts.md` if link-preview metadata APIs are added.

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
- Deep link behavior differs between Expo Go, dev builds, and production builds.
- Link previews can require network calls and should avoid blocking comment typing.
- Private/local content should not leak metadata through public URLs without an access decision.

## Open Questions
- TODO: Confirm canonical domain/scheme for production share links.
- TODO: Confirm which entity types need share links first: blogs, audio blogs, albums, comments, or all.

## Linked Task
- Task Title: Share Links And Comment Link Previews
- Task File: brain/tasks/roadmap.md
