# Audio Search: Engineering Plan

- Status: Planned; design Workshop awaits selection. No production code, schema, live query plan, or performance benchmark changed in this phase.
- Task: [Audio search and album actions](../tasks/2026-11-05-audio-search-workshop.md)
- Workshop: https://workshop.localhost/al-ghurobaa/audio/search
- Decision: [Confirmed cross-channel additions](../decisions/2026-11-05-confirmed-cross-channel-albums.md)

## 1. Establish Behavior Before Optimizing

Use one explicit search state: submitted keyword, content type, audio view, source-channel IDs, album membership, sort, and cursor. Normalize text and sorted channel IDs deterministically for cache keys; preserve the user's original Arabic text for display and avoid unproven normalization changes that reduce recall. Typing and committed queries are separate. Debounce suggestions, cancel superseded work when supported, and never let an old response overwrite a newer query/filter identity.

Tracks filter on the audio media represented by the result. Membership means that audio's `Media.albumId`, not an unrelated image/PDF attached to the same blog. Decide and test the projection for blogs with multiple audio media: either one identified audio row per media or an explicitly defined blog-level match. The displayed membership and acted-on media must agree with the predicate.

Album results search album names and retain the channel scope. Proposed scope: `Album.channelId` remains the album's organizing/home channel; each track retains its original `Blog.channelId`. The Albums view filters by organizing channel, while Tracks filters by original source channel. Expose this distinction in filter labels/helper copy when cross-channel membership is present. Membership filters apply only to Tracks and remain remembered when returning from Albums. Opening an album shows its full membership, independent of the search query that discovered it.

Keep counts honest: type counts use the documented common query/channel scope; the result total reflects all active view-specific filters. Avoid implying that loaded rows equal all server matches. Selection belongs to a query context and clears on submitted keyword/channel/membership/type/view changes. Label the initial bulk operation Select all visible/loaded. Do not silently interpret it as all matching database rows.

## 2. Source Findings To Verify During Implementation

- `screens/search-screen.tsx` already sends `q`, `channelIds`, type and a limit of 20 to `blog.search`, and supports cursor pagination. It does not send the existing album filter and only wires a single-card add-to-album callback.
- `blog.routes.ts` accepts `album: in | not`, applies filters before pagination, and orders by `blogDate desc, id desc`. It runs one row query, two total-count queries and a count per supported content type for every request/page. Measure this repeated work rather than assuming parallel queries make it cheap.
- Existing album predicates use `medias.some` with album membership without an audio predicate. Audit mixed-media posts and ensure the matching audio is the one rendered/selected.
- Search includes media/file/album/channel information, up to two transcript snippets and latest transcription status. Trace serialization/payload cost before reducing fields the cards require.
- The picker currently fetches all `getAlbums`, sorts by channel name and album name, and uses `newAlbumName` both for creation and filtering. Separate destination search from new-album creation state.
- The picker renders an RN FlatList with a custom KeyboardAwareScrollView inside the shared floating sheet, with a capped parent height. This is a candidate gesture/measurement conflict, not a confirmed native root cause. Reproduce the reported scroll failure on the dedicated project AVD before changing it.
- Manual add/remove procedures currently use `publicProcedure`; existing security documents explicitly identify similar public write routes. Do not describe these as protected merely because client buttons are gated. Verify the intended permission boundary and enforce it consistently for changed mutations; document any remaining public-write policy explicitly.
- Prisma declares `Album.channelId`, `Media.albumId`, original `Blog.channelId`, and separate `AlbumAudioIndex` ordering. Declared album channel and file indexes exist; the inspected schema does not establish optimal media-membership/search indexes. Inspect the actual deployed indexes and plans before recommending DDL.

## 3. Small, Typed Boundaries

Keep the screen responsible for navigation and composing shared controls. Extract search-state/query-input logic, result projection, selection state, reusable audio actions, and album destination picker by responsibility. Reuse tRPC input validation, React Query, existing floating-sheet/footer primitives, and the global player. Avoid a second data cache, a new search service, or another modal system without measured need.

Validate bounded query lengths, page sizes, numeric IDs and bulk batch sizes. Return a typed minimal list projection, stable cursor and separately scoped facet/count metadata. Keep pagination deterministic when dates tie or are null. Audit ID cursors with the current two-field ordering under concurrent inserts/deletes; use a composite seek contract if measurements/correctness tests require it. Deduplicate pages by stable identity on the client without hiding server cursor defects.

## 4. Database Performance

Capture a baseline for broad/empty terms, Arabic exact and partial terms, transcript matches, common/rare channels, albumed/unalbumed audio, first page and later pages. Record query count, p50/p95 latency, row estimates versus actual rows, rows scanned, buffer use, payload bytes and response serialization. Use authorized representative data; `EXPLAIN ANALYZE` executes the query and must be bounded/read-only, preferably in a representative non-production environment.

Inspect `EXPLAIN (ANALYZE, BUFFERS)` and existing indexes before proposing composites for filter/order columns or media joins. A normal B-tree is not automatically useful for contains/ILIKE text searches; compare indexable search strategies only if measured text predicates dominate. Consider Arabic normalization, title overrides/original filenames, substring expectations and transcript recall before selecting trigram/full-text infrastructure. No new engine by default.

Avoid count fan-out on every next-page fetch. Investigate first-page facets, a dedicated count query/cache, or grouped aggregates with identical visibility/membership predicates. Preserve the meaning of counts across content-type projections. Do not remove exact totals silently or manufacture totals from loaded pages.

Use bounded queries and small list payloads. Avoid per-row channel/album/count lookups, unnecessary transcript hydration, and loading every album just to render a destination page. Separate/paginate same-channel and other-channel album groups with stable boundaries; search each group on the server and retain a clear empty state. Parallelize only independent work and measure pool/concurrency pressure.

