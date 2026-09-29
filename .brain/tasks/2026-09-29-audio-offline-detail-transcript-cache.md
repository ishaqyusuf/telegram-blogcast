# Task: Audio Offline Status, Detail Preview, and Transcript Cache

- Status: Done locally; device UI verification unavailable
- Created: 2026-09-29
- Updated: 2026-09-29
- Scope: Make saved audio state trustworthy, show known audio metadata immediately, and persist streamed and complete saved transcripts locally.
- Result: Audio playback download failures now surface a retry state; offline lookup recovers verified older files; audio detail uses entry-point metadata before background refresh; saved transcript windows read from SQLite first, generated chunks persist, and complete transcripts fill missing SQLite ranges in the background.
- Verification: 24 focused Bun tests pass; `git diff --check` passes. Expo TypeScript has existing repository errors, including Bun test typings. The Android emulator disconnected before installation, and the connected phone's development build is on its launcher error screen, so device UI behavior remains unverified.
