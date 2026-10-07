# Release orchestration, standalone API, and channel scrolling

## Status
In Progress

## Dates
- Created: 2026-10-07
- Updated: 2026-10-07

## Scope and phases
1. Compare GND, Halaalvest (`halaal-coperative`), and EwaTrade release implementations; integrate their shared `local-infra-kit` component release command.
2. Deploy `apps/api` as a separate Vercel project, preserve web-owned media/auth/local-discovery services, update Expo's hosted API URLs, and verify release execution.
3. Add search to channel sync/list surfaces and use the existing scroll chrome to hide the pinned audio bar across scrollable screens.
4. Verify builds, API and release behavior, review changes, and reconcile Brain docs. Mobile device/emulator/UI tests are explicitly excluded by the user for this task.

## Progress
- Reference comparison complete: all three use `release.config.ts` and `local-infra-kit/bin/infra.ts release`; the existing vendored assurance tooling is a separate verification-only flow.
- Existing API source is hosted inside Next.js; its old standalone Bun custom-runtime build requires Docker and needs replacement for independent hosting.
- Working tree was clean at task start.
- Standalone Hono/Bun deployment, clean-revision archive helper, component config, and separate Expo API/web origins implemented.
- Channel sync/list search and shared focused-screen scroll surfaces implemented. Existing scroll-chrome screens retain their handlers.
- Production API deployment explicitly approved; mobile target remains Preview.
- API build uses pinned Prisma 7.7.0. The provider's Bun 1.3.x does not support the dependency-relation filter syntax in newer documentation; cloud install now explicitly selects the API and its seven transitive workspace dependencies.

## Verification
- Bun API bundle and local `/health` pass. A separate fresh Git archive install/build also passes after declaring `bcrypt-ts`, `dayjs`, and `dot-object` as actual shared utility dependencies; cloud installs use the frozen lockfile.
- Eight API CORS and five-target release assurance tests pass; four Node release-source/provider-output regressions pass.
- `bun release status/plan --preview` detects separate API, web, and Android obligations and selects a new Android build because no finished Preview fingerprint matches.
- Production API `https://alghurobaa-api.vercel.app` deployed at `d93eed96d` (full revision in provider metadata); public health, 168-channel database read, permitted web preflight, and unrelated-origin CORS rejection pass. The helper now reads explicit JSON CLI output, avoiding failure after a successful deployment.
- New Vercel API project created and initial database connection configured. Additional backend credential transfer requires explicit approval after automatic review rejected the expanded local secret payload.
- Automatic review rejected disabling Vercel SSO; protection remains enabled, with authenticated CLI checks planned for preview deployments.
- Expo Preview remote `EXPO_PUBLIC_BASE_URL` and `EXPO_PUBLIC_TRPC_URL` updated to the standalone production API; `EXPO_PUBLIC_WEB_URL` stays on web for auth/media/discovery.
- Scoped Expo lint passes; Android JavaScript/Hermes export succeeds. Repository-wide Expo typecheck has existing diagnostics (including test Bun types and older components); no diagnostics remain in the new search/scroll implementation.
- User selected Preview for mobile publication. No mobile tests run.

