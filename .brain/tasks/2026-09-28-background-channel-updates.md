# Background Channel Updates

## Status
Implementation complete; paused before UI testing at the user's request.

## Dates
- Created: 2026-09-28
- Updated: 2026-09-28

## Scope
- Keep the current screen after starting a manual channel update.
- Add Settings → Channel updates with a persisted auto-update switch and marked channels.
- Run selected updates silently through the existing local-service job API.

## Progress
- [x] Manual Update dismisses its sheet after job acceptance, shows a brief confirmation, and does not navigate. Failed submissions retain the sheet and show the error.
- [x] Per-device settings default off with no selected channels; switching off retains selections.
- [x] Route-independent automatic checks run on connection/foreground and every five minutes while active; prevent overlapping checks, filter eligible marked channels, and cancel stale submissions after preference/gateway changes.
- [x] Automatic mode suppresses update, connection-error, and Telegram-login prompts; progress remains an explicit action.
- [x] Non-UI verification and Brain impact check.
- [ ] Native UI verification: manual Update remains on the same route, explicit progress navigation, saved toggle/selection after restart, light/dark layout, empty/error/offline states, and silent automatic updates. **Do not begin until the user resumes UI testing.**

## Verification
- 10 focused Bun tests pass across automatic update orchestration and existing check deduplication.
- Expo typecheck remains blocked by repository-wide errors in existing API/app files and missing `bun:test` typings (including the new Bun test). No diagnostics in the changed production files.
- Baseline Settings screenshot was captured before the user requested the testing pause. No native interaction verification of the implementation has been performed.

## References
- [Feature](../features/blog.md)
- [Decision](../decisions/2026-09-28-silent-channel-auto-updates.md)
- [Review artifacts](../../artifacts/channel-background-updates/manifest.md)
