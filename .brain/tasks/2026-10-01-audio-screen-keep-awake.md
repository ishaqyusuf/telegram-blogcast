# Audio Screen Keep Awake

- Status: Done locally — device verification pending
- Created: 2026-10-01
- Updated: 2026-10-01
- Request: Keep the phone screen on while the audio screen is open.

## Implementation

- Audio detail uses a focus-scoped `expo-keep-awake` lock regardless of playback state, including paused audio, transcript reading, and inline tabs.
- Blur or unmount releases the lock after native activation settles. Each focus receives a unique tag so delayed cleanup from an earlier visit cannot release a later visit's lock.
- Declared the existing Expo SDK 54 keep-awake module as a direct app dependency and updated the Bun lockfile.

## Verification

- Focused ESLint passed for the hook and audio screen; `git diff --check` passed.
- Full Expo TypeScript check remains blocked by unrelated workspace errors (including unresolved Telegram aliases and API types). No diagnostics reference the changed screen or new hook.
- Native verification was attempted: the connected Android phone is locked and no Metro development client is connected. Screen-timeout and navigation acceptance remain unverified on-device. No OTA was published.

## Delivery

- User authorized commit, push, and OTA publication on 2026-10-01. Android Preview OTA `2026.10.01` is prepared for the existing `1.0.111` runtime; publication details will be recorded after EAS readback.

## Brain Impact

- Updated the audio feature behavior. No API, database, or architecture changes; no additional ADR required for the existing Expo module's screen-scoped lifecycle.
