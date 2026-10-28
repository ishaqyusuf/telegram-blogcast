# Floating Audio Player Workshop And Essential Strip

- Status: Done locally — selected revision implemented and physical Android checked
- Completed: 2026-10-28
- Created: 2026-10-28
- Workshop: https://workshop.localhost/al-ghurobaa/audio/floating-player
- Source: `/Users/M1PRO/Documents/code/workshop/work/al-ghurobaa/audio/floating-player/`
- Feature: [Audio](../features/audio.md)
- Final selection: **01 · Essential strip**, revision `67eea761-5898-48c8-98c7-a768c35cb194` (v1), explicitly selected by the user and recorded in Workshop.

## Scope And Implementation

Four interactive directions were published: Essential strip, Lesson dock, Split capsule, and Expandable rail. The user initially chose Lesson dock, then asked for a more compact player and selected Essential strip. The superseded native draft is archived under the existing Workshop source's `native-draft/`; it has no implementation receipt.

The final native strip uses one row for the available-width title/time and back-five/play/forward-five controls, plus a three-point progress line. A tap on the title opens audio details; holding it or invoking its accessibility long-press action opens the shared Playback options sheet for speed, album mode when available, timestamped comments, and the full player. Existing sleep countdown enforcement, stale-paused expiry, playback engines and shared visibility policy remain intact. Sleep countdown text appends to elapsed/duration instead of hiding playback time.

The existing shared `AnimatedMarquee` measures intrinsic text width, consumes its full available viewport, clips without synthesizing an ellipsis, and animates only overflowing text. Arabic and Latin titles use their respective reading direction. It resets on track/title changes, stops in the background/unmount, and respects reduced-motion settings. Current real theme tokens are retained. Android transport and option targets are 48 points, with pressed feedback. The new options sheet reserves extra bottom clearance above system navigation.

## Verification

- 18 existing audio title, visibility, serialized seek/repeat and notification-control tests passed.
- Scoped Expo ESLint passed for the player and marquee.
- Physical Samsung SM-S928U1 through wireless ADB: native strip rendered, title options opened, footer suppression observed, and timestamped comments navigation reached the real Comments screen.
- A temporary, untruncated Arabic title fixture demonstrated horizontal motion between `/private/tmp/essential-strip-marquee-a.png` and `essential-strip-marquee-b.png`. The fixture was removed; no audio metadata was changed.
- Earlier native transport checks exercised play/pause, speed and absolute seeking before the compact selection; the final compact layout retains the existing transport/store actions.
- The original Android font scale `0.9` was restored and the dev app restarted after a larger-text check exposed pre-existing screen-wide layout/recreation issues. Do not claim large-font acceptance for the whole app. Light tokens were inspected; no final light-theme physical capture is claimed.
- Full Expo typecheck remains blocked by existing workspace import, Bun type and unrelated screen/config errors; the earlier run reported no errors in this task's target files.

## Ownership And Delivery

Work is in the current `main` checkout. Existing keyboard suppression, hold-to-seek helper and unrelated changes predated this task and must remain uncommitted by this task. The task's commit isolates the layout/marquee changes; native validation also exercises those existing local enhancements. No push, OTA update or deployment is authorized.

The final component review disposition was **ship**. The options sheet was recaptured with its full bottom action clear of system navigation. The source commit is recorded in the selected revision's Workshop implementation receipt; completed task hunks are isolated from earlier working-tree changes.
