# Plan: Local Blog Import Screen And Background Import Control

## Type
Feature

## Status
Implemented

## Created Date
2026-06-15

## Last Updated
2026-06-15

## Completion Notes
- Added Expo `/blog-import` screen with LAN API URL detection, manual persisted URL fallback, health check, channel list, sync, toggle fetchable, start import, stop import, and fetcher-state polling.
- Added API `GET /health` for mobile/local reachability checks.
- The import remains owned by the local API process, so it can continue after the mobile app is minimized.
- Compiled APK/dev-client use is supported by manual LAN base URL entry when Expo host metadata is unavailable.

## Intake
- Intake File: brain/intake/2026-06-15-blog-audio-organization-import.md
- Intake Item: Blog import screen should detect local API via network IP, list channels, start import through existing web/API flow, work in compiled APK and local Expo, and continue while minimized.

## Goal Or Problem
Provide a mobile blog import control screen for local-only Telegram/channel ingestion, using the same local network IP approach as existing Expo API URL resolution while keeping import work in the local API process so it can continue after the mobile app is minimized.

## Current Context
The Expo app resolves local API URLs in `apps/expo-app/src/lib/base-url.ts` using `Constants.expoConfig?.hostUri` and ports such as `3006`. The API has `channel.getChannels`, `channel.syncChannels`, `channel.toggleFetchable`, `channel.startFetch`, `channel.stopFetch`, and `channel.getFetcherState`. Web dashboard already uses these procedures in `apps/www/src/app/dashboard/page.tsx`. Android cleartext traffic is enabled in `apps/expo-app/app.config.ts`. Compiled APK builds may not have `Constants.expoConfig?.hostUri`, so a manual persisted local API URL fallback is needed.

## Proposed Approach
Create a mobile `/blog-import` screen that derives the local API base URL from the existing network IP resolver when possible, checks whether the API is reachable, and then exposes channel sync/import controls. The mobile app starts and monitors import, but the API process owns the actual Telegram fetcher so import continues when the app is minimized. Add a manual fallback local API URL setting for compiled APKs.

## Implementation Steps
- Extract or reuse local host helpers from `apps/expo-app/src/lib/base-url.ts` so the import screen can show the resolved `networkIp`.
- Add a persisted local API URL setting for compiled APK/dev-client fallback when `hostUri` is unavailable.
- Add a lightweight API health endpoint if the current root response is insufficient for mobile checks.
- Create `/blog-import` route and screen in Expo Router.
- On screen open, health-check `http://<networkIp>:3006` or saved URL and show "local API not running" setup instructions if unreachable.
- When reachable, list channels from `channel.getChannels`.
- Include actions for `syncChannels`, `toggleFetchable`, `startFetch`, `stopFetch`, and fetcher state polling.
- Show current fetcher status, active channel, fetched count, retry/error state, and last update.
- Persist selected local API URL and expose edit/reset action.
- Add minimized behavior note in UI: import continues in the local API process after start; mobile status may refresh when app resumes.
- Optionally add best-effort background status polling only if Expo background task support is already acceptable for the build profile.

## Affected Files Or Areas
- `apps/expo-app/src/lib/base-url.ts`
- `apps/expo-app/src/app/_layout.tsx`
- `apps/expo-app/src/app/blog-import.tsx`
- `apps/expo-app/src/screens`
- `apps/expo-app/src/store/app-settings-store.ts`
- `apps/api/src/index.ts`
- `apps/api/src/trpc/routers/channel.route.ts`
- `apps/api/src/queries/channel.ts`
- `apps/www/src/app/dashboard/page.tsx`
- `brain/features/blog.md`
- `brain/api/contracts.md`
- `brain/system/architecture.md`

## Acceptance Criteria
- In local Expo, the import screen automatically resolves the same network IP used by current local API targeting.
- If the API is not running, the screen shows actionable instructions including `bun --filter @acme/api dev` and port `3006`.
- If the API is running, the screen lists channels and can start/stop import via existing API procedures.
- In compiled APK/dev-client where host URI is unavailable, the user can enter and persist a local API URL.
- Import continues in the local API process after the app is minimized once started.
- On app resume, the screen can show current fetcher state.

## Test Plan
- Run `bun --filter @acme/api typecheck`.
- Run Expo app typecheck if configured.
- Start local API on port `3006`; open screen in Expo and verify auto-detection.
- Stop local API and verify not-running instructions.
- Test manual URL entry path by forcing resolver failure or using compiled/dev-client environment.
- Start channel import, minimize app, return, and verify fetcher state reflects server progress.

## Brain Update Requirements
- Update `brain/features/blog.md` with local-only import behavior.
- Update `brain/api/contracts.md` with local API health/import control expectations.
- Update `brain/system/architecture.md` to document that Telegram import runs in the API process, not in the mobile process.

## Lower-Agent Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Required checks are listed: Yes
- Brain update requirements are listed: Yes
- Ready for handoff: Yes

## Completion Report Requirements
Lower agent must report:
- Changed files
- Checks run
- Brain docs updated
- Unresolved issues
- Any skipped acceptance criteria

## Risks / Edge Cases
- `Constants.expoConfig?.hostUri` can be unavailable in compiled APK builds.
- Device and development machine must be on the same LAN and firewall must allow API traffic.
- Expo background tasks are not reliable for continuous import; import should remain server-owned.
- API may require CORS/cleartext configuration for mobile LAN access.

## Open Questions
- TODO: Confirm whether mobile should show notifications for import progress or only status on screen/resume.

## Linked Task
- Task Title: Local Blog Import Screen And Background Import Control
- Task File: brain/tasks/roadmap.md
