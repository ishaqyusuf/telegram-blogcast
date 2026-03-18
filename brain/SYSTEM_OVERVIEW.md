# System Overview

## Purpose
High-level view of what this repository does, which runtime surfaces exist, and how data moves across the system.

## How To Use
- Read this before architecture or feature work.
- Update it when the primary product scope or major platform boundaries change.
- Keep implementation details in section-specific files; this file should stay concise.

## Template

### Product Summary
- Repository: `al-ghurobaa`
- Current positioning from repo docs: Islamic content and learning platform with blog, audio, books, comments, and channel-driven content experiences.
- Historical framing from `README.md`: Telegram content ingestion into a personal learning library.

### Runtime Surfaces
- Mobile app: `apps/expo-app` using Expo Router, React Native, NativeWind, Zustand, React Query, and tRPC client integration.
- Web app: `apps/www` using Next.js App Router style structure, React 19, Tailwind, and shared workspace packages.
- API: `apps/api` using Hono, tRPC, Zod, Prisma, and Bun/Node entry points.
- Shared packages: `packages/auth`, `packages/blog`, `packages/db`, `packages/jobs`, `packages/telegram`, `packages/trigger`, `packages/ui`, `packages/utils`.

### Data Flow
1. Content is created, synced, or managed through API and job layers.
2. Prisma models in `packages/db` define persistent data in PostgreSQL.
3. `apps/api` exposes tRPC and REST endpoints for app/web clients.
4. `apps/expo-app` and `apps/www` fetch data through typed clients and render the user experience.

### Source Documents
- `README.md`
- `brain/features/books.md`
- `brain/features/audio.md`
- `brain/features/blog.md`
- `brain/engineering/design-language.md`
- Workspace `package.json` files
