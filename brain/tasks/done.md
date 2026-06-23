# Done

## Purpose
Tracks completed work that is still useful as project memory.

## How To Use
- Move finished items here with concise wording.
- Keep the most recent and most meaningful items.
- Link to feature, ADR, or bug docs when available.

## Template

### Completed
- **Worker-owned transcription queue** — moved queued transcription execution out of Expo and into API/local-service worker ownership; added DB progress/heartbeat fields, internal worker endpoints, Python polling worker, mobile observer queue UI, disposable DB/route smoke tests, and Brain ADR/review docs. Plan: `brain/plans/2026-06-23-feature-worker-owned-transcription-queue.md`.
- **Expo development build branding** — made the development Android EAS profile load local env values and switch to `DEV`-badged app icon/adaptive icon/iOS icon/splash assets through `APP_VARIANT=development`.
- **Expo EAS build scripts** — renamed the preview Android build shortcut to `eas-build:preview` and added `eas-build:dev` for the development Android EAS profile from the repo root while preserving the EAS account helper flow.
- **Expo Android native shortcut and splash logo polish** — added root `bun run android` to best-effort uninstall `com.alghurobaa.podcast` through the Android SDK `adb` path before delegating to the Expo app Android build via `bun run --cwd apps/expo-app android`, added cropped splash/loading logo assets, and simplified Android adaptive icon layering so the logo is not reused as its own background.
- Project Brain initialized with core system, product, engineering, database, API, task, and template documents.
- Legacy `brain/tasks.md` preserved as `brain/tasks/legacy-tasks.md` to unblock the standard task-directory layout.
- **Books import workflow** — added durable book/page import history, recent-history re-import CTA, and manual page paste into an existing or newly created book.
- **Safe page re-import** — `fetchPage`/`fetchNextPage` now preserve the page row and remap highlight/comment anchors instead of only replacing page content blindly.
- **Audio seek bar** — rewrote with `Animated.Value` for 60fps drag, haptic on drag start, seek only on release.
- **DualSeekBar second seek** — refs updated immediately in PanResponder callbacks (not just via useEffect).
- **Global audio bar route** — fixed wrong route `/blog-view-2/${blogId}/index` → `/blog-view-2/${blogId}`.
- **Speed toggle** — removed `SpeedPickerModal`, replaced with `cycleSpeed()` cycling `[0.75, 1.0, 1.25, 1.5, 2.0]`.
- **Marquee title** — `MarqueeText` component with ghost measurement + native `Animated` horizontal scroll.
- **Shamela AI refactor** — `callAI` accepts `sourceUrl?`, returns `{text, inputTokens, outputTokens, model}`; Anthropic uses `url-context-1` beta to fetch Shamela URLs natively; `recordTokenUsage` persists to `AiTokenUsage`; `syncToc`, `fetchPage`, `fetchNextPage`, `syncBookFromShamela` all updated.
- **`getTokenUsage` tRPC query** added for AI cost observability.
