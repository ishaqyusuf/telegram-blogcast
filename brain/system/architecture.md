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

### Architectural Constraints
- Favor shared workspace packages over duplicated app-local business logic.
- Preserve typed contracts between API and clients.
- Keep mobile and web implementations decoupled at the UI layer but aligned on domain contracts.
