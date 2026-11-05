# Manual Cross-Channel Album Additions Require Confirmation

- Date: 2026-11-05
- Status: Accepted product intent; production implementation pending design selection and contract work.
- Task: [Audio search and album actions](../tasks/2026-11-05-audio-search-workshop.md)

## Context

The current album-add contract requires audio candidates from one channel and rejects a destination album from another channel. The user requested same-channel Existing albums first, followed by a From other channels section, and explicitly chose **Selectable, with confirmation** when asked whether the second section should be actionable.

## Decision

The manual album picker will show same-channel destinations first and other-channel destinations separately. A deliberate cross-channel addition/change presents a confirmation identifying source channel(s) and destination album/channel before submitting the mutation. Removing from an album preserves the audio post. Audio source provenance must not change when membership changes.

The implementation must revise the manual server contract, transaction and related UI together; suppressing a client restriction is insufficient. Preserve safe default behavior for older clients and automatic organizer flows. Exact API acknowledgment/versioning and home-channel versus membership-channel query semantics are implementation design work documented in the [plan](../plans/2026-11-05-audio-search.md), not completed schema changes.

## Consequences

- Albums can deliberately contain manual additions from multiple source channels after this is implemented.
- Source-channel filters and destination album grouping must have explicit distinct semantics.
- Existing assumptions in album suggestions, organizer approval, authors, order indexes, badges and cache invalidation need review.
- The Workshop demonstrates confirmation with local sample data only. Current production constraints remain in force until the selected implementation is verified and released.
