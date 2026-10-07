# Release assurance

## Purpose

Turn repository changes into an ordered Preview or Production release plan and
verify that every required deployment is current for the exact Git revision.

## Targets

- PostgreSQL-backed modular Prisma schema using the existing push-only workflow
- Web Vercel project `al-ghurobaa-media-t3`
- Standalone API Vercel project `alghurobaa-api`
- Android Expo project `9d8a8cd8-d310-4724-8a61-db39e6b56c9a`
- Trigger jobs project `proj_ryiraaguagaettphjklm`

The assurance manifest verifies API and web separately. Mobile classification distinguishes compatible OTA updates from native Android rebuilds. Database proof is required before dependent API, web, and jobs releases can pass.

## Operational release

The root `release.config.ts` uses the same local-infra-kit command as GND, Halaalvest, and EwaTrade:

```bash
bun release status --preview
bun release plan --preview
bun release --preview
```

Main defaults to Production; `--preview` selects the release-owned preview branch. Changes are tracked with separate `release/<environment>/<component>` tags. Database precedes API/web/jobs; Android publishes an OTA only when a matching finished native build exists. Database and jobs are Production-only until isolated Preview infrastructure exists. Prepare/commit the update version before release. The API helper uploads only committed files and checks provider identity, revision, Ready state, and health.

The operational command needs the sibling `../local-infra-kit` checkout, matching the reference projects. The signed assurance commands below remain a distinct, verification-only boundary.

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
short-lived waiver. Preview Expo uses the standalone Production API for data and the Production web origin for auth/media/discovery, so it is not accepted as an isolated end-to-end Preview environment.
