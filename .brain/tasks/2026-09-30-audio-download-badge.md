# Task: Audio Download Badge Visibility

- Status: Done
- Created: 2026-09-30
- Updated: 2026-09-30
- Related task: [Media Download Controls and Audio Rename](2026-09-29-media-download-controls-and-audio-rename.md)
- Scope: Remove the completed-download check mark from feed and album audio play controls. Keep the blue saved state and the separate download/progress/retry action for unsaved audio.
- Implementation: The shared `AudioDownloadBadge` returns no UI for downloaded audio. Existing play/pause colors and offline accessibility labels remain intact.
- Verification: Focused ESLint and Biome lint pass; downloaded-audio lookup tests pass (2 tests, 3 assertions). Android verified the separate unsaved feed/album download action, progress, completion without playback, and saved blue controls with no badge in Light and Dark. Saved controls retain the offline accessibility label. [Native screenshots and checks](../../artifacts/audio-download-badge/README.md).
- Brain impact: Audio feature behavior changed. No API, database, or architecture changes; no ADR required.
- Delivery: Implementation and native screenshots committed and pushed as `64ce644ce8b3712a1c097200ee304ea550d745e3`. Android Preview OTA `2026.09.30.01` published on runtime `1.0.111`: [EAS group `bcfb0e29-1cf0-42f2-b4d1-b1b8840984d1`](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/bcfb0e29-1cf0-42f2-b4d1-b1b8840984d1), Android update `01a0f464-3906-7a6a-9d10-df7e74d4c720`. Channel readback confirmed the exact source commit, clean working tree, Preview variant, runtime, and update version. This update also includes the previously pushed audio-screen fidelity revision. Sentry automatic source-map upload was disabled for publication.
