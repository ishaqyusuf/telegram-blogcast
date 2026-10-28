# Android Scroll Rendering And T3 Code Comparison

- Status: In Progress — native and Digital Books fixes verified locally; user scroll-feel check pending
- Created: 2026-10-28
- Updated: 2026-10-28
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

## Requested Repeat Test — 2026-10-28

- [Retest 02 evidence](../../artifacts/android-scroll-2026-10-28/retest-02/verification.md) tests implementation `f254da42` without changing application code.
- Twenty focused tests passed. Native expanded controls/gutters passed again: Samsung 123/45 px and emulator 77/28 px.
- A fresh phone process was required after a retained warm-session list offset prevented reaching the post. Cold launch restored normal native movement; exact origin of that retained runtime state is unproven.
- The reviewed slow/fling/reversal samples show no observed blank-row flash or clipping. Remaining stutter is measurable: phone 48/208 missed frame deadlines, p95 25 ms; emulator 17/93, p95 93 ms. These development-build samples do not establish fully smooth scrolling or an overall FPS gain.
- Brain impact is this task's repeat-test record; feature behavior, API and schema documentation need no further changes.

## Persistent Blur Follow-up — 2026-10-28

The user still observes blur during scrolling. Earlier clipping and subscription fixes do not close this symptom. Reopened for native frame pacing, with the main feed first and shared behavior across screens.

- Separate Metro port 8086 serves `--no-dev --minify`; runtime confirmed `__DEV__ === false`. Native shell remains the development build, so this is not a release benchmark. Existing 8085 service is preserved.
- Physical Samsung four-swipe samples: 69/225 missed deadlines (p95 34 ms), then 69/200 (p95 29 ms). The phone runs at 120 Hz during gestures (8.3 ms frame interval), rather than its adaptive 60 Hz resting rate. GPU p95 is 3 ms.
- Native atrace/Perfetto inspection found 172 batches of 56 `UPDATE_PROPS` instructions, 905 ms total, max 9.9 ms in the captured sample. Layout traversal itself is small. Reanimated 4.1.7's commit hook reapplies all registered animated props to native scroll-state commits.
- Hypotheses ranked before intervention: row layout/mounting, swipe/animation overhead, directional chrome updates, display refresh timing. The native trace favors repeated animation-property application.
- Investigate a narrow upstream 4.2 commit-hook fix against the installed 4.1.7 runtime; preserve Expo/RN versions and test matched unpatched/patched native builds. This is not yet a verified fix or acceptance of perceptual blur.

### Native correction milestone

- Backported the upstream non-React commit guard as `patches/react-native-reanimated@4.1.7.patch`; Bun package/lockfile entries pin its application. A clean temporary install verified patch application.
- Matched initial main-feed audio/video cards at offset 3300; six-second drag reduced repeated 55-prop batches from 363 to 2 and p95 frame time from 28 to 17 ms. Frame count remained similar and missed 120 Hz deadlines remain; no universal FPS or blur-elimination claim. Pagination changed total loaded content length; [diagnostic evidence](../../artifacts/android-scroll-2026-10-28/native-commit-followup/verification.md) records limits.
- Existing development signing credentials allowed `adb install -r` into the regular phone app, preserving app data. Native expansion/gutter checks passed again at 124/123 and 45 px.
- Twenty focused tests pass; native ARM64 debug builds compile. The temporary positioning probe was removed. Optimized native build and broader route checks are still in progress.
- [Native renderer decision](../decisions/2026-10-28-reanimated-native-scroll-state-commits.md) documents native rebuild requirements and removal on a compatible runtime upgrade.

## Digital Books scroll viewport correction

- User reported that only half of Digital Books scrolled. Native check reproduced it: Explore books was outside any vertical scroll ancestor at y=1128.
- Moved the reading card, filters, bookmarks and grid heading into the FlatList header; kept the toolbar fixed, retained the existing grid gutter and moved loading/empty states into the list. Preserved the unrelated pre-existing toolbar search action.
- Native regression check now passes on Samsung (viewport y=264; upper-body swipe moved heading 1063→687) and emulator (y=146; heading 737→434). [Evidence](../../artifacts/android-scroll-2026-10-28/books-viewport/verification.md).
- Scoped ESLint and updated optimized ARM64 Android build pass. Native release motion and remaining route checks continue.

- Additional Digital Books check passed at emulator font scale 1.3; original 1.0 restored. A cold client was required after the font configuration change returned the warm runtime to Home.
- Optimized native ARM64 build passed and ran on the Samsung in the isolated test app: 4/309 missed deadlines (1.29%), p95 15 ms. This is a release-build sample without an unpatched release baseline, not an A/B speedup claim.

## Final local verification checkpoint

- Optimized physical UI covered populated 168-channel list, album grid → 11-track detail, and Digital Books. Vertical gestures and post-scroll captures were checked. Release Digital Books also passed the header/container regression.
- Regular phone app was restored to Digital Books on production-mode Metro 8086; its existing data and development signing identity are retained. Original Metro 8085 remains available. The isolated scroll-test package was removed after verification. Emulator font scale is back to 1.0 and its client remains running.
- User has been asked to check perceived scrolling in Digital Books and the main feed. That subjective acceptance remains pending; no claim that every route/state is universally blur-free is made.
- Brain impact: scroll-rendering and books behavior, native renderer ADR, this task, and selected native evidence. No API, permission, schema or migration changes.
