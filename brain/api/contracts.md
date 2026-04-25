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

### TODO
- Record contract notes per router as features are implemented or refactored.
