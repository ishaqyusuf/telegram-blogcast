# ADR: Mobile Local-First Content Cache

## Title
- Decision: Hydrate bounded content metadata before network queries and keep media/transcript storage specialized.

## Status
- Accepted

## Context
- Home, album, and audio screens previously exposed database loading on repeat visits even when useful content or audio had already been seen on the phone.
- The feed needs background discovery without replacing the user's visible position. Audio needs a trustworthy offline indicator, and transcripts already have a versioned SQLite cache.
- Local Telegram synchronization is service-owned and can be unavailable while the reading experience remains usable.

## Decision
- Persist only an allow-list of content query results in AsyncStorage, scoped by the resolved tRPC environment. Hydrate it before mounting query consumers.
- Retain at most 80 queries, 2 MB total, 400 KB per entry, five pages per infinite query, and 30 days of age. Corrupt entries are disposable and isolated from healthy entries.
- Keep the visible feed snapshot stable during focus/reconnect probes. Stage the latest page separately and merge it only when the user taps “New updates,” preserving loaded older pages and pagination.
- Keep audio bytes in device storage. Download to `.part`, validate HTTP status and expected size when known, then atomically promote. Resolve by media ID before consulting network URLs.
- Use the installed Android variant's scoped media directory. If an older native module returns a directory owned by another package, use app-private document storage until the binary is upgraded.
- Keep transcript windows in the existing versioned SQLite repository; cached windows render before server refresh and revision rules prevent stale responses from replacing newer data.

## Consequences
- Repeat and offline launches can render saved content without a successful API request, while auth, local-service status, and probe queries remain excluded.
- Cache size is bounded and older pages may be evicted; a true miss still requires the network.
- Downloaded styling represents a complete readable phone file rather than a remote gateway URL or partial download.
- Background feed changes require an explicit user action, preventing position jumps at the cost of showing slightly stale content until accepted.
