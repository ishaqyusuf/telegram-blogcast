# Mobile Scroll Rendering

## Scope

Shared Expo scroll chrome, blog/search cards, album swipe rows and transcription queue rows. This is a rendering correction, not a screen redesign or a native runtime/library upgrade.

## Rendering Rules

- Swipe rows retain automatic height while idle. A measured height is used only during active dismissal, so expanding text and asynchronous content can reflow without clipping neighboring controls. The shared dismissal worklet has no idle transform and does not scale text.
- The playing feed post selects its current transcript text. Inactive/paused previews select `null`; position ticks within the same segment do not change the selected value.
- Scroll-to-top visibility is published only at threshold transitions. Shared scroll wrappers do not track this unused control. Home delegates player/header direction tracking to the shared hook instead of maintaining a second accumulator.
- Audio-bar scroll notifications are idempotent for the same state/owner. An outgoing screen still cannot reveal a player hidden by a newer owner.
- Card geometry uses a static style object through the NativeWind-backed Pressable; native Android ripple supplies press feedback without losing the content gutter.
- The feed renderer uses stable dependencies. Cards without delete behavior omit their hidden right-action content. Card and preview elements changed here use one styling mechanism per native element.

## Performance Policy

Measure the same build, route, content and device. Preserve real mixed-height identity state. Do not enable recycling until expanded content, playback/download state and open gestures reset safely on identity changes.

The October 28 investigation trialed a larger render buffer and viewport-specific swipe activation. Neither established an improvement on this feed, so both were removed. Emulator frame timing is noisy and GPU-limited relative to the Samsung; no overall FPS or physical-device speedup is claimed. The retained changes have direct clipping/subscription/state-publication evidence.

[T3 Code source comparison](../research/2026-10-28-t3-mobile-scroll-performance.md) records upstream facts separately from local recommendations.

## Verification

`node scripts/android-scroll-check.mjs emulator-5554 expanded-row /tmp/scroll-row-check` checks a collapsed audio card whose Read more is in the middle of the screen. It expands the card and asserts that that same row's Play/Pause target remains at least 44 dp tall and its text retains a content gutter. The original row failed at 27 physical pixels; the fixed row passed at 77 pixels on the 280-dpi emulator. The final Samsung check passed at 124 pixels against its 123-pixel minimum. The checker will not accept a later row's button, a text-only/blocked-audio card, or a different foreground app.

`node scripts/android-scroll-check.mjs emulator-5554 frames /tmp/scroll-frames` records a four-swipe native timing run and a settled screenshot. It does not automatically classify blur or establish a performance improvement.

Execution, native coverage, limitations and evidence: [Android scroll task](../tasks/2026-10-28-android-scroll-rendering.md). No API, permission, database, migration or deployment behavior changed.
