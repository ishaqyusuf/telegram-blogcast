# Project Index

## Purpose
Fast inventory of the repository so contributors and AI agents can identify where code lives before making changes.

## How To Use
- Update this when apps or packages are added, removed, or renamed.
- Link out to deeper docs instead of duplicating feature detail here.
- Keep descriptions short and operational.

## Template

### Root
- `apps/`: deployable applications.
- `packages/`: shared libraries, data, and job code.
- `brain/`: project documentation system.
- `ai/`, `gemini/`, `snippets/`: project-specific supporting assets and prompts.

### Applications
- `apps/api`: Hono + tRPC backend, Bun/Node entry points, Prisma-backed data access, and API contracts.
- `apps/expo-app`: Expo Router mobile app with screens, hooks, stores, and shared UI primitives.
- `apps/www`: Next.js web app with `src/app`, auth, providers, components, styles, and TRPC/client helpers.

### Shared Packages
- `packages/auth`: authentication helpers and configuration.
- `packages/blog`: blog-related shared logic used by clients.
- `packages/db`: Prisma schema modules, client generation, and database scripts.
- `packages/jobs`: background or async workflow code.
- `packages/telegram`: Telegram-specific integration helpers.
- `packages/trigger`: Trigger.dev-based background processing.
- `packages/tsconfig`: shared TypeScript configuration.
- `packages/ui`: shared UI library.
- `packages/utils`: shared utilities and cross-cutting helpers.

### Important Paths
- `apps/api/src/trpc/routers`: typed API routers for major domains.
- `apps/api/src/queries`: query-layer helpers and server-side data access.
- `apps/expo-app/src/app`: Expo Router route entrypoints.
- `apps/expo-app/src/screens`: screen-level mobile UI.
- `apps/expo-app/src/components`: reusable mobile components.
- `apps/www/src/app`: primary web routes.
- `packages/db/src/schema`: modular Prisma schema files by domain.

### Existing Non-Brain Task Artifact
- `brain/tasks/legacy-tasks.md`: preserved snapshot of the pre-existing single-file task tracker.
