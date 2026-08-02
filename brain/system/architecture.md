# Architecture

## Purpose
Documents the main architectural decisions, runtime boundaries, and integration patterns used across the monorepo.

## How To Use
- Update when changing how apps communicate, where domain logic lives, or how shared code is organized.
- Add an ADR in `brain/decisions/` for significant long-term changes.
- Keep examples concise and tied to current code locations.

## Template

### Current Architecture
- Monorepo orchestration: Bun workspaces + Turborepo.
- Client surfaces: Expo app and Next.js web app.
- Server surface: Hono API with tRPC routers and REST helpers.
- Persistence: Prisma models targeting PostgreSQL.

### Integration Pattern
- Shared packages provide reusable domain logic, auth helpers, utilities, DB access, and UI primitives.
- Clients consume typed APIs instead of talking to the database directly.
- Database schema is split into domain-focused Prisma files under `packages/db/src/schema`.
- Expo media uploads use the Next.js web surface for Vercel Blob client-upload token exchange, then persist media ownership through the shared tRPC API.
- Local Telegram/channel import runs in the Hono API process. Expo can start, stop, and monitor import through tRPC over the LAN, but the mobile process does not import channel data itself.
- Facebook saved-post discovery has two authenticated capture surfaces: a repository Codex skill using the desktop in-app browser and an Expo WebView using the device session. Both produce the same validated incremental capture contract; the local API exclusively owns JSON merge and database import.
- The `apps/www` development supervisor owns Next.js, the transcriber, and an optional ngrok tunnel. The assigned public URL is emitted in the existing web task pane, and every child process shares the task lifecycle.
- The Expo root owns OTA route continuity through a navigation restoration
  provider. Before any app-owned `expo-updates` reload, it stores a bounded,
  versioned stable-route descriptor in AsyncStorage; the updated bundle
  validates update identity, expiry, route policy, and launch-link precedence
  before consuming and restoring that descriptor once.

### Architectural Constraints
- Favor shared workspace packages over duplicated app-local business logic.
- Preserve typed contracts between API and clients.
- Keep mobile and web implementations decoupled at the UI layer but aligned on domain contracts.
- Local-only features that depend on development libraries should stay behind LAN/local API flows so production-hosted web and compiled mobile builds do not need those libraries bundled.
