# Plan: Mobile Channel Sync, Local Cache, And Playback Visibility

## Type
Feature

## Status
Done

## Created Date
2026-09-22

## Last Updated
2026-09-22

## Goal
Let mobile discover and synchronize Telegram channels through the local service, restore previously read content immediately from the phone, distinguish complete offline audio, stage feed updates without moving the reader, and suppress the mini-player where it duplicates the current screen.

## Completed Phases

### Phase 1 — Audit existing behavior
- [x] Traced channel import, content query, audio file, transcript SQLite, feed, and global-player paths.
- [x] Confirmed metadata/feed state lacked durable query hydration, audio completion checks were incomplete, and player visibility did not directly cover Search or matching media.
- [x] Reused the existing local-service session, media cache, and transcript repository instead of adding parallel systems.

### Phase 2 — Discover and synchronize channels
- [x] Added a Channels entry point to the channel-sync screen.
- [x] Added explicit Telegram dialog discovery with new-channel feedback and local-service reconnect handling.
- [x] Added one-shot initial and incremental synchronization with persisted-batch ordering, forward pagination, completion state, retry safety, and duplicate filtering.
- [x] Covered new-channel history, multi-page incremental updates, repeat sync, and empty-channel completion with deterministic tests.

### Phase 3 — Open audio, albums, and transcripts locally
- [x] Added allow-listed, environment-scoped query persistence for feed, channel, audio-detail, album, track-list, and playback-queue metadata.
- [x] Hydrate disk content before query consumers mount; retain successful cached data when background refresh fails.
- [x] Resolve audio by stable media identity before remote URLs, validate known file sizes, download through `.part`, and atomically promote completed files.
- [x] Preserve existing SQLite transcript window behavior: cache-first render, revision isolation, corrupt-cache recovery, and offline-readable saved ranges.
- [x] Start album playback from the cached/displayed queue without waiting for a playback-queue network refresh.

### Phase 4 — Restore feed and stage updates
- [x] Persist a bounded feed snapshot plus selected category, pagination pages, and per-category scroll offset.
- [x] Restore cached content before a network loading gate and reserve the skeleton for a genuine empty-cache load.
- [x] Probe on focus, reconnect, and a bounded interval without replacing visible rows.
- [x] Show a top-center “New updates” action only when stable post/album identities reveal new visible content.
- [x] Merge accepted updates once while retaining loaded older pages, deduplicating overlap, preserving the pagination cursor, and returning to the top.

### Phase 5 — Identify downloaded audio
- [x] Added shared downloaded-audio lookup using media ID with a guarded legacy blog-ID fallback.
- [x] Show filled blue, accessible play controls in feed cards and album rows only for complete readable files.
- [x] Refresh visible indicators after download completion and whenever the app returns to the foreground.
- [x] Keep green styling for remote audio and avoid marking `.part`, empty, missing, or known-size-mismatched files as offline.

### Phase 6 — Hide redundant floating players
- [x] Hide the global mini-player throughout Search.
- [x] Hide it when audio detail's viewed media matches the active media, including paused and scrolled states.
- [x] Preserve playback and existing visibility behavior on other routes, different-audio detail, sheets, and back navigation.

## Acceptance Evidence
- [x] Connected Samsung `R5CX153J81W`, package `com.alghurobaa.podcast.dev`: after API reverse removal, force-stop, and relaunch, cached Channels, Albums, and Latest Posts rendered while network requests failed in the background.
- [x] Album 29 rendered filled blue controls for locally stored media 1369 and 1370.
- [x] Search with an active track and deep-linked matching audio `/blog-view-2/2345` both suppressed the mini-player.
- [x] `/blog-import` rendered the Local Services reconnect gate when unavailable; live user channel data was not mutated during acceptance.
- [x] 38 focused tests passed across content persistence, feed merging, player rules, transcripts, Telegram sync, and Android media storage; `@acme/telegram` typecheck passed.
- [x] Android native compilation succeeded. Installing that local debug APK over the connected app was rejected because the signing certificates differ, so existing device data was preserved. The running build exercised the app-private compatibility fallback; generated native-directory ownership is covered by plugin tests.

## Cache Boundaries
- Query cache: 30 days, 80 entries, 400 KB per entry, 2 MB total, five pages per infinite query.
- Excluded state: auth, local-service sessions/status, mutations, and background probe queries.
- Audio: complete phone files only; known server length must match when available.
- Transcript: existing versioned SQLite schema and media/revision invalidation.

## Assumptions And Follow-up Boundary
- “New channels” means channels newly available to the connected Telegram account. Joining arbitrary public channels by username/link remains a separate product capability.
- Local-service unavailability does not enqueue cloud work; the screen shows reconnect/setup while cached reading remains available.
- Repository-wide Expo/API typechecks still contain unrelated legacy errors recorded in the linked task. They are outside this feature's implementation.

## Architecture Decision
- [Mobile Local-First Content Cache](../decisions/2026-09-22-mobile-local-first-content-cache.md)

## Linked Task
- [Mobile Channel Sync, Local Cache, And Playback Visibility](../tasks/2026-09-22-mobile-channel-sync-and-local-cache.md)
