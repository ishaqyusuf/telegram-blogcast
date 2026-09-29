# Mobile Media Download Storage

- Date: 2026-09-29
- Status: Accepted
- Scope: Expo audio, video, and PDF downloads

## Context

The installed Android Expo FileSystem can download a temporary `.part` file into its app-owned `Android/media` directory, but fails to move or copy that file to the final media filename there. This left PDF and potentially audio/video downloads unusable despite a successful network transfer.

## Decision

Write new completed media to the app-private document directory. Validate download status and expected size before moving the `.part` file to its final name. Continue to read complete files saved under the prior Android scoped directory, so existing offline audio and media badges remain available. Show a safe inline message on download/render failure rather than raw filesystem diagnostics in the UI or Metro overlay.

## Consequences

Downloads work with the current installed binary and remain available inside the app, including offline playback/viewing. New files are app-private and are removed when the app is uninstalled. Export to a user-visible folder would require a separate explicit share/export flow or native storage support. This supersedes the scoped directory preference for downloaded audio in the [local-first content cache decision](2026-09-22-mobile-local-first-content-cache.md); book exports retain their own storage flow.
