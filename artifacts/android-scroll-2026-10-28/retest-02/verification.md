# Scroll retest 02 — 2026-10-28

Tested implementation: `f254da42` in the current checkout. No application code changed during this retest.

## Results

- Twenty focused tests passed (54 assertions) across feed updates, dismissal geometry, transcript selection, player visibility, ownership notifications and card media behavior.
- Samsung SM-S928U1: expanded Play target 123 px against a 123 px minimum; text gutter 45 px. Passed.
- Android 14 emulator: expanded Play target 77 px against a 77 px minimum; text gutter 28 px. Passed.
- Native slow scroll, fast fling and both reversals were recorded on the Samsung with foreground checks before each gesture. Reviewed frames at 1.1, 2.0 and 3.0 seconds show different post positions with readable text and no observed blank-row flash or row-control clipping in those samples. This is sampled visual evidence, not proof that every frame or route is flicker-free.
- Guarded four-swipe timing: Samsung 208 frames, 48 janky frames (23.08%), p95 25 ms, p99 32 ms. Emulator 93 frames, 17 janky frames (18.28%), p95 93 ms. These development-build observations show remaining frame drops; no overall FPS improvement or fully smooth scrolling is claimed.

## Runtime reset

The first warm phone attempt could not reach the target post. Its live LegendList state reported an internal scroll offset of approximately -3501.9 and the captured view stayed near the dashboard. That run was not accepted as a card-expansion or post-fling pass. A cold process restart, preserving app data and settings, reset the list to zero; a native upward gesture then advanced it to approximately 249.6. The final expansion and scroll tests above used that fresh process. Retained development-runtime state is implicated; the precise cause was not isolated, and a general application fix is not claimed for that initial session.

## Evidence and environment

Committed evidence: native expansion result JSON and expanded screenshots for both devices. Additional local artifacts: `physical-motion.mp4`, `physical-frames/frames.txt`, `emulator-frames/frames.txt` and settled screenshots. Device font, theme and animation settings were unchanged. The emulator remains running. No API/database changes or deployments were performed.
