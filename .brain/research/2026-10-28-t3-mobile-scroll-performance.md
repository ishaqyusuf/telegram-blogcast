# T3 Code mobile: scroll performance patterns for the main feed

Date: 2026-10-28 (Africa/Lagos). Status: source review completed. Upstream `main` was resolved to [`5211acfe95a0c6d82a60e2524b5e46b47fe67a3e`](https://github.com/pingdotgg/t3code/commit/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e); all source links below are pinned to that revision. Read-only inspection through GitHub's connected API; no upstream code was executed. These are implementation observations and engineering recommendations, not measured claims that T3 or this app achieves a particular frame rate.

## Observed upstream source facts

### 1. Keep enough cheap rows prepared, and limit expensive interaction work

T3's home thread list uses the same list family already present locally: `AnimatedLegendList`. It supplies keys, item types, a content comparator, a 72-pixel estimate, a 1,000-pixel draw distance, and recycling. Its comment explicitly connects the larger render buffer to preparing rows before a fast fling reaches them. [Home list settings](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/HomeScreen.tsx#L137-L141), [LegendList configuration](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/HomeScreen.tsx#L773-L791).

The companion optimization is narrower swipe activation: on load and after 200 ms without another scroll event, it enables rows in the list's rendered range plus two on each side. Activation waits for fingers that started on the list to lift. Each row reads only its own dormant boolean through `useSyncExternalStore`. [Viewport activation](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/HomeScreen.tsx#L327-L357), [Activation store](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/swipe-row-activation.ts#L1-L51).

Dormant rows retain their child views and Swipeable wrapper. They disable swipe gestures, omit the right-action subtree and skip dismissal registration; T3 also caches right-action elements when their displayed dependencies are unchanged. It does **not** remove every animated wrapper from offscreen rows. [Dismissal registration](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/thread-swipe-actions.tsx#L346-L377), [Action cache and dormant gestures](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/thread-swipe-actions.tsx#L424-L519).

### 2. Equality is part of the data contract

Thread rows are explicitly memoized. The list comparator checks the underlying thread reference and every row presentation field, including labels and enabled states. The minute clock is carried only by the items that need it, because broad `extraData` invalidates visible rows. Recycling changes identity without remounting, so the row resets its local snooze sheet state when the bound thread identity changes. [Memoized row](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/threads/thread-list-v2-items.tsx#L577-L632), [Item comparator](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/threads/threadListV2.ts#L388-L440), [Clock invalidation](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/HomeScreen.tsx#L630-L643), [Recycling identity reset](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/threads/thread-list-v2-items.tsx#L722-L730).

This code relies on React Compiler as well as explicit memoization. The Expo config enables it, and tests check that Metro actually applies it, that source files have no unrecognized compiler bailouts, and that the feed derivation stays cached. Copying inline callback/object patterns without an equivalent compiler setup would not reproduce the same behavior. [Compiler enabled](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/app.config.ts#L463-L465), [Compiler regression tests](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/reactCompilerCoverage.test.ts#L138-L183).

### 3. Publish only state that a surface consumes

The thread-list environment projection picks a narrow provider shape, retains equal provider arrays and snooze presets, and returns its previous aggregate object when relevant values have not changed. Visible second clocks subscribe only while their screen is focused, the app is active, and ticking is enabled; labels share one tick. [Stable environment projection](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/state/thread-list-environments.ts#L85-L119), [Focused clock subscription](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/threads/use-visible-second-clock.ts#L9-L23).

### 4. Keep idle geometry natural; animate dismissal deliberately

The outer swipe-row animation uses `height: "auto"` while idle. During dismissal it translates the row, then collapses height; its outer transform is translation only. Action buttons separately animate opacity, translation and scale from shared values. This source demonstrates reducing idle geometry constraints, not a blanket prohibition on layout animation. [Dismissal worklet and idle height](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/thread-swipe-actions.tsx#L322-L377), [Action transforms](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/thread-swipe-actions.tsx#L548-L596).

### 5. Android chrome uses opaque fallback surfaces

`GlassBackdrop` enables blur only on iOS and forces string fallback colors to alpha 1 on other platforms. `GlassSurface` enables native glass only on iOS and turns its shadow/elevation off on Android. [Blur platform boundary](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/components/ui/GlassBackdrop.tsx#L7-L30), [Glass and shadow platform boundary](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/components/ui/GlassSurface.tsx#L49-L61).

### 6. Scroll handling is selective, but is not entirely on the UI thread

The Android FAB scroll handler runs in JavaScript, keeps its accumulator in a ref, and calls React state only when its expanded boolean changes. Its width animation is owned by the native Compose button. The swipe dismissal/gesture visuals use Reanimated worklets and shared values. Therefore this review does **not** establish that T3's home scroll-chrome calculations use `useAnimatedScrollHandler`. [Thresholded FAB state](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/home/AndroidHomeFab.android.tsx#L49-L59), [Native animation ownership](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/components/ScrollComposeButton.android.tsx#L17-L20), [Native FAB](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/components/ScrollComposeButton.android.tsx#L46-L60).

T3 also includes an opt-in render counter that records component render counts and causes, and a Hermes profiling command. That makes validation of invalidation work part of its engineering approach. [Render counter report](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/src/features/development/render-counter.ts#L150-L165), [Hermes profiling script](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/package.json#L42).

## Recommendations for Al-Ghurobaa (inference)

These recommendations follow from source comparison; they are not proof of the local bottleneck.

| Local code | Recommended application |
| --- | --- |
| `screens/blog-home.tsx` | Keep LegendList. Trial an explicit render buffer after row cost is reduced; 1,000 is T3's workload-specific value, not a universal constant. Supply a stable renderer and memoize BlogCard with stable handlers/post references. Add accurate item types or size estimates only when they match the mixed feed. |
| `components/blog-card/index.tsx` | Keep idle height automatic rather than pinning every row to its own measured height. Reserve collapse for active deletion. Verify dynamic image/transcript height changes and full-swipe deletion. Removing idle scale is a reasonable simplification, but an identity scale alone is not evidence of the bottleneck. |
| `components/blog-card/transcript-preview.tsx` | Select a primitive active segment ID/text only for the loaded, playing post; unrelated rows should select a constant inactive value. The current position subscription makes every mounted preview react to audio ticks, even when it returns null. An intermediate active-only child is another narrow solution. |
| `hooks/use-scroll-chrome.ts`, `screens/blog-home.tsx` | Consolidate duplicated direction/threshold work; update React/global store only on semantic changes. Consider shared values and `useAnimatedScrollHandler` when actual continuous chrome animation needs UI-thread ownership. That is a local design choice, not a pattern confirmed in T3's home handler. |
| Feed swipe actions | If profiling identifies hidden action work, use T3's dormant boolean approach: keep child identity stable, disable distant gestures, omit action content and avoid changing activation while a finger is down. Validate vertical drags, fling interruption, tap-to-open and horizontal swipes. |
| Recycling | Enable only after resetting delete progress, measured row height, open swipe state and any local media state on post identity changes. T3 explicitly handles identity reuse. Test scrolling a deleted/played/expanded item out and back into a recycled cell. |
| Android floating/header surfaces | Prefer an opaque background on moving Android chrome when blur is currently in use. T3's implementation is precedent; any performance gain still requires device comparison. |

Measure the same warm feed and fling path before and after, with audio paused and playing. Inspect JS/UI frame timing and render counts, then check dynamic row growth, pull refresh, category switching, pagination, swipes and retained scroll position. Do not infer improvement solely from passing type checks or copying upstream configuration.

## Scope limits

The upstream dependency stack differs from this checkout (for example, the reviewed manifest uses Expo 58 and React Native 0.88), so patched native behavior and component APIs should not be copied wholesale. [Upstream runtime versions](https://github.com/pingdotgg/t3code/blob/5211acfe95a0c6d82a60e2524b5e46b47fe67a3e/apps/mobile/package.json#L82-L135). No benchmark, runtime execution, or local app change was performed for this note.
