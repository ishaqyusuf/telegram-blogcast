# Silent Local Services Discovery And Status

## Status
Implemented

## Created Date
2026-07-24

## Source
User-approved follow-up to replace the preview/production cold-launch IP
prompt with non-blocking discovery and an always-available home status control.

## Behavior
- App startup never opens the Local Services sheet automatically.
- Startup checks the last successful IP first, then deduplicated automatic and
  historical candidates. Remaining history probes run in bounded batches.
- A failed startup search leaves the normal app available and marks Local
  Services offline.
- The home header shows checking, connected, or offline state immediately
  before Search.
- Pressing the status control opens one floating bottom sheet. Connected state
  shows the active IP and recheck/change actions; checking state shows the IP
  and progress; offline state offers history discovery and manual IPv4 entry.
- Manual and historical selections are health-checked before becoming active.
  Failed addresses remain editable and do not replace the last successful IP.
- Connectivity is re-evaluated on foreground, network changes, and bounded
  exponential offline retries.

## Architecture
- `useLocalServicesConnection` owns gateway discovery, cancellation,
  persistence, network/foreground listeners, and retry backoff.
- `LocalServicesSessionProvider` is the thin React adapter that exposes the
  connection controller and owns sheet visibility. Opening connection controls
  no longer disables a working session.
- `isEnabled` represents verified gateway availability, so local observers and
  guarded features do not run against a merely configured but offline address.
- The resolver gives the selected address an exclusive first attempt, then
  probes up to four fallback addresses concurrently while preserving saved
  priority when multiple candidates respond.
- `/health` must return `{ ok: true, service: "al-ghurobaa-local-api" }`; an
  unrelated HTTP 200 response is not accepted.
- Runtime Expo/configured host discovery is isolated from the pure candidate
  resolver so resolver tests remain independent from React Native runtime
  modules.

## Verification
- Pure Bun tests cover silent build-variant initialization, selected-first
  ordering, candidate deduplication, history fallback priority, and strict
  health identity.
- Focused Expo lint covers the resolver, provider, sheet, header, and adjusted
  Settings/import consumers.
- The 62-test repository Bun suite and preview Android export pass.
- Physical Android dark-mode QA confirms the checking and connected home-header
  indicators render before Search with usable 44-point targets.
- The full Expo typecheck retains existing project-wide diagnostics, with none
  in the touched implementation files.
- Full validation details are recorded in `brain/progress.md`.
