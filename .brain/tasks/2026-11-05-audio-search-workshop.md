# Audio Search And Album Actions

- Status: Implementation committed and pushed to preview; EAS publication awaits confirmation to update the existing production API. Direction 01 selected by user.
- Created: 2026-11-05
- Workshop: https://workshop.localhost/al-ghurobaa/audio/search
- Source: `/Users/M1PRO/Documents/code/workshop/work/al-ghurobaa/audio/search/`
- Engineering plan: [Audio search implementation](../plans/2026-11-05-audio-search.md)
- Product decision: [Confirmed cross-channel album additions](../decisions/2026-11-05-confirmed-cross-channel-albums.md)
- Related feature: [Audio](../features/audio.md)

## Requested Scope

- Workshop first, before production changes.
- Audio search has Tracks and Albums sub-tabs, channel filtering, and All audio / In an album / Not in an album membership filters.
- Long press starts marking; provide explicit Select, selected count, select all visible, cancellation, and existing single/bulk audio actions.
- Audio blog More menus expose Add to album for unalbumed media, and Open / Change / Remove from album for albumed media. Removing membership preserves the post.
- Repair the native Add to album scrolling problem. Show same-channel Existing albums first and a separate From other channels section; search and create inputs remain reachable with the keyboard.
- User explicitly confirmed that From other channels destinations are selectable with confirmation. This supersedes the current manual-add same-channel restriction, subject to implementing the server/domain contract rather than a UI-only bypass.
- Optimize search, cache behavior, database work and rendering, with measured validation rather than performance claims from a prototype.

## Published Directions

| Key | Direction | Revision | Version |
| --- | --- | --- | --- |
| 01 | Familiar layers — recommended | `d404fd44-dd6d-4535-8c41-56fecdb49055` | 3 |
| 02 | Bottom library | `bf945e2c-c6dc-43e3-bd16-d40637b0d865` | 3 |
| 03 | Channel workspace | `850eb6b5-cb29-4d4e-b9c5-8c4cef2f41cf` | 3 |

The comparison varies navigation and result density. All directions share illustrative Arabic content, English controls, actual runtime light/dark tokens, working local filters, selection, album membership updates, cross-channel confirmation and recoverable states. Album detail opens locally. Playback, download, sharing and playlist completion are labeled demo outcomes; no production services are called.

The requested author was `claude-opus-5-5` with explicit `--effort high`. A minimal readiness probe confirmed that exact model in CLI `modelUsage`. Automatic approval review rejected the later repository-reading delegated process before launch because it could transmit sensitive repository contents to the external model service. The coordinating Codex agent took over and authored locally; no delegated files existed. Provenance is retained beside the Workshop source.

## Verification

- JavaScript syntax checks passed for the shared interaction implementation.
- Published and rendered all three immutable revisions through the required shared Workshop viewer.
- Verified channel and membership intersections, preserved channel on Tracks/Albums switch, bulk same-channel move, long press marking, and single/bulk More menus.
- Verified other-channel selection requires confirmation, updates membership and removes the moved row from Not in an album results.
- Verified Remove from album keeps the audio post, and error retry restores results.
- Verified the album sheet scrolls: measured body height 516px, content 1108px, and scroll position moving from 0 to 592.5px through the two channel sections.
- Verified 320 × 568 with no horizontal overflow; simulated keyboard leaves a 219px scrollable picker body and reachable Cancel/Create controls.
- Verified light theme, config collapse/reopen, and preserved size/theme while switching local views/states.
- Final v3 smoke checks covered all three directions at 320 × 568, empty counts, full album detail, picker search and confirmation Back preserving its query, and filter changes clearing selection. No browser console errors were captured in the final check.
- Verification metadata and screenshots are saved under the Workshop source `verification/` directory. The permanent comparison was left open for review. Direction 01 revision `d404fd44-dd6d-4535-8c41-56fecdb49055` was selected and recorded; implementation receipt follows committed delivery.
- Native device acceptance and real performance measurements remain implementation work. The software keyboard in the HTML Workshop is simulated, not evidence of native keyboard behavior.

## Brain Impact

Added this task, an engineering plan and the confirmed product-decision ADR; added the pointer to in-progress. Existing production feature, API and database documents remain unchanged because runtime behavior is unchanged. The final implementation must update those contracts and the relevant feature docs.

## Next Step

