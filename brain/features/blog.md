# Blog Feature

## Purpose
Tracks the current blog-reading experience and blog-related discovery surfaces.

## How To Use
- Update after meaningful changes to blog listing, detail rendering, audio-blog connections, or filters.
- Keep this as a feature summary rather than a component inventory dump.
- Link feature-specific tasks when work becomes active.

## Template

### Summary
- Feature name: Blog
- Goal: Present text and audio blog content in a navigable, readable format with discovery and filtering.
- Status: Active.

### Current Capabilities
- Blog list and detail views
- Audio blog support
- Hashtag filtering
- Home-screen integrations including book preview
- Blog compose supports translated labels and Vercel Blob-backed media uploads for images, audio, video, and documents.
- Media rendering is source-aware: existing Telegram-imported media remains supported, while new user uploads resolve from Vercel Blob URLs.

### Important Surface Areas
- `apps/expo-app/src/screens/blog-home.tsx`
- `apps/expo-app/src/screens/text-blog-screen.tsx`
- `apps/expo-app/src/screens/audio-blog-screen.tsx`
- `apps/expo-app/src/screens/blog-compose-screen.tsx`
- `apps/expo-app/src/components/blog-card`
- `apps/expo-app/src/components/blog-home`

### Media Sources
- Telegram media uses Telegram file IDs and the web `/api/telegram/file/[fileId]` proxy.
- Vercel Blob media uses the web `/api/blob/upload` token route plus Expo client uploads, then persists Blob metadata on `File`.
- Client media playback/rendering should use source-aware helpers rather than assuming every media file has a Telegram `fileId`.

### Product Role
- Serves as one of the core content-consumption pillars alongside audio and books.
- Bridges long-form educational content and richer media experiences.
