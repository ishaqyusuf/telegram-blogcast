# Preview native-build updates

Android Preview can discover a newer APK independently of EAS OTA runtime matching. The implementation adapts EwaTrade's scope/build-number checks and browser fallback, and GND's expiry-aware download registration.

## Behavior

- Only `com.alghurobaa.podcast.preview`, Android, channel `preview` participates. Identity and build number come from the installed native application, never the OTA app config.
- Launch/foreground checks share a five-minute React Query cache; the App updates screen can explicitly refresh. Existing OTA checks and route restoration remain in place.
- A compact floating sheet offers a higher active native build. Later dismisses that registry revision for 24 hours. The App updates screen retains a manual download action.
- Before opening the download, the app rechecks the registry and requires the same unexpired revision. Android's browser/installer owns download and installation approval. This works through OTA; no new native module or install permission is added.
- The sheet waits while the OTA flow is active. Its body scrolls within a bounded height, with actions outside the scroll area.
- Expired/withdrawn/same/older/wrong-channel builds are not offered. API failure is retryable and never blocks normal app usage. Artifact expiration does not invalidate an installed Android binary or stop compatible EAS OTA delivery.

## Release operation

`bun run eas:build --preview --platform android` now waits for completion and automatically registers the exact verified APK using the existing operator database credentials. The source must be committed and clean; a temporary clean clone is used when the active checkout contains unrelated work. Do not use a Git worktree without explicit authorization.

The publisher verifies provider owner/project/profile/channel/status/commit, downloads the APK with a size/time bound, computes SHA-256, and verifies Android package/versionCode with Android SDK `aapt`. It stores Expo's actual artifact expiry. Registration is monotonic, revision-checked, serialized, and retry-safe. There is no public release-writing endpoint and no new credential/environment setting.

Recovery without another paid build:

```sh
bun scripts/mobile-build-release.ts status
bun scripts/mobile-build-release.ts publish --build-id <EAS-ID> --commit <full-SHA> --notes 'Release notes'
bun scripts/mobile-build-release.ts withdraw --revision <current-revision>
```

The public `mobileBuild.check` query reads one primary-key row. Do not expose operator credentials in mobile or silently redirect users to another app/environment. Read the [release task](../tasks/2026-11-06-preview-build-updates.md) for current delivery evidence and limitations.
