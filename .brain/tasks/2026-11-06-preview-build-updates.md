# Preview OTA, native build and in-app build updates

- Status: Released — native build verified/registered; API and updater OTA live
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
- [x] Start and verify fresh Android Preview build.
- [x] Implement and test native-build discovery and registration using reference patterns.
- [x] Deploy existing API changes and register verified build.
- [x] Publish updater OTA and verify delivery.
- [x] Commit release evidence and update Brain ledgers.

## Documentation impact

Feature, API, database and ADR documentation describe the native-build registry; service configuration remains unchanged.

## Initial delivery and implementation evidence

- Fresh OTA group `224ec7c8-dfc4-40d7-991c-ce65d5e7095e`, Android update `01a1af53-9b54-7940-a1e2-34bd5dd37494`, source `dcc6adf8917a7634d059cee8c8b6bdb3ddc0acce`, label `2026.11.06`, runtime `1.0.112`. Public Preview manifest returned that exact update ID on November 6.
- Native build `a86d38dd-cbd3-4187-a15f-63ffd70f3f58` submitted from the same source, app/runtime `1.0.112`, Android build 28. Existing remote Preview keystore retained. Provider expiry `2026-11-20T05:27:42.797Z`. Completed and verified below.
- Eight focused tests / 52 assertions passed: scope/version/expiry validation, provider identity, APK package checks, registration-after-build sequencing, retry without rebuilding, and real-database registry transactions. The integration test's writes rolled back; registry was empty afterward.
- Prisma schema diff contained only `CREATE TABLE MobileBuildRelease`; root and push connection targets matched. `bun db:migrate` first hit the existing Turbo interactive-task configuration; its direct Prisma task then refused existing migration-history drift with exit 130. No reset or migration file was created. `bun db:push --ui=tui` succeeded after the sandbox permitted Bun's cache writes; existing data/settings unchanged.
- Working-checkout TypeScript still reports 74 existing diagnostics, none in the added updater modules. Focused Biome passes. Clean-source build/export and delivery readback completed below.
- Native UI acceptance remains with the user in Preview, following their release-for-testing instruction; automated contract/database checks do not prove installed-device behavior.

## Updater release

- Implementation commits `452bd4e9` and `7b9fe32b`; release source `7b9fe32b802fe3ab877ec90d54119836e6f635e9`.
- Existing API deployed and verified Ready/healthy at `https://alghurobaa-api.vercel.app`; immutable deployment `https://alghurobaa-ay4aksh0d-ishaqyusufs-projects.vercel.app`. No project, URL, environment or database connection setting changed. Public `mobileBuild.check` returned HTTP 200 with an empty registry before APK registration.
- Updater OTA group `7bd2c2cc-010a-4272-a2b7-843a9a7f2078`, Android update `01a1af63-4519-70cf-b911-6cd30ab9e1fe`, created `2026-11-06T05:44:40.985Z`, label `2026.11.06`, Preview runtime `1.0.112`. Public channel manifest returned that exact ID and label. This supersedes the initial November 6 OTA above.
- Clean-source API build, release-runner bundle and seven non-database tests passed. Post-push schema diff is empty. Clean-source full TypeScript retains 70 baseline diagnostics, none in updater modules; no full-typecheck pass is claimed. Android Hermes export succeeded during OTA publication.

## Native build and registry verification

- Build 28 FINISHED at `2026-11-06T05:48:45.875Z`. [Build page](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/builds/a86d38dd-cbd3-4187-a15f-63ffd70f3f58), [APK](https://expo.dev/artifacts/eas/XrJOOG1rvWr62DXiKDMFsY48mbjKj773TaWpXuSTUBg.apk).
- Exact EAS owner/project/profile/channel/distribution/source validated. The downloaded APK was verified with Android `aapt`: package `com.alghurobaa.podcast.preview`, versionCode 28. Size `314969469` bytes; SHA-256 `876c6a9a556fb260fb8a0fe510d2f0accde58aef60f29a4c409d1b6941e4d150`.
- Registered in the existing database as active revision 1 at `2026-11-06T05:50:22.576Z`; read back independently. Artifact expiry `2026-11-20T05:27:42.797Z`.
- Six live API checks passed: older Preview build 27 receives build 28; installed builds 28 and 29, production channel, another package, and iOS receive null. Every request returned HTTP 200. No live content records were changed.
- The APK embeds source `dcc6adf8`; the later updater OTA `7b9fe32b` matches its runtime and is delivered automatically through the existing launch/foreground flow. A phone still on runtime `1.0.111` must install this APK once; no incompatible OTA is published to that runtime.
- User's installed runtime/channel was not supplied, so the original handset-specific delivery failure is not conclusively diagnosed. The previous build's artifact was demonstrably still downloadable, and both fresh OTA delivery and native-build discovery are verified server-side.
- Brain impact: feature, ADR, API contracts/endpoints/permissions, database schema/migration notes, dedicated task and task ledgers updated. No new project, URL, deployment environment, secret, native dependency, or database connection setting.
