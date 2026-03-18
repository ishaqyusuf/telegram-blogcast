# API Endpoints

## Purpose
High-level map of the API surface and where endpoint logic lives.

## How To Use
- Update when routers or major REST surfaces are added, removed, or renamed.
- Keep this file navigational; detailed payloads belong in `contracts.md`.
- Link route-specific feature docs when they exist.

## Template

### Primary API Surface
- `apps/api` is the main backend application.
- tRPC routers live under `apps/api/src/trpc/routers`.
- Additional server query logic lives under `apps/api/src/queries`.

### Known Router Domains
- Albums
- Blogs
- Books
- Channels
- Podcasts
- App/root router composition

### Current Documentation Gap
- Expand this file with endpoint-by-endpoint summaries as features are touched.
