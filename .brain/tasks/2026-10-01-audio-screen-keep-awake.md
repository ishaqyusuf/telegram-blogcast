# Audio Screen Keep Awake

- Status: Done — Android Preview OTA published; device verification pending
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
- Native verification was attempted: the connected Android phone is locked and no Metro development client is connected. Screen-timeout and navigation acceptance remain unverified on-device.
- Android release bundle exported successfully; its source map includes the screen-awake hook. EAS channel readback confirmed the published group, source commit, clean source tree, Preview variant, environment, runtime, and update version.

## Delivery

- Implementation and OTA version bump committed and pushed to `main` as `011c2a5de7b6ad3a24803817ddf724f4e599113b`.
- Android Preview OTA `2026.10.01` published on runtime `1.0.111`: [EAS group `b1767993-49ea-40a2-bd8f-5c9071a7f55b`](https://expo.dev/accounts/ishaqyusuf/projects/alghurobaa/updates/b1767993-49ea-40a2-bd8f-5c9071a7f55b), Android update `01a0f7da-052d-762f-9d1e-0693a1544e7f`.
- Used the pinned EAS CLI `20.2.0`. Sentry automatic source-map upload was disabled for publication, following the previous Preview update's delivery setting.

## Brain Impact

- Updated the audio feature behavior. No API, database, or architecture changes; no additional ADR required for the existing Expo module's screen-scoped lifecycle.
