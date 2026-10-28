# Native commit follow-up — 2026-10-28

## Scope and method

Samsung SM-S928U1, Android 16/API 36, 1080×2340, density 450. Both A/B APKs use the same checkout, debug native variant, ARM64 ABI and production-mode JavaScript on Metro 8086 (`__DEV__ === false`). Only the Reanimated native commit hook differs. An isolated `.scrolltest` application avoided replacing the installed app with an incompatible signing key.

A temporary ref probe positioned the real main feed at offset 3300. Both start captures show the same 9.1 MB audio post above the same video post. A six-second vertical gesture moved from y=1700 to y=800 at x=540. Native `gfxinfo` and an `atrace gfx view` capture bracketed the gesture; Perfetto queries used the app main-thread TID. Raw traces remain local in `/tmp`; checked-in CSVs contain only the relevant mount-batch aggregates.

| Observation | Unpatched | Patched |
| --- | ---: | ---: |
| Rendered frames | 430 | 431 |
| Missed deadlines | 276 (64.19%) | 257 (59.63%) |
| p50 / p95 frame time | 22 / 28 ms | 14 / 17 ms |
| p95 GPU time | 3 ms | 3 ms |
| 55-prop mount batches | 363 | 2 |
| Total time in those batches | 2082.3 ms | 18.6 ms |
| p95 native animation phase, last 120 frames | 9.15 ms | 1.93 ms |

The patch removes repeated application of idle animated props to native scroll-state commits. It materially reduces CPU work and frame latency. Rendered frame counts remain similar and many 120 Hz deadlines are still missed, so this is **not** proof of steady 120 FPS or perceptual blur elimination. Loaded total content length differed due pagination, although the initial visible cards and offset matched. Treat these as diagnostic samples, not a statistically controlled release benchmark.

Earlier wide-swipe and repeated-reversal samples are excluded from this comparison because they ended at different content or exposed retained negative offsets. The offset issue is not claimed fixed.

## Patch and installation

The version-pinned Bun patch backports the non-React commit guard from Reanimated 4.2.0 to installed 4.1.7. It retains React and Reanimated commits. No synchronous-prop fast-path or experimental RN release-level flag is enabled. A clean temporary Bun fixture applied the patch successfully. ARM64 native debug builds passed.

The project's existing development signing credentials were downloaded read-only through EAS, moved out of the checkout into restricted temporary storage, and used for a local build. `adb install -r` successfully updated the regular `com.alghurobaa.podcast.dev` app without uninstalling or clearing data. Its expanded-row checker passed: 124 px control against a 123 px minimum, with a 45 px gutter. No cloud build, OTA publication or remote deployment was performed.

The temporary JavaScript positioning probe was removed. Optimized ARM64 release build also passed and ran on the Samsung: a four-swipe main-feed sample reported 4/309 missed deadlines (1.29%), p95 15 ms, GPU p95 6 ms. It used the isolated app, preserving the regular development client. No unpatched release baseline was captured, so it is a release health sample rather than a quantitative patch speedup. Optimized native UI also exercised the populated 168-channel list, album grid and 11-track detail, and the corrected Digital Books viewport. The regular app was restored and the isolated test package removed. Perceived blur acceptance remains pending with the user.
