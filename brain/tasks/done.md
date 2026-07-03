# Done

## Purpose
Tracks completed work that is still useful as project memory.

## How To Use
- Move finished items here with concise wording.
- Keep the most recent and most meaningful items.
- Link to feature, ADR, or bug docs when available.

## Template

### Completed
- **Album Organizer review and approval** - Settings now opens a channel-first Album Organizer, shows unalbumed audio and album counts, opens saved AI discovery runs without regenerating, lists discovered albums with track counts, and supports per-track dismiss/restore plus per-album approval through the existing album-add constraints. Plan: `brain/plans/2026-07-01-feature-ai-album-index-review.md`.
- **AI automatic album index generation** - added DeepSeek-backed channel album indexing generation with persisted raw/parsed JSON, normalized album/media suggestion rows, failed-run error capture, and review-ready run/detail queries without mutating live album membership. Plan: `brain/plans/2026-07-01-feature-ai-album-index-generation.md`.
- **Search channel picker and result type pills** - search input now shows recent searches, live-filtered channels, and browse tags; selected channels behave as structured filters with removable badges; result type pills use full-result metadata counts and combine with pagination/channel/text filters. Plans: `brain/plans/2026-07-01-feature-search-channel-picker-badge-query.md`, `brain/plans/2026-07-01-ux-ui-search-result-type-badge-pills.md`.
- **Album authors and book attachments** - album detail now manages one album-level author from unique track authors, supports creating/editing authors, shows per-track author fallback when unset, and provides a searchable manage-books modal for attaching/detaching album book references. Plans: `brain/plans/2026-07-01-feature-album-author-management.md`, `brain/plans/2026-07-01-feature-album-book-attachments.md`.
- **Stackable floating footer and album suggestion actions** - added a shared floating footer registry with the global audio bar pinned as the bottom-most layer, migrated album track/suggestion selection footers into the stack, and added album suggestion mark/unmark, add, add-to-album long-press, and confirmed blog soft-delete actions. Plans: `brain/plans/2026-07-01-refactor-stackable-floating-bottom-footer.md`, `brain/plans/2026-07-01-ux-ui-album-suggestion-selection-footer.md`.
- **Keyboard-safe add-to-album and album suggestion inputs** - shared add-to-album input and album detail `+ Add` suggestion input now use keyboard-aware scrolling so inputs/actions remain reachable above the mobile keyboard. Plan: `brain/plans/2026-07-01-bug-fix-keyboard-safe-album-modals.md`.
- **Album-aware player queue and play modes** - album detail playback now seeds an ordered album queue, the global audio bar exposes album-only play modes, and natural track completion supports off/default, repeat one, play next, repeat album, and shuffle album behavior. Plan: `brain/plans/2026-07-01-feature-album-aware-player-modes.md`.
- **Album track playback indicators and row controls** - album track rows now show play/resume/pause controls, highlight the currently loaded album track, and preserve selection/actions/reorder behavior. Plan: `brain/plans/2026-07-01-ux-ui-album-track-playing-controls.md`.
- **Audio scrub flicker and ended replay reset** - stabilized audio-detail scrub dragging against progress-event fighting, guarded store position updates while seeking, and made naturally ended tracks restart from 0 on the next play. Repro video: `/Users/M1PRO/Downloads/WhatsApp Video 2026-07-01 at 11.17.14.mp4`. Plan: `brain/plans/2026-07-01-bug-fix-audio-scrub-flicker-replay-reset.md`.
- **Passive audio detail navigation** - audio detail screens no longer auto-load viewed tracks on mount; explicit play is required to replace current playback, and inactive viewed-track scrubber/transcript seek controls are guarded. Plan: `brain/plans/2026-07-01-bug-fix-audio-detail-does-not-steal-playback.md`.
- **Album/blog/audio polish plan set** — implemented the approved 2026-06-27 plan batch: channel-aware album suggestions, album search/tabs/sheet polish, album-aware blog/search/audio cards, timestamp comment playback, transcript double-tap play, comment link previews, live search suggestions, and shared scroll-to-top/player-hide behavior. Plans: `brain/plans/2026-06-27-feature-channel-based-album-suggestions-bulk-add.md`, `brain/plans/2026-06-27-ux-ui-album-screens-search-tabs-sheet-polish.md`, `brain/plans/2026-06-27-feature-album-aware-blog-lists-cards.md`, `brain/plans/2026-06-27-ux-ui-flat-audio-comments-timestamp-playback.md`, `brain/plans/2026-06-27-bug-fix-transcript-highlighting-play-interactions.md`, `brain/plans/2026-06-27-ux-ui-comment-read-mode-inline-selection-editing.md`, `brain/plans/2026-06-27-feature-share-links-comment-link-previews.md`, `brain/plans/2026-06-27-feature-streaming-search-keyword-suggestions.md`, `brain/plans/2026-06-27-ux-ui-scroll-to-top-player-hide-behavior.md`.
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
