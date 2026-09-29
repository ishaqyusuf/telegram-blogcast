# Task: Audio Play History and Resume

- Status: Done locally
- Created: 2026-09-29
- Updated: 2026-09-29
- Scope: Record Recently Played from actual global playback and resume a selected audio from its latest saved position.
- Result: Global player lifecycle saves playback progress across entry points and system controls; loading a different media item reads saved progress, and the history Play action starts playback. Passive audio detail navigation no longer creates a history entry.
- Verification: Focused Bun tests pass. Expo TypeScript check has existing repository errors outside the changed paths. Android UI verification was unavailable because the connected emulator does not have this app installed.
