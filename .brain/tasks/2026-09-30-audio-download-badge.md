# Task: Audio Download Badge Visibility

- Status: In Progress
- Created: 2026-09-30
- Updated: 2026-09-30
- Related task: [Media Download Controls and Audio Rename](2026-09-29-media-download-controls-and-audio-rename.md)
- Scope: Remove the completed-download check mark from feed and album audio play controls. Keep the blue saved state and the separate download/progress/retry action for unsaved audio.
- Implementation: The shared `AudioDownloadBadge` returns no UI for downloaded audio. Existing play/pause colors and offline accessibility labels remain intact.
- Verification: Focused ESLint and Biome lint pass; downloaded-audio lookup tests pass (2 tests, 3 assertions). Android verified the separate unsaved feed/album download action, progress, completion without playback, and saved blue controls with no badge in Light and Dark. Saved controls retain the offline accessibility label. [Native screenshots and checks](../../artifacts/audio-download-badge/README.md).
- Brain impact: Audio feature behavior changed. No API, database, or architecture changes; no ADR required.
- Delivery: Android Preview OTA `2026.09.30.01` prepared; commit, push, and publication pending.
