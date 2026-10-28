# Android Scroll Rendering And T3 Code Comparison

- Status: Done locally — shared fixes verified on physical Android and emulator
- Created: 2026-10-28
- Updated: 2026-10-28
- Completed: 2026-10-28
- Research: [T3 Code mobile source review](../research/2026-10-28-t3-mobile-scroll-performance.md)

## Scope

Diagnose the main feed's reported blurred/flickering scrolling on the physical Samsung SM-S928U1, learn from T3 Code mobile, and fix shared causes across other affected screens. The user took the phone away and explicitly authorized an emulator fallback.

## Evidence And Limits

The first foreground physical-feed four-swipe run reported 44/181 missed frame deadlines, 95th percentile 32 ms, with sharp settled text. Development build; this is an initial observation, not a release benchmark. Later runs that switched to the audio screen, Settings or the chat were discarded as feed comparisons. Wireless ADB disconnected when the phone left; the user later confirmed phone use and it reconnected for final verification. Never compare emulator timing numerically to the physical phone baseline.

## Implementation

- Shared swipe-dismiss geometry keeps idle height automatic and removes idle transforms; dismissal still collapses rows. Applied to blog/search cards, album swipe rows and transcription queue jobs.
- Feed transcript selection returns only the playing post's current segment text, so unrelated playback ticks do not render inactive previews.
- Shared scroll wrappers do not track unused scroll-to-top visibility. The hook publishes that state only on threshold crossings, and Home uses its direction/visibility callback instead of maintaining a duplicate accumulator.
- Audio-bar store suppresses duplicate same-owner visibility notifications while preserving outgoing-screen ownership protection.
- Feed renderer is stable. Cards without delete behavior omit hidden delete-action content. Cards retain identity-bound state; recycling is not enabled without identity reset coverage. Render-buffer and viewport-activation experiments were removed because measurements did not establish a gain.

## Acceptance

- Native expansion checker failed on the original card (27-pixel control; required 77) and passed on the fixed card (77). It checks ancestry so a later row cannot satisfy the assertion. Original and fixed screenshots/results are under `artifacts/android-scroll-2026-10-28/expanded-row-original` and `expanded-row-fixed`.
- Twenty tests passed across dismissal geometry, transcript selection, notification ownership, existing feed updates, visibility and card media behavior. The original store failed the duplicate-notification regression with 4 updates versus the required 2.
- Scoped Expo ESLint passed. Final Android/Hermes export passed. Full project typecheck still reports existing workspace diagnostics; no diagnostics remain in touched production files or new tests.
- Emulator Android 14/API 34, 720×1616, 280 dpi: real feed/card expansion, vertical scroll/reversal, populated channels, album grid/detail (11 tracks), cached book reader, search result cards, 50-entry play history, storage and channel configuration. Search keyboard dismissal was required before selecting a channel; the results list then loaded 2,584 audio posts. The transcription queue had zero jobs and playlists were empty, so those checks cover empty states rather than populated swipe rows.
- Book reader content was cached locally (five pages); it is a reader visual/navigation check, not acceptance of every long continuous-reader scenario. No universal claim that all routes/states are flicker-free is made.
- Timing experiments used the same warm cached feed and four-swipe sequence. Frame statistics remained variable; no reliable overall FPS gain was established. Initial physical, emulator, reduced-motion and normal-motion samples are not interchangeable benchmarks.
- Physical Samsung SM-S928U1 reconnected and loaded the final bundle: the same-row expansion checker passed at 124 physical pixels against the required 123. A guarded sample before the final spacing correction rendered 188 frames with 33 deadline misses; different visible content/warm-up means this is not evidence of a quantitative improvement over the initial run. Final physical evidence is under `physical-expanded-fixed` and `physical-final-frames` in the artifact directory.
- Light and Dark native card checks passed. Dark feed motion frames and album-grid captures were reviewed; the populated search screenshot contains real results. Temporary benchmark/debug probes and rejected optimization code were removed. Emulator animation settings were restored to their original zero values; the emulator remains running for reuse.
- Final static-style correction preserves the native content gutter: 45 pixels on the Samsung and 28 on the emulator; expanded Play remains 124/77 pixels respectively. The checker now asserts the gutter as well as the same-row button bounds. Native ripple remains the press feedback. Scoped lint and the final Android/Hermes export passed after this correction.
- Brain impact and ownership review complete. Only this task's code, documentation and selected durable evidence are included in the local commit. Earlier working-tree edits remain separate.

## Brain Impact

New research note, this execution task, and a scroll-rendering feature note. Existing unrelated working-tree edits must be preserved and excluded from the commit. No API, auth, schema, or deployment changes.
