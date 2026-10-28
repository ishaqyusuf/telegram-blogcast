# Reanimated native scroll-state commit backport

- Date: 2026-10-28
- Status: Accepted locally; Android verified
- Task: [Android scroll rendering](../tasks/2026-10-28-android-scroll-rendering.md)

## Context

Reanimated 4.1.7 reapplies all registered animated props whenever React Native commits native scroll state. On the physical Samsung, the main feed repeatedly mounted batches of 55 unchanged props; native animation work exceeded the 8.3 ms budget for 120 Hz. Earlier card geometry and subscription fixes did not address this native path.

## Decision

Apply a version-pinned Bun patch to `ReanimatedCommitHook.cpp`. For RN 0.80+, after handling Reanimated's own commits, return the existing tree for commits whose source is not React. Native state updates already derive from the committed tree, so their animated props do not need reapplication. Preserve the existing path for React commits. This backports the behavior guarded by `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS` in [upstream 4.2.0](https://github.com/software-mansion/react-native-reanimated/blob/4.2.0/packages/react-native-reanimated/Common/cpp/reanimated/Fabric/ReanimatedCommitHook.cpp#L68-L77).

The [maintainer performance guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) identifies this optimization for scrolling with many animated components. The installed 4.1 branch lacks that flag. Keep the current Expo 54/RN 0.81.5/Worklets 0.5.1 versions; avoid a wider runtime upgrade as part of this correction. Do not enable synchronous UI-prop updates, whose documented transform hit-testing caveat requires a separate audit.

## Verification and lifecycle

- Clean Bun fixture applied the patch; native ARM64 debug builds compiled.
- Physical main-feed trace: 55-prop batches fell from 363 to 2, with total batch work 2082.3 to 18.6 ms. Frame p95 fell from 28 to 17 ms, while 120 Hz deadlines still missed. [Evidence and limits](../../artifacts/android-scroll-2026-10-28/native-commit-followup/verification.md).
- Native gesture/trace comparison is the regression seam; a unit assertion mirroring the C++ guard would not verify the renderer interaction.
- A native rebuild is required; OTA JavaScript alone cannot apply this patch. Existing development signing credentials allow replacement without clearing app data.
- Remove the patch and its package/lockfile entries when upgrading to an Expo-compatible Reanimated version that includes the upstream behavior. Recheck gestures, animated controls, navigation and scrolling after a runtime upgrade.
- The source guard is shared across platforms, but this task provides Android runtime evidence only.
