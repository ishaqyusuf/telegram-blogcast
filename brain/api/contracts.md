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

### TODO
- Record contract notes per router as features are implemented or refactored.
