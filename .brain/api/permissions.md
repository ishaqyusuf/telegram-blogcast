# API Permissions

## Purpose
Documents authentication and authorization expectations across the API surface.

## How To Use
- Update when auth middleware, role checks, or protected routes change.
- Keep detailed per-route enforcement notes here if they are not obvious from code.
- Reference middleware and auth package locations directly.

## Template

### Current Signals In Code
- Standalone API provider credentials are configured as encrypted Vercel Preview/Production variables with explicit user approval. Only existing database, Telegram, Blob, DeepSeek, and Trigger credentials were copied; Expo receives public service origins. Preview continues to share Production services/data.
- Hosted standalone tRPC permits browser CORS from `https://alghurobaa.vercel.app` and explicit `ALLOWED_API_ORIGINS`; unrelated origins receive no allow-origin header. Development accepts local browser origins. Native requests preserve existing route permissions. Vercel preview deployment protection remains enabled.
- `blog.updateMediaTitleOverride` currently uses the existing public blog-router procedure, matching adjacent write routes. It validates media type but does not enforce a per-user edit permission; adding scoped auth remains a separate API security change.
- Auth-related middleware exists at `apps/api/src/trpc/middleware/auth-permission.ts`.
- Shared auth functionality also exists in `packages/auth`.
- Better Auth is present in app dependencies and project docs.
- Local gateway discovery reads are public so preview builds can resolve the
  active lease. `PUT` and `DELETE` require a constant-time-checked bearer token
  from `LOCAL_SERVICES_DISCOVERY_TOKEN`; the token is never shipped in Expo.

- `bookSource.start/retry/cancel` require a valid `x-book-import-token`; only the installation that started an import may retry/cancel it or read its error details. Anyone may read compact status. Starts are limited to 20 per installation per hour and 10 generations per job.
- Provider books are not editable through page/book edit routes; personal highlights, comments and audio references remain allowed. `canExportBookContent` is false for any book with `sourceProvider`.

### Questions To Maintain
- Which routes are public vs authenticated?
- Are there admin/moderation capabilities in the web surface?
- What permissions differ between mobile user flows and internal/admin flows?

### Documentation Rule
- When adding or changing route protection, update this file in the same change set.
