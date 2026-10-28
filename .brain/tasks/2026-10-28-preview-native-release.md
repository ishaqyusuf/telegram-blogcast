# Android Preview Native Release — 2026.10.28

- Status: Waiting — EAS native Preview build queued
- Created: 2026-10-28
- Updated: 2026-10-28
- Request: “release preview.”
- Scope: Release the current tested mobile workspace as a new Android Preview APK. No API/web/database/jobs deployment or Git push. Preserve unrelated working-tree changes without committing them.
- Fixes: [native scroll renderer and Digital Books viewport](2026-10-28-android-scroll-rendering.md), accepted by the user on the Samsung.
- Delivery: Native rebuild is mandatory for the Reanimated C++ patch. Advance native app/runtime from `1.0.111` to `1.0.112`; display label `2026.10.28`. The existing appVersion runtime policy isolates the new binary from older Preview OTAs. Existing Preview installations require the new APK.
- Source policy: Established direct mobile release workflow, as used for [October 25 Preview](2026-10-25-preview-ota.md), includes the tested dirty workspace. Record a source hash manifest; commit only this release's version, packaging and Brain changes. Do not claim an exact clean-Git or signed whole-stack release.
- Environment: Preview profile/channel and existing hosted API/web configuration. Preview data is shared with the existing hosted service. No development dotenv public URLs are inherited by the account runner.
- Archive: Inspect before upload; omit QA captures, agent state, local exports/caches/personal notes, dotenv/signing files, and Git objects. Native patch and app/shared build inputs remain included.
- Preflight: 318 tests / 1028 assertions pass across 62 mobile regression files. Native optimized build and Samsung/emulator/large-text verification passed during the implementation task.
- Assurance: `release:status --env preview` is advisory, with missing signed baselines and native-unknown. This scoped direct EAS build does not activate or bypass the separate signed assurance collector.

## Checklist

- [x] Inspect source, previous Preview build, runtime compatibility and release configuration.
- [x] Run fresh mobile regression tests.
- [x] Verify final upload archive and record source manifest.
- [ ] Build Android Preview with existing credentials and a new runtime.
- [ ] Read back provider metadata and inspect the APK.
- [ ] Install and verify the actual Preview artifact on available Android hardware.
- [ ] Record release link and complete Brain tracking.

Archive inspection verified 1452 files (83.3 MiB); native patch, version configuration, lockfile and Books screen match the tested checkout. Source hashes: `artifacts/preview-native-2026-10-28/archive-source-manifest.json`.

## Build submission

- Build `22b77417-4309-4df5-af67-52b2cb5c8158` submitted to EAS Android Preview: app/runtime `1.0.112`, versionCode `27`, channel `preview`, source revision `ebfeab407dbd33655ea9d2a79ec9a0b9b007c2dc` plus the recorded tested working-tree snapshot.
- [EAS build](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/builds/22b77417-4309-4df5-af67-52b2cb5c8158). Existing remote Preview signing credentials retained.
- Preview update endpoint returned HTTP 204 for runtime `1.0.112`; no older runtime manifest was served.
