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
- [ ] Publish and read back fresh Preview OTA.
- [ ] Start and verify fresh Android Preview build.
- [ ] Implement and test native-build discovery and registration using reference patterns.
- [ ] Deploy existing API changes and register verified build.
- [ ] Publish updater OTA and verify delivery.
- [ ] Commit release evidence and update Brain ledgers.

## Documentation impact

Release evidence belongs here. Feature/API/database/decision documentation will be updated with the final native-build registry design. No schema or service configuration has changed during initial diagnosis.
