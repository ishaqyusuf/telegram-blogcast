# Release orchestration, standalone API, and channel scrolling

## Status
Done

## Dates
- Created: 2026-10-07
- Updated: 2026-10-08
- Completed: 2026-10-08

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
- Eight API CORS and five-target release assurance tests pass; six Node release-source/provider-output/CLI-selection regressions pass.
- `bun release status/plan --preview` detects separate API, web, and Android obligations and selects a new Android build because no finished Preview fingerprint matches.
- Production API `https://alghurobaa-api.vercel.app` is Ready; public health, 168-channel database read, permitted web preflight, and unrelated-origin CORS rejection pass. The helper reads explicit JSON CLI output, including Vercel's automatic agent envelope.
- New Vercel API project created. User approved the additional credential copy; nine existing database/Telegram/Blob/DeepSeek/Trigger variables are configured as encrypted Preview/Production project variables without displaying values. Redeployment with the approved credentials became Ready at `2adaef1c509082e9793a7d35ed0f9f1a80fa501b`; public health/database/CORS checks pass again.
- Vercel Preview protection remains enabled. Authenticated CLI health and database checks pass against the API Preview deployment, including the 168-channel query.
- Expo Preview remote `EXPO_PUBLIC_BASE_URL` and `EXPO_PUBLIC_TRPC_URL` updated to the standalone production API; `EXPO_PUBLIC_WEB_URL` stays on web for auth/media/discovery.
- Scoped Expo lint passes; Android JavaScript/Hermes export succeeds. Repository-wide Expo typecheck has existing diagnostics (including test Bun types and older components); no diagnostics remain in the new search/scroll implementation.
- User selected Preview for mobile publication. No mobile tests run.
## Published release
- `bun release --preview --only api,web,mobile-android --yes` completed successfully. A resumed run skipped the completed web component and deployed API/Android; the API helper follows the kit's global-provider preference when invoked through Bun.
- Web Preview: `https://al-ghurobaa-media-t3-79kicsgrt-ishaqyusufs-projects.vercel.app`, Ready at `ea4ae0693d8ecc314f06ceb50556b4c4e95ecfb2`.
- API Preview: `https://alghurobaa-dnstsraju-ishaqyusufs-projects.vercel.app`, Ready and healthy at `52451d156e8756748528b5e06e18a8f3150dd1cd`. Mobile uses the public Production API origin above, under the existing shared-data policy.
- Android Preview build `c52aeba2-6291-4035-ba85-6a2bcbaeff3c`: FINISHED on 2026-10-07 at `52451d156e8756748528b5e06e18a8f3150dd1cd`, app `1.0.111`, Android versionCode `26`. No matching finished native fingerprint existed, so the workflow selected a new APK instead of OTA.
- Install: https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/builds/c52aeba2-6291-4035-ba85-6a2bcbaeff3c
- Remote `release/preview/api` and `release/preview/mobile-android` tags point to `52451d15`; `release/preview/web` points to `ea4ae069`. Final scoped status on October 8 reports all three up to date and nothing to release.
- Mobile device/emulator/UI tests remain intentionally unrun. The signed assurance collector activation is separate and still pending its previously documented infrastructure; this completed operational release does not claim isolated Preview services or signed assurance activation.

## Brain documentation impact
- Architecture: `.brain/system/architecture.md`.
- API: `.brain/api/endpoints.md`, `.brain/api/contracts.md`, `.brain/api/permissions.md`.
- Features: `.brain/features/release-assurance.md`, `.brain/features/blog.md`, `.brain/features/audio.md`.
- Operations and decision: `.brain/runbooks/release-assurance.md`, `.brain/decisions/2026-10-07-component-release-and-standalone-api.md`.
- Execution: this task, `.brain/tasks/in-progress.md`, `.brain/tasks/done.md`.
- No database schema, relationship, or migration change was needed.
