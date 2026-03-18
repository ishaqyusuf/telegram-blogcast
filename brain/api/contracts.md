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

### TODO
- Record contract notes per router as features are implemented or refactored.
