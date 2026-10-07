# Component releases and standalone API hosting

## Status
Accepted; Production API verified, Preview mobile release in progress.

## Context
The user requested the operational release flow used by GND, Halaalvest, and EwaTrade, plus independent API deployment. The existing SHA-pinned release assurance integration only plans/verifies; it does not deploy. API source already exists under `apps/api` but is executed inside Next.js in hosted use.

## Decision
- Add the same sibling `local-infra-kit/bin/infra.ts release` entry and a root `release.config.ts`. Track database, API, web, jobs, and Android independently with the shared release tags. Retain the signed assurance commands as separate, fail-closed checks.
- Own Vercel API project `alghurobaa-api` (`prj_ScB6lVbLlEKjp5RHVXnqG6dac5Tw`) in the existing team. Use Vercel's supported Hono/Bun runtime and bundle workspace/TypeScript aliases with Bun; regenerate pinned Prisma 7.7.0 on every build. Install only the API and its explicitly selected transitive workspaces with a frozen lockfile; shared packages declare runtime dependencies rather than relying on web/mobile hoisting.
- CLI deployments upload a clean, exact-revision Git archive in a temporary directory with a pinned API project link, read structured CLI deployment output, verify Vercel ownership/revision/Ready state, and check application health. Preserve the root web link and protected preview deployment settings.
- Expo's API/tRPC origin becomes the standalone API; web remains the owner of Better Auth, Blob token exchange, Telegram file proxy, and local-gateway discovery. Existing web tRPC URLs remain compatible during migration.
- Preview mobile uses the existing shared production data/backend policy. No isolated Preview database or Trigger worker exists. Database and jobs release components are Production-only until that isolation is provisioned; do not call shared infrastructure an isolated Preview release.
- Keep the current `runtimeVersion: { policy: "appVersion" }` for compatibility with installed binaries. The shared release command requires a matching finished native fingerprint before automatic OTA; do not change runtime policy as part of this JavaScript feature release.

## Consequences
`bun release` needs the sibling kit checkout on the operator machine, exactly like the reference projects; cloud install does not depend on the private kit. Versions are prepared and committed before release; expected-revision EAS commands do not mutate source. Device/emulator testing is excluded by the user's current instruction.