Publish the committed Android update to EAS Preview. The user explicitly canceled device/emulator testing and requested Preview for their own acceptance. Keep Preview connected to current production services; do not add Preview infrastructure or change endpoints. The current live API returns NOT_FOUND for album.search, so dependent server code must be available before mobile publication. Production API publication requires clarification of the EAS-only release scope.

## Implementation — 2026-11-05

- Selected Familiar layers: Audio Tracks/Albums, source/home-channel filters, membership chips, Select/long press, loaded selection bounded to 200 and footer above the player.
- Shared audio actions cover album add/change/remove, open album, playlist, download, share, single rename, transcribe and confirmed soft deletion. Download/transcribe batches process sequentially and retry only failures. Blog More exposes album actions directly.
- One sheet owns the album picker and registered BottomSheetSectionList. Same-channel and other-channel groups are paged independently; search/create fields are separate; keyboard-aware inputs, explicit loading/error/retry and cross-channel confirmation retain the draft. Existing home, channel and album-detail entry points use it.
- Search rows and facets have independent React Query keys/TTLs (45s rows, 60s counts, 10m GC); suggestions debounce 250ms. Search is memory-cached, not added to persisted content. Album discovery/picker pages are bounded. Membership writes patch matching cached results immediately, then invalidate affected audio/album data. Background revalidation keeps matching cached content.
- API adds bounded album discovery, picker context, transactional create+add, stale-membership protection and atomic bulk removal/deletion. Manual cross-channel acknowledgment defaults false; organizer callers remain channel-restricted. Source Blog.channelId is never rewritten.
- No Prisma/schema or infrastructure change. Actual database indexes inspected; no media membership/blog index is declared/deployed. Count fan-out removal was measured before proposing DDL. Substring/transcript search remains the existing semantics; no unvalidated full-text migration.

## Implementation Verification

- Real PostgreSQL integration: 3 tests, 27 assertions, including mixed image/audio membership, tied/null-date paging, source filters, default cross-channel rejection, confirmed add, retry idempotency, stale snapshot rejection, organizer restriction, atomic create rollback and removal retaining posts. Every fixture and mutation rolled back.
- Client cache/group tests: 4 tests, 9 assertions. Existing album suggestion tests: 2 passed, preserving channel constraints.
- Android Hermes export succeeded. Focused new-module Biome checks pass. Full TypeScript check has 74 existing repository diagnostics; no diagnostics in new mobile search/action/picker/cache modules (pre-existing API errors remain).
- Alternating same-query/next-page benchmark, 5 samples per mode on the same database/network: legacy count median 3746ms (1846–5352); lean median 873ms (808–969), a 77% reduction in this small sample. Payload sizes essentially unchanged. No p95, frame-rate, offline or native visual claim.
- Native scroll/keyboard, TalkBack, light/dark and end-to-end actions remain user acceptance in Preview, per latest explicit instruction to skip emulator/device testing.

## Release Constraints

- User authorized push and EAS Preview update. Existing current checkout only; unrelated dirty work excluded from commits and release. No worktrees.
- Shared operational release helper internally creates a Git worktree when dirty, which conflicts with standing user instructions. Use an independent clean clone/archive of committed source for provider publishing instead.
- Vercel CLI login restored with user email verification. No Vercel deployment or infrastructure mutation has been made in this task.

## Delivery Checkpoint

- Implementation commit `00d123ac340c7ad39280f560d151b16a7a6f663a` pushed to `origin/preview`, verified against the remote branch.
- Exact clean release clone `/private/tmp/alghurobaa-audio-release-00d123ac` passed Android Hermes export and API build. Final focused suite on that committed source: 9 passed / 0 failed / 39 assertions, including real PostgreSQL fixture rollback. Clean-source full TypeScript still has 70 pre-existing diagnostics outside the new search/action modules.
- Workshop implementation receipt: `af1580f1-6ea2-438c-a6dc-1c92c8c25d7f`, tied to selected revision `d404fd44-dd6d-4535-8c41-56fecdb49055`; native acceptance remains explicitly delegated to the user's Preview testing.
- Provider read confirms API project `alghurobaa-api` has no Git repository link. EAS Preview's actual public URL variables still target `https://alghurobaa-api.vercel.app` and web `https://alghurobaa.vercel.app`. Live `album.search` returns `NOT_FOUND`.
- No new projects, URL changes, database/schema changes, Vercel deployment or EAS publication performed. The user narrowed release intent to EAS Preview and questioned the need for an API update; clarification explained that the new endpoints require deploying code to the existing shared API. Approval is pending. Do not publish an app update whose required endpoints are absent.
