# API Permissions

## Purpose
Documents authentication and authorization expectations across the API surface.

## How To Use
- Update when auth middleware, role checks, or protected routes change.
- Keep detailed per-route enforcement notes here if they are not obvious from code.
- Reference middleware and auth package locations directly.

## Template

### Current Signals In Code
- Auth-related middleware exists at `apps/api/src/trpc/middleware/auth-permission.ts`.
- Shared auth functionality also exists in `packages/auth`.
- Better Auth is present in app dependencies and project docs.

### Questions To Maintain
- Which routes are public vs authenticated?
- Are there admin/moderation capabilities in the web surface?
- What permissions differ between mobile user flows and internal/admin flows?

### Documentation Rule
- When adding or changing route protection, update this file in the same change set.
