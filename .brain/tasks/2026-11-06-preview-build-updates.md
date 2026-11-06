# Preview OTA, native build and in-app build updates

- Status: In Progress
- Created: 2026-11-06
- Updated: 2026-11-06
- Scope: Publish a fresh Preview OTA, prepare a fresh Android Preview build, and adapt the existing EwaTrade/GND native-build discovery pattern so future APK releases can be offered in the app through the existing API/database. Register the verified build. Preserve current projects, URLs, credentials and database connection settings.
- Source: Current committed audio improvements, with unrelated working changes preserved. Use a clean temporary release clone, never a Git worktree. User approved building first and delivering the new updater through a subsequent OTA.

## Findings

- This app currently implements launch/foreground EAS OTA checks and an App updates screen, but no APK release registry or native-build discovery UI.
- Existing Preview build `22b77417-4309-4df5-af67-52b2cb5c8158` is FINISHED: app/runtime `1.0.112`, Android versionCode `27`. Provider expiration is `2026-11-11T16:48:36.953Z`; its APK URL returned HTTP 206 with a valid ZIP/APK prefix on November 6.
- Artifact expiry concerns Expo's retained download. Installed Android apps remain eligible for compatible OTA updates; a channel/runtime mismatch can prevent delivery independently of artifact availability.
- Last published OTA `ae47d36a-d12d-4d2b-a2c8-13dbf1f515fc` targets Preview runtime `1.0.112`. Installed device version/runtime/channel requested from the user; not yet known.
- Reference repositories: `/Users/M1PRO/Documents/code/ewatrade` and `/Users/M1PRO/Documents/code/_turbo/gnd` (read-only reference use).

## Checklist

- [x] Verify current APK provider status and download availability.
- [x] Publish and read back fresh Preview OTA.
- [ ] Start and verify fresh Android Preview build.
- [x] Implement and test native-build discovery and registration using reference patterns.
- [ ] Deploy existing API changes and register verified build.
- [ ] Publish updater OTA and verify delivery.
- [ ] Commit release evidence and update Brain ledgers.

## Documentation impact

Feature, API, database and ADR documentation describe the native-build registry; service configuration remains unchanged.

## Initial delivery and implementation evidence

- Fresh OTA group `224ec7c8-dfc4-40d7-991c-ce65d5e7095e`, Android update `01a1af53-9b54-7940-a1e2-34bd5dd37494`, source `dcc6adf8917a7634d059cee8c8b6bdb3ddc0acce`, label `2026.11.06`, runtime `1.0.112`. Public Preview manifest returned that exact update ID on November 6.
- Native build `a86d38dd-cbd3-4187-a15f-63ffd70f3f58` submitted from the same source, app/runtime `1.0.112`, Android build 28. Existing remote Preview keystore retained. Provider expiry `2026-11-20T05:27:42.797Z`. Compilation in progress.
- Eight focused tests / 52 assertions passed: scope/version/expiry validation, provider identity, APK package checks, registration-after-build sequencing, retry without rebuilding, and real-database registry transactions. The integration test's writes rolled back; registry was empty afterward.
- Prisma schema diff contained only `CREATE TABLE MobileBuildRelease`; root and push connection targets matched. `bun db:migrate` first hit the existing Turbo interactive-task configuration; its direct Prisma task then refused existing migration-history drift with exit 130. No reset or migration file was created. `bun db:push --ui=tui` succeeded after the sandbox permitted Bun's cache writes; existing data/settings unchanged.
- Working-checkout TypeScript still reports 74 existing diagnostics, none in the added updater modules. Focused Biome passes. Final clean-source build/export and delivery readback pending.
- Native UI acceptance remains with the user in Preview, following their release-for-testing instruction; automated contract/database checks do not prove installed-device behavior.
