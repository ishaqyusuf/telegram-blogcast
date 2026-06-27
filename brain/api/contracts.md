# API Contracts

## Purpose
Tracks important request/response expectations and typed boundaries between clients and the API.

## How To Use
- Update when contract changes affect mobile, web, or jobs.
- Capture non-obvious payload assumptions and validation rules here.
- Link to feature docs or router files for domain-specific details.

## Template

### Contract Sources
- tRPC router definitions in `apps/api/src/trpc/routers`
- Shared types in `apps/api/src/rest/types.ts` and related utility files
- Client integrations in `apps/expo-app/src/lib/trpc.ts`, `apps/expo-app/src/trpc`, and `apps/www/src/trpc`

### Expectations
- Prefer schema-validated inputs at API boundaries.
- Preserve typed client/server alignment when changing router outputs.
- Document breaking changes that require coordinated app updates.
- `apps/www/src/app/api/trpc/[...trpc]/route.ts` is the web gateway for the shared Hono/tRPC handler from `apps/api/src/internal-api.ts`, so Expo can target `apps/www` in local development without changing router contracts.
- Expo tRPC clients resolve their endpoint from `apps/expo-app/src/lib/base-url.ts`; prefer `EXPO_PUBLIC_TRPC_URL` or `EXPO_PUBLIC_TRPC_PORT` for local routing instead of overloading unrelated web/app env values.
- `book.getBooks` returns each book with at most one fetched `pages` entry, ordered by lowest `shamelaPageNo`, so mobile list surfaces can open the first reader page directly while falling back to book detail when no fetched page exists.
- Blog media is source-aware. `blog.createBlog` accepts optional `mediaUploads` from Vercel Blob and persists them as `File` + `Media` rows with `source = "vercel_blob"`; existing Telegram media keeps using Telegram `fileId` values and the web proxy.
- Expo uploads user-selected blog media through the Next.js `/api/blob/upload` client-upload token endpoint, then sends the resulting Blob metadata to tRPC with the blog create/update payload.

### Blog Contracts
- `blog.mergeBlogs` accepts `{ primaryBlogId, secondaryBlogId, contentStrategy? }`, requires two different non-deleted blogs, rejects cross-channel merges, moves secondary media/tag/comment links to the primary blog, writes merge metadata, and soft-deletes the secondary blog.
- `blog.addComment` accepts optional `timestampSeconds`; timestamped comments store `meta.audioTimestampSeconds`.
- `blog.getComments` includes comment `meta` so clients can render timestamp chips.
- `blog.transcribeRange` accepts optional `mediaId`, `model`, and `localTranscriberBaseUrl`; when `mediaId` is present, successful transcription segments are persisted to `Transcript` and `TranscriptSegment`.
- Supported transcription model values are `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gemini-2.0-flash`, and `whisper-local`. The legacy `provider` input is tolerated for older clients.
- `blog.getTranscriptChunk` is local-only for audio transcript chunks. It uses `whisper-local`, calls the local transcriber service, requests word timestamps, persists returned segments/words, and must not route chunk transcription to hosted OpenAI/Gemini providers.
- `blog.checkLocalTranscriber` checks a local Whisper service health endpoint and returns availability/model metadata for web transcript controls and mobile Settings/audio screens.
- `blog.enqueueTranscriptionJob` stores DB-backed transcription queue rows. Enqueue clients should provide a reachable HTTP(S) `audioUrl`; Telegram file IDs should be resolved before enqueue when possible.
- `blog.getTranscriptionJobs` returns queue rows with media title/file/blog fallback metadata plus persisted progress fields from `TranscriptionJob`.
- Internal transcription worker endpoints under `/api/internal/transcription-jobs/*` are used by the local Python service, not by mobile UI. They claim jobs, persist progress/heartbeats, save completed transcript segments, and record failures/retries. If `TRANSCRIPTION_WORKER_TOKEN` is set, workers must send `Authorization: Bearer <token>`.

### Audio Organization Contracts
- `album.addMediaToAlbum` accepts `{ albumId, mediaIds }`, requires audio media, rejects missing media, rejects mixed-channel candidate sets, and rejects cross-channel additions when the album already has a channel. Empty albums infer `channelId` from the first added audio blog.
- `album.getSuggestedMedia` returns same-channel audio candidates with matching tag metadata and excludes media already in the album.
- `album.getAlbumSuggestionGroups` accepts a keyword and optional channel context, returns matching albums with channel metadata and channel-compatible audio suggestions.
- `blog.search` includes media album membership where present so clients can render album badges/actions.
- `blog.suggestSearchKeywords` returns lightweight live keyword suggestions from recent searches, tags, and matching post text.
- `playlist` router exposes `getPlaylists`, `getPlaylist`, `createPlaylist`, `addMediaToPlaylist`, `removeMediaFromPlaylist`, and `reorderEpisodes`.
- `playlist.addMediaToPlaylist` accepts audio media only, skips duplicates, and returns `{ added, skipped }`.

### Local API Contracts
- `GET /health` returns a lightweight API reachability payload for local Expo/APK screens.
- `/blog-import` mobile flow talks to the local API over LAN using the tRPC channel procedures: `channel.getChannels`, `channel.syncChannels`, `channel.toggleFetchable`, `channel.startFetch`, `channel.stopFetch`, and `channel.getFetcherState`.

### TODO
- Record contract notes per router as features are implemented or refactored.
