# System Overview

## Purpose
Tracks the current shape of the system at the domain and application level.

## How To Use
- Update after major app, package, or feature boundary changes.
- Keep this aligned with `brain/SYSTEM_OVERVIEW.md`, but allow a bit more implementation detail here.
- Link deeper docs instead of expanding into exhaustive notes.

## Template

### System Boundary
- Monorepo serving mobile, web, API, and background-processing concerns.
- Main product domains currently visible in code/docs: blogs, audio, books, channels, comments/interactions, auth, and sync workflows.

### Applications
- `apps/expo-app`: primary native client.
- `apps/www`: browser-based client/admin surface.
- `apps/api`: typed API and server integrations.

### Shared Foundations
- `packages/db`: modular Prisma schema source of truth.
- `packages/auth`, `packages/utils`, `packages/ui`: reusable cross-app foundations.
- `packages/telegram`, `packages/trigger`, `packages/jobs`: ingestion and async processing layers.

### Open Questions
- Confirm whether the current source of truth for product identity is the Islamic-content framing captured in Brain feature docs, the Telegram-learning framing in `README.md`, or a combined direction.
