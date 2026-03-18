# Done

## Purpose
Tracks completed work that is still useful as project memory.

## How To Use
- Move finished items here with concise wording.
- Keep the most recent and most meaningful items.
- Link to feature, ADR, or bug docs when available.

## Template

### Completed
- Project Brain initialized with core system, product, engineering, database, API, task, and template documents.
- Legacy `brain/tasks.md` preserved as `brain/tasks/legacy-tasks.md` to unblock the standard task-directory layout.
- **Audio seek bar** — rewrote with `Animated.Value` for 60fps drag, haptic on drag start, seek only on release.
- **DualSeekBar second seek** — refs updated immediately in PanResponder callbacks (not just via useEffect).
- **Global audio bar route** — fixed wrong route `/blog-view-2/${blogId}/index` → `/blog-view-2/${blogId}`.
- **Speed toggle** — removed `SpeedPickerModal`, replaced with `cycleSpeed()` cycling `[0.75, 1.0, 1.25, 1.5, 2.0]`.
- **Marquee title** — `MarqueeText` component with ghost measurement + native `Animated` horizontal scroll.
- **Shamela AI refactor** — `callAI` accepts `sourceUrl?`, returns `{text, inputTokens, outputTokens, model}`; Anthropic uses `url-context-1` beta to fetch Shamela URLs natively; `recordTokenUsage` persists to `AiTokenUsage`; `syncToc`, `fetchPage`, `fetchNextPage`, `syncBookFromShamela` all updated.
- **`getTokenUsage` tRPC query** added for AI cost observability.
