# Book feature release — 2026-09-25

- Feature commit: `7422e1468d6a3e81db8a8bd32adbcca1ae9907fe`, pushed to `origin/main`.
- Vercel status for the feature commit: success. The deployed recent-play endpoint returned 49 records with 49 unique media IDs.
- Android EAS Update published to the `preview` branch/channel using the `preview` environment: group `0da4f727-229f-491c-98ac-41dbd46e0c60`, update `01a0d717-bb4e-74ef-b69a-091689c66c25`, runtime `1.0.111`, release marker `2026.09.25`.
- Update dashboard: https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/0da4f727-229f-491c-98ac-41dbd46e0c60
- The latest preview Android build uses runtime `1.0.111`. The current native fingerprint differs from that build only in `extra.updateVersion`, which is update-layer metadata. No new native build was needed to update an already installed compatible preview build.
- A fresh preview Android APK was built successfully: build `1feaf280-e587-4011-9fc4-529df7256857`, version code `25`, runtime `1.0.111`, channel `preview`. Build page: https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/builds/1feaf280-e587-4011-9fc4-529df7256857
- The APK installed and launched on the Android emulator. After restoring the emulator network, the redesigned Books list loaded all 6 server books and opening a book displayed its reader content. This verifies the new-install preview path; it does not establish full offline coverage for every page.
- EAS lists no Android build on the `production` channel. A production-channel update alone would have no listed EAS production build to receive it; production distribution needs a build first.
- Release checks: 50 focused tests passed, new-file Biome check passed, staged diff whitespace check passed. Expo's Android bundle export succeeded as part of publication.
- Whole-book capture is still paused at 3 of 734 pages for book 4 after a server write timeout. No source rate limit was observed. Live Blob cover import was not exercised without an image URL.
