# Album Organizer Channel Review Workshop

- Status: Done. Three interactive directions published for design review.
- Created and completed: 2026-11-04.
- Workshop: [Album Organizer channel review](https://workshop.localhost/al-ghurobaa/audio/album-organizer-channel-review).
- Related work: [Audio](../features/audio.md), [previous Album Organizer review workshop](2026-10-23-album-review-workshop.md).
- Source: `/Users/M1PRO/Documents/code/workshop/work/al-ghurobaa/audio/album-organizer-channel-review/`.

## Current behavior and gap

Settings → Album Organizer already supports channel selection, an AI scan based on same-channel album context and unalbumed audio metadata, saved discovery runs, and one-album approval. Generation defaults to 500 audio and 100 albums, reads a bounded set with no date cursor, and fails when the channel has zero existing albums. Opening a saved run returns to its album list. Exact review position, draft track selection, switching an existing match to a new album, and continuing discovery over the remaining channel history need implementation.

## Workshop scope

All three directions use the same fictional channel data. Generate a discovery, open a suggestion with every proposed track selected, uncheck tracks, change the destination to another existing album or an editable new name, and save one album at a time. Review can be left and resumed inside the demo. A second simulated scan covers new audio and keeps the first discovery accessible. Date labels refer to source audio. Unassigned tracks stay visible separately. Demo state stays in the preview session.

| Direction | Revision |
| --- | --- |
| 01 Swipe review, recommended | `5c2f930a-7f3b-47b6-9548-e97bb7481ca3` |
| 02 Album queue | `304a7db1-0439-4fea-bab1-57ca6512edb8` |
| 03 Date timeline | `454b988b-c65e-4599-97ac-d8a6a49fb57e` |

Claude Code was launched with `--model claude-opus-5-5 --effort high`. The run produced no draft for five minutes and was stopped. Codex authored, integrated, and published the comparison.

## Verification

- All three v3 revisions and the permanent gallery loaded through Workshop. JavaScript syntax checks passed.
- Chromium exercised sample generation, target replacement, preselected tracks and deselection, save and advance, save for later and resume, swipe and arrow navigation, unassigned tracks, incremental scan, and discovery history.
- The mobile config passed theme switching, the 320 × 568 preset, collapse/reopen, and size and theme retention after a demo-state change. Reviewed the gallery and compact renders.

## Next phase

Record the exact selected revision before changing native behavior. Reuse the existing run and suggestion records. Keep incremental scan coverage separate from the review position and support channels with zero existing albums. On approval, validate the destination and each track against current channel membership before advancing. The workshop used sample data and required no product, API, or database changes.
