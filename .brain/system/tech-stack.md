# Tech Stack

## Purpose
Captures the main technologies in use so implementation and debugging choices stay aligned with the actual stack.

## How To Use
- Update when core libraries, frameworks, or infrastructure choices change.
- Prefer listing technologies already present in package manifests.
- Keep versions optional unless they matter for migrations or debugging.

## Template

### Workspace
- Package manager: Bun
- Monorepo tooling: Turborepo
- Language: TypeScript

### Mobile
- Expo
- React Native
- Expo Router
- NativeWind
- Zustand
- TanStack React Query
- tRPC client

### Web
- Next.js
- React 19
- Tailwind CSS
- Radix/headless component libraries

### Backend
- Hono
- tRPC
- Zod
- Bun and Node entry points

### Data And Infra
- Prisma
- PostgreSQL
- Trigger.dev
- Better Auth
- Vercel-related deployment/tooling dependencies
