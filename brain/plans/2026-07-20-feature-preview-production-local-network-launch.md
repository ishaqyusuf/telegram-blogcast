# Preview/Production Local Network Launch

## Status
Done

## Created Date
2026-07-20

## Source
Direct user request to require an explicit LAN IP choice on preview and production cold launches before optional local services run.

## Behavior
- Preview and production builds show a keyboard-safe local-network bottom sheet once per cold process launch after persisted IP history hydrates.
- The sheet accepts a valid IPv4 address, filters recently used IPs while typing, and enables the session immediately when a recent IP is selected.
- Closing the sheet disables Telegram update checks, Facebook import, local transcription, and their background observers for the current session without affecting normal content, playback, saved transcripts, or Expo updates.
- Disabled local-service routes and actions offer a recoverable Enable Local Services flow. Development builds keep automatic local-network behavior.

## Architecture
- A transient `LocalServicesSessionProvider` owns launch state, active IP, derived service URLs, and a typed local API client.
- The normal/global tRPC client remains unchanged. Telegram fetcher operations use the selected-IP local client so LAN configuration cannot redirect ordinary app traffic.
- The existing persisted app settings remain the source for active IP and recent history; no storage or backend migration is required.

## Verification
- Pure Bun tests cover build-variant launch policy, IPv4 validation, recent-IP filtering/deduplication, and delayed session activation until sheet dismissal.
- Local-service URL tests remain the contract for per-service ports and manual-IP precedence.
- Focused Expo ESLint, package typecheck review, preview Android export, and `git diff --check` completed. Hands-on Android visual QA was skipped at the user's request.
