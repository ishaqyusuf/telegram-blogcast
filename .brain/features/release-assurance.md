# Release assurance

## Purpose

Turn repository changes into an ordered Preview or Production release plan and
verify that every required deployment is current for the exact Git revision.

## Targets

- PostgreSQL-backed modular Prisma schema using the existing push-only workflow
- Combined web/API Vercel project `al-ghurobaa-media-t3`
- Android Expo project `9d8a8cd8-d310-4724-8a61-db39e6b56c9a`
- Trigger jobs project `proj_ryiraaguagaettphjklm`

The manifest treats `apps/api` as part of the single Vercel deployment rooted
at `apps/www`; it does not invent a separate API project. Mobile classification
distinguishes compatible OTA updates from native Android rebuilds. Database
proof is required before dependent web and jobs releases can pass.

## Local commands

```bash
bun run release:plan --env preview
bun run release:status --env preview
bun run release:check --env preview
```

Replace `preview` with `production` for Production. Plan/status are read-only
and advisory. Check requires protected signed provider evidence and fails
closed when evidence is missing, stale, tampered, or for another revision.

## Activation state

Source integration and fake-provider Preview/Production verification are
complete. Live activation remains pending protected environments/rulesets, an
authenticated evidence collector, isolated Preview database/backend wiring,
Vercel promotion control, and isolated Trigger Preview ownership or an approved
short-lived waiver. Preview Expo currently uses the Production web origin, so
it is not accepted as an isolated end-to-end Preview environment.
