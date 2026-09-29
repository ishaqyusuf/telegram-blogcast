# Web Production Build Uses Webpack

- Date: 2026-09-29
- Status: Accepted

## Context

The production deployment of commit `243b4748` failed in Next.js 16.3.0 Turbopack while resolving the existing `next/font/google` imports on the blog page. This prevented the new tRPC rename route from reaching production.

## Decision

Use `next build --webpack` for the web production build. Keep the current font imports and page appearance. Continue using the existing development command.

## Verification

`NODE_ENV=production bunx next build --webpack` completed locally, including the `/api/trpc/[...trpc]` route.

## Follow-up

Revisit Turbopack after its font-resolution issue is fixed and a production build succeeds.
