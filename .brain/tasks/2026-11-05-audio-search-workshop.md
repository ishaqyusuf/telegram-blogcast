# Audio Search And Album Actions

- Status: Workshop ready — published and browser-verified. Product implementation awaits design selection.
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
- Verification metadata and screenshots are saved under the Workshop source `verification/` directory. The permanent comparison was left open for review. No revision is selected and no implementation receipt exists.
- Native device acceptance and real performance measurements remain implementation work. The software keyboard in the HTML Workshop is simulated, not evidence of native keyboard behavior.

## Brain Impact

Added this task, an engineering plan and the confirmed product-decision ADR; added the pointer to in-progress. Existing production feature, API and database documents remain unchanged because runtime behavior is unchanged. The final implementation must update those contracts and the relevant feature docs.

## Next Step

Review and select a direction or combination. Record the exact accepted Workshop revision before implementing native UI, scroll repair, query/cache improvements and cross-channel server support. Keep the existing uncommitted checkout changes outside this task's commit.