If Prisma changes are actually needed, follow the explicit project AGENTS instructions: root `db:migrate` and `db:push` currently both exist, so run both after the schema change; do not hand-author migrations. Do not run database commands during the design phase. Review deployment/runtime compatibility and rollback implications before any later release; release is not authorized by this Workshop request.

## 5. Cache Correctness And Fast Feedback

Use canonical React Query keys containing submitted keyword, content type/view, normalized channel IDs, membership, sort and relevant authorization/visibility scope. Infinite-query pages belong to one key. Clear or segregate caches on identity/visibility changes. Reuse the repository's bounded persistence policy; don't persist unbounded search history, large transcript bodies, every query combination or private results across users.

Choose stale/GC/persistence limits from actual usage and result volatility. Show a fresh matching cache immediately and revalidate when appropriate. Cached data for a previous filter must not masquerade as results for the current filter; show a loading transition or explicitly identify it. Avoid full-screen spinners on background refresh. Failed refresh with a matching cache keeps readable results with retry feedback; no-cache failures have a clear error state. Offline cached search has an explicit status, distinct from a true empty result.

After add/change/remove/create/rename/delete, update or invalidate affected search entries, counts, old/new album tracks/detail/list, related-album suggestions and any persisted content snapshot. Optimistic updates require cancellation, a precise previous snapshot and rollback. Filtered results must reconcile immediately: adding an unalbumed item removes it from Not in an album results without discarding unrelated pages. Keep user selection/drafts on mutation failure and retry only unresolved work. Do not globally invalidate every query to compensate for incomplete cache ownership.

## 6. Selection And Membership Integrity

One shared audio action layer drives card More, album rows, detail menus and multi-selection. Menus depend on current server membership. Add/Change/Remove operations use media IDs; post deletion uses the correct blog identity and remains a distinct destructive action with confirmation. Prevent accidental playback during marking and provide an accessible Select action as well as long press.

Manual cross-channel add/change requires explicit confirmation with source and destination context. Keep legacy same-channel calls safe by default. Proposed API: a validated optional acknowledgment on the deliberate manual action, checked against current source/destination state; no UI-only bypass or global removal of channel checks. Revalidate affected IDs, current membership, visibility and permissions in the transaction. Do not change source channel IDs to make membership validation pass.

Prefer atomic, bounded bulk membership/index updates, including moving out of old albums and inserting into the destination order. Define duplicate/idempotent replay and stale-membership behavior, and serialize conflicting reorder/move operations. An atomic failure leaves the whole batch selected with a clear reason; if the existing contract is intentionally partial, return per-ID outcomes and retain failed IDs. Disable duplicate submissions, but enforce correctness server-side too.

Keep automated Album Organizer suggestions/approval channel-constrained unless separately approved. Manual cross-channel permission must not silently broaden automated moves or overwrite discovery provenance. Audit album author fallback, books, ordering, badges and cache records for assumptions that every track shares the home channel.

## 7. Native Scrolling, Rendering And Accessibility

Diagnose the picker on `AlGhurobaa_API34`, resolving its current ADB serial. Preserve `GreenTill_API34` and other apps. Confirm list bounds, nested gesture ownership, keyboard insets and active sheet scroll registration. Use the supported sheet-integrated virtualized list/scroll primitive and one scroll owner; avoid unbounded nesting and fixed-content clipping. Keep search/header and Cancel/confirmation actions reachable while the result body scrolls. Test many albums, fling, touch drag, keyboard open/close, resizing and list pagination.

Use virtualized track/album rows with stable media/album keys, stable callbacks and focused selection/player subscriptions. Playback progress must not rerender every search row. Measure dropped frames/commit costs with realistic lists; memoize proven hotspots rather than every object. Preserve row geometry and the shared footer stack. Sheets suppress the mini-player through dismissal; selection actions stack above it outside sheets.

Use existing semantic light/dark tokens, English LTR controls, Arabic content with natural/RTL alignment, appropriate type scale and touch targets. No NativeWind text-align classes on TextInput, and do not mix className/style on an element. Verify TalkBack traversal/activation, selection announcements, focus restoration, large text and reduced motion. An accessibility tree or injected tap alone is not screen-reader proof.

## 8. Focused Validation And Delivery

1. Lock a selected exact Workshop revision and record it in the catalog.
2. Reproduce scroll failure and record baseline search/query/render measurements.
3. Add behavioral tests for filter intersections, mixed-media membership, tied/null-date pagination, stale responses, cross-channel acknowledgment, atomicity/idempotency and cache reconciliation. Avoid tests that merely repeat implementation details.
4. Implement cohesive milestones in the current checkout, preserving unrelated work. Commit only owned hunks after appropriate checks.
5. Exercise real Android flows: search, change channel/membership, switch tabs, long press/select/cancel, add/move/remove, cross-channel back/confirm, mixed-source selection, failed mutation/retry, keyboard and long picker scrolling. Compare native layouts against the accepted design.
6. Compare cold/warm p50/p95 and database/payload/render costs under the same data/network/device conditions. Set concrete improvement budgets after the baseline; report misses and tradeoffs. HTML demo speed is not a benchmark.
7. Update feature/API/database documents and this task/ADR for actual changes. Record verification, commit and exact selected revision with Workshop `implement` only after implementation passes. Push/deploy requires separate authorization.

## Completion Evidence

The finished product needs verified behavior, the native scroll regression fixed, measured performance/cache evidence, focused tests passing (or precisely documented unrelated failures), no accidental broadening of automated album operations, updated Brain contracts, committed task-owned code and an implementation receipt tied to the accepted Workshop revision. The current deliverable is the design comparison and this plan; none of those production outcomes is claimed yet.
