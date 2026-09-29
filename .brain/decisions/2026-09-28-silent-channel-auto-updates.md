# Silent Channel Auto-Updates

## Status
Accepted — 2026-09-28

## Context
The mobile Update action launched a background job but immediately navigated to its progress screen. Users also need selected channels to update without a prompt.

## Decision
- Manual submission closes the sheet after the local API accepts the job and leaves navigation unchanged. Progress is opened explicitly.
- Store an opt-in boolean and selected channel IDs in the existing per-device persisted app settings. Default off; retain selections when disabled.
- A root-mounted hook checks eligible selected channels while the app is active and local services are online, with a five-minute cooldown, a foreground listener, and no overlapping requests. Skip known-up-to-date channels; eligible channels with unknown latest counts can still attempt an incremental update.
- Use the existing authorized local-service `getUpdatePromptSummary` and `startRecentUpdateJob` contracts. Cancel stale pre-submission work on settings or connection changes. A submitted job remains service-owned.
- Automatic mode never presents the channel update, offline, or Telegram login modal and never navigates or sends success notifications. Failures retry after the cooldown. Users can open progress and Local Services from Settings.
- Preserve the existing feed staging behavior: new posts do not replace the visible reading position automatically.

## Consequences
- No database migration, server scheduler, API change, or OS background-execution permission is required.
- Automatic discovery requires the app to be active and Telegram authorized on the local service. Already-submitted work continues on that service after leaving the screen/app.
- Preferences are device-local. Turning automatic updates off or unmarking channels prevents future submissions; it does not cancel accepted server jobs.
