# Progress

## 2026-08-15

### Continuous Karaoke And Accurate Transcript Sync
- Status: Implemented in source; device interaction profiling remains part of final validation.
- Source mode: User-approved implementation plan.
- Source changed: canonical flowing Arabic transcript separators, shared karaoke/read surface, exact measured timing with estimated segment fallback, projected playback clock, Live-only catch-up, inset-safe read header, and real audio Play/Pause.
- Brain changed: Audio feature behavior and progress.

## 2026-08-02

### OTA Route Continuity
- Status: Implemented in source; installed preview OTA validation remains.
- Source mode: User-approved implementation plan.
- Source changed: versioned stable-route selection and validation, one-time
  AsyncStorage marker, update-identity/TTL/deep-link guards, shared automatic
  and manual reload transaction, startup restoration gate, Sentry breadcrumbs,
  configuration flag, and focused unit coverage.
- Behavioral boundary: screen routes and serializable URL parameters restore;
  scroll position, open overlays, selections, and unsaved form state do not.
- Rollout note: the first OTA containing the feature installs capture support;
  route restoration can be observed beginning with the following OTA.
- Brain changed: mobile build variants, system architecture, and progress.

## 2026-07-30

### Incremental Facebook Saved-Post Sync
- Status: Implemented.
- Source mode: User-approved option 1 plan, extended with a direct mobile trigger.
- Source changed: shared saved-post identity/collector contract, stable canonical export, reusable JSON/database sync service, local-only tRPC procedures, prompt-driven repository skill, and Expo Facebook Saved WebView flow.
- Facebook media resolution and Telegram upload remain separate in the existing Facebook Import workflow.
- Brain changed: `brain/plans/2026-07-30-feature-incremental-facebook-saved-sync.md`, Blog behavior, architecture, API contracts, completed tasks, and progress.

### Production-Backed ngrok Gateway Discovery
- Status: Implemented and deployed. Preview OTA release is intentionally
  pending because unrelated uncommitted Expo changes cannot safely be included
  or overwritten.
- Source mode: User-approved implementation plan.
- Source changed: Expo/Vercel environment URLs, singleton discovery lease and
  authenticated route, web-runner health-gated publisher and heartbeat,
  preview-only remote resolution/retries, gateway-scoped local workflow state,
  remote retry UI, ngrok warning bypass, and LAN development preservation.
- Production database push completed and the Vercel discovery token was added
  as a sensitive production variable; the same value is stored only in the
  ignored local web environment.
- Production deployment `dpl_L7PQPwGjN6zrvHXGYBmWeiHYd5dL` is live at
  `https://alghurobaa.vercel.app`. End-to-end verification confirmed public
  empty lookup, authenticated publication, ngrok `/health`, minute heartbeat
  expiry renewal, and authenticated deletion on graceful shutdown.
- Validation passed: 24 focused Expo tests, 8 discovery route/lease tests, 6
  publisher/ngrok runner tests, focused Expo ESLint, focused web/shared Biome,
  DB typecheck, Prisma production schema push, Vercel production build, scoped
  diff checks, and two-axis standards/spec review.
- Validation limitation: the Android emulator had no compatible preview build,
  so the new preview-only retry copy was not visually exercised. Publishing an
  OTA from this worktree would either bundle or overwrite unrelated uncommitted
  Expo changes. The shared utils typecheck still reports four pre-existing
  React email/PDF diagnostics outside this feature.
- Brain changed:
  `brain/plans/2026-07-30-feature-production-backed-ngrok-gateway-discovery.md`,
  mobile build variants, API endpoints/contracts/permissions, database schema,
  completed tasks, and progress.

## 2026-07-24

### Channel Content Filter Configuration
- Status: Done.
- Source mode: Direct user request refined into an implementation plan.
- Source changed: global channel allow-list state, typed channel list/update procedures, shared Prisma visibility policy for Home/channel/Search, canonical Telegram PDF/video import typing with legacy MIME fallback, dry-run normalizer, and the Expo Settings/list/floating-selector experience.
- Brain changed: `brain/plans/2026-07-24-feature-channel-content-filter-configuration.md`, Blog behavior, API contracts, database schema/relationships, completed tasks, and progress.
- Validation passed: 10 focused API policy/visibility tests, 70-test repository Bun suite, Blog/DB package typechecks, focused Expo ESLint and API Biome checks, Android export, live schema push, and Android interaction QA in light, dark, English, and Arabic RTL.
- Validation limitation: the legacy normalizer found 318 PDF and 56 video rows, but its external-data write was not authorized; runtime MIME fallback covers those rows. Full API and Expo typechecks continue to report existing project diagnostics outside this feature.

### Silent Local Services Discovery And Home Status
- Status: Done.
- Source mode: User-approved implementation plan.
- Source changed: selected-IP-first Local Services discovery, bounded history probing, strict gateway health identity, foreground/network/backoff retries, verified-availability feature gating, connected/checking/offline floating sheet, home-header status control, and manual Settings/import connection feedback.
- Brain changed: `brain/plans/2026-07-24-feature-silent-local-services-discovery-status.md`, the superseded cold-launch plan, mobile build-variant behavior, completed tasks, and progress.
- Validation passed: 13 focused Local Services tests, 62-test repository Bun suite, focused Expo ESLint, preview Android export, scoped `git diff --check`, and physical Android dark-mode QA of the checking/connected home-header states.
- Validation limitation: the full Expo typecheck still reports its existing project-wide diagnostics; none reference the touched Local Services, header, Settings, or import implementation files.

## 2026-07-22

### Oversized Facebook Media External Playback
- Status: Done.
- Source mode: User-approved implementation plan.
- Source changed: Facebook bridge media probing and size policy, normalized API import metadata/status/feed/search output, shared limit/link helpers, Expo feed/card/detail/import external playback, and a dry-run legacy backfill command.
- Brain changed: `brain/plans/2026-07-22-feature-facebook-large-media-external-playback.md`, `brain/features/blog.md`, `brain/features/audio.md`, `brain/api/contracts.md`, `brain/tasks/done.md`, and `brain/progress.md`.
- Validation passed: 43-test repository Bun suite, five bridge unit tests plus Python compilation, Blog and DB package typechecks, focused Expo ESLint, focused Biome checks, and `git diff --check`.
- Validation limitation: the API package typecheck still reports two unrelated existing diagnostics in `blog.routes.ts` and `utils/query-response.ts`; the Expo typecheck also reports its existing project-wide diagnostics.

### Fix Blog-Card Add-To-Album Query Context
- Status: Done.
- Source mode: Direct user report.
- Source changed: Expo root provider ordering and a regression test that keeps the bottom-sheet portal host inside the React Query provider.
- Brain changed: `brain/features/blog.md` and `brain/progress.md`.
- Validation passed: focused Bun regression test, focused Expo ESLint, and `git diff --check`.

### Web Telegram Recent-Update Prompt
- Status: Done.
- Source mode: Direct user request.
- Source changed: web Blog/dashboard auto-check dialog and terminal handoff, Telegram recent-update summary/job batching, Telegram connection reuse, Prisma development client reuse, and focused prompt/terminal tests.
- Brain changed: `brain/features/blog.md` and `brain/progress.md`.
- Validation passed: focused update/persistence tests (9 tests, 28 assertions), focused Biome checks excluding the pre-existing formatting debt in `packages/db/src/index.ts`, local-host allow/public-host deny API checks, browser UI verification of the selection modal, and a live update of `قناة د. أحمد سعيد` that stored 23 remaining posts and completed at 6,131 saved posts. A follow-up browser run verified the dashboard terminal completion output.
- Validation limitation: the current full Bun suite has one unrelated concurrent failure in `apps/api/src/queries/posts.test.ts`; full API and web typechecks also report unrelated existing project diagnostics outside this feature.

## 2026-07-20

### Preview/Production Local Network Launch
- Status: Done.
- Source mode: Direct user request.
- Source changed: Expo local-services session provider and launch sheet, local API client, startup Telegram prompt/progress client routing, local feature route guards, transcription gating, and Settings session controls.
- Brain changed: `brain/plans/2026-07-20-feature-preview-production-local-network-launch.md`, `brain/features/mobile-build-variants.md`, `brain/features/blog.md`, `brain/features/audio.md`, `brain/tasks/done.md`, and `brain/progress.md`.
- Validation passed: focused local-session/local-URL/transcript tests, the repository Bun test suite, focused Expo ESLint with only pre-existing warnings, preview Android export, and `git diff --check`.
- Validation limitation: the full Expo typecheck still reports pre-existing project diagnostics; hands-on Android UI QA was skipped at the user's request.

## 2026-07-10

### Audio Transcript Streaming And Local Services IP
- Status: Done.
- Source mode: Direct user request.
- Source changed: `apps/api/src/queries/blog.ts`, `apps/api/src/trpc/routers/blog.routes.ts`, `apps/api/src/queries/blog.test.ts`, `apps/expo-app/src/screens/audio-blog-screen.tsx`, `apps/expo-app/src/components/audio-blog-view/transcript-read-mode.tsx`, `apps/expo-app/src/lib/local-service-urls.ts`, `apps/expo-app/src/lib/transcribe.ts`, `apps/expo-app/src/lib/facebook-media-bridge.ts`, `apps/expo-app/src/store/app-settings-store.ts`, `apps/expo-app/src/screens/settings-screen.tsx`, `apps/expo-app/src/screens/blog-import-screen.tsx`, `apps/expo-app/src/screens/facebook-import-screen.tsx`, and local transcription call sites.
- Brain changed: `brain/plans/2026-07-10-feature-audio-transcript-streaming-karaoke-local-service-settings.md`, `brain/tasks/backlog.md`, `brain/tasks/done.md`, `brain/features/audio.md`, `brain/api/contracts.md`, `brain/progress.md`.
- Validation passed: `bun --cwd apps/api test src/queries/blog.test.ts`; `bun test apps/expo-app/src/lib/local-service-urls.test.ts`; `bun test apps/expo-app/src/components/audio-blog-view/transcript-timing.test.ts`; focused Expo ESLint for touched mobile files; `bun --cwd apps/api test`; repo-level `bun test`; `git diff --check`.
- Validation limitation: API Biome and API/Expo typechecks were terminated by SIGKILL in this environment before producing diagnostics.

## 2026-07-04

### Physical Library Catalog
- Status: Done.
- Source mode: Direct user request.
- Source changed: `packages/db/src/schema/library.schema.prisma`, `packages/db/src/schema/book.schema.prisma`, `packages/db/src/index.ts`, `apps/api/src/trpc/routers/library.routes.ts`, `apps/api/src/trpc/routers/_app.ts`, `apps/expo-app/src/screens/library-screen.tsx`, `apps/expo-app/src/screens/library-item-form-screen.tsx`, `apps/expo-app/src/screens/library-item-detail-screen.tsx`, `apps/expo-app/src/screens/books-screen.tsx`, `apps/expo-app/src/screens/book-detail-screen.tsx`, `apps/expo-app/src/app/_layout.tsx`, `apps/expo-app/src/app/books/library/*`, `apps/expo-app/src/lib/i18n.ts`.
- Brain changed: `brain/plans/2026-07-04-feature-physical-library-catalog.md`, `brain/features/books.md`, `brain/database/schema.md`, `brain/api/contracts.md`, `brain/tasks/done.md`.
- Validation passed: `bun --cwd packages/db prisma-generate`; `bunx biome check apps/api/src/trpc/routers/library.routes.ts apps/api/src/trpc/routers/_app.ts packages/db/src/index.ts`; `bunx eslint src/screens/library-screen.tsx src/screens/library-item-form-screen.tsx src/screens/library-item-detail-screen.tsx src/screens/books-screen.tsx src/screens/book-detail-screen.tsx src/app/_layout.tsx`.
- Validation limitation: full API and Expo typechecks still fail on unrelated existing project errors outside this slice.

## 2026-07-02

### Album Organizer Review And Approval
- Status: Done.
- Source mode: Intake Mode, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`.
- Source changed: `apps/api/src/trpc/routers/album.routes.ts`, `apps/expo-app/src/screens/album-organizer/index.tsx`, `apps/expo-app/src/app/album-organizer/index.tsx`, `apps/expo-app/src/app/album-organizer/[channelId]/index.tsx`, `apps/expo-app/src/app/album-organizer/[channelId]/runs/[runId]/index.tsx`, `apps/expo-app/src/app/album-organizer/[channelId]/runs/[runId]/albums/[suggestionId].tsx`, `apps/expo-app/src/app/_layout.tsx`, `apps/expo-app/src/screens/settings-screen.tsx`.
- Brain changed: `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/plans/2026-07-01-feature-ai-album-index-review.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/features/audio.md`, `brain/api/contracts.md`.
- Validation passed: `bun --cwd packages/db prisma-generate`; `bunx biome check` for touched API/Expo files; `bunx eslint src/screens/album-organizer/index.tsx src/screens/settings-screen.tsx src/app/_layout.tsx` from `apps/expo-app`.
- Validation limitation: full API and Expo typechecks still fail on unrelated existing project errors outside this slice.

### AI Automatic Album Index Generation
- Status: Done.
- Source mode: Intake Mode, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`.
- Source changed: `packages/db/src/schema/album-auto-index.schema.prisma`, `apps/api/src/services/album-auto-index.ts`, `apps/api/src/trpc/routers/album.routes.ts`.
- Brain changed: `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/plans/2026-07-01-feature-ai-album-index-generation.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/features/audio.md`, `brain/api/contracts.md`, `brain/database/schema.md`, `brain/database/relationships.md`.
- Validation passed: `bun --cwd packages/db prisma-generate`; `bunx biome check apps/api/src/services/album-auto-index.ts apps/api/src/trpc/routers/album.routes.ts`; no-network Bun smoke test for `normalizeAlbumIndexResponse`.
- Validation limitation: full `bun --cwd apps/api typecheck` still fails on unrelated existing issues in `src/queries/posts.ts`, `src/trpc/middleware/auth-permission.ts`, `src/trpc/routers/blog.routes.ts`, and `src/utils/query-response.ts`.

## 2026-07-01

### Album Authors And Book Attachments
- Status: Done.
- Source mode: Intake Mode, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`.
- Source changed: `apps/api/src/trpc/routers/album.routes.ts`, `apps/expo-app/src/screens/album-detail-screen.tsx`.
- Brain changed: `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/plans/2026-07-01-feature-album-author-management.md`, `brain/plans/2026-07-01-feature-album-book-attachments.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/features/audio.md`, `brain/features/books.md`.
- Validation passed: `bunx eslint src/screens/album-detail-screen.tsx` from `apps/expo-app`.
- Validation limitation: full Expo lint, API lint, app typecheck, and API typecheck still fail on unrelated existing project/API issues outside this slice.

### Search Channel Picker And Type Pills Status Correction
- Status: Done.
- Source mode: Intake Mode, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`.
- Source changed: no new code in this correction; existing implementation found in `apps/expo-app/src/screens/search-screen.tsx` and `apps/api/src/trpc/routers/blog.routes.ts`.
- Brain changed: `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/plans/2026-07-01-feature-search-channel-picker-badge-query.md`, `brain/plans/2026-07-01-ux-ui-search-result-type-badge-pills.md`, `brain/tasks/roadmap.md`.
- Validation passed: `bunx eslint src/screens/search-screen.tsx` from `apps/expo-app`.

### Stackable Floating Footer And Album Suggestion Actions
- Status: Done.
- Source changed: `apps/expo-app/src/components/floating-footer/floating-footer-provider.tsx`, `apps/expo-app/src/components/floating-footer/index.ts`, `apps/expo-app/src/app/_layout.tsx`, `apps/expo-app/src/components/global-audio-bar/index.tsx`, `apps/expo-app/src/components/ui/icon.tsx`, `apps/expo-app/src/screens/album-detail-screen.tsx`.
- Brain changed: `brain/plans/2026-07-01-refactor-stackable-floating-bottom-footer.md`, `brain/plans/2026-07-01-ux-ui-album-suggestion-selection-footer.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/features/audio.md`, `brain/features/blog.md`.
- Validation passed: `bunx eslint src/components/floating-footer/floating-footer-provider.tsx src/components/floating-footer/index.ts src/components/global-audio-bar/index.tsx src/components/ui/icon.tsx src/app/_layout.tsx src/screens/album-detail-screen.tsx` from `apps/expo-app`; `git diff --check`.

### Keyboard-Safe Add-To-Album And Album Suggestion Inputs
- Status: Done.
- Source changed: `apps/expo-app/src/components/channel-chat/add-to-album-modal.tsx`, `apps/expo-app/src/screens/album-detail-screen.tsx`.
- Brain changed: `brain/plans/2026-07-01-bug-fix-keyboard-safe-album-modals.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/features/audio.md`.
- Validation passed: `bunx eslint src/components/channel-chat/add-to-album-modal.tsx src/screens/album-detail-screen.tsx` from `apps/expo-app`; `git diff --check`.
- Validation limitation: full `bun --cwd apps/expo-app lint` and full `bunx tsc --noEmit --pretty false` still fail on unrelated existing project issues outside this slice.

### Album-Aware Player Queue And Play Modes
- Status: Done.
- Source changed: `apps/expo-app/src/store/audio-store.ts`, `apps/expo-app/src/store/audio-store.ios.ts`, `apps/expo-app/src/screens/album-detail-screen.tsx`, `apps/expo-app/src/components/global-audio-bar/index.tsx`.
- Brain changed: `brain/plans/2026-07-01-feature-album-aware-player-modes.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/features/audio.md`.
- Validation passed: `bunx eslint src/store/audio-store.ts src/store/audio-store.ios.ts src/components/global-audio-bar/index.tsx src/screens/album-detail-screen.tsx` from `apps/expo-app`.
- Validation limitation: full `bun --cwd apps/expo-app lint` and full `bunx tsc --noEmit --pretty false` still fail on unrelated existing project issues outside this slice.

### Album Track Playback Indicators And Row Controls
- Status: Done.
- Source changed: `apps/expo-app/src/screens/album-detail-screen.tsx`.
- Brain changed: `brain/plans/2026-07-01-ux-ui-album-track-playing-controls.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/features/audio.md`.
- Validation passed: `bunx eslint src/screens/album-detail-screen.tsx` from `apps/expo-app`.
- Validation limitation: full Expo lint still fails on unrelated existing project issues outside this slice.

### Fix Audio Scrub Flicker And Ended Replay Reset
- Status: Done.
- Repro video: `/Users/M1PRO/Downloads/WhatsApp Video 2026-07-01 at 11.17.14.mp4`.
- Source changed: `apps/expo-app/src/screens/audio-blog-screen.tsx`, `apps/expo-app/src/store/audio-store.ts`, `apps/expo-app/src/store/audio-store.ios.ts`.
- Brain changed: `brain/plans/2026-07-01-bug-fix-audio-scrub-flicker-replay-reset.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/features/audio.md`.
- Validation passed: `bunx eslint src/screens/audio-blog-screen.tsx src/store/audio-store.ts src/store/audio-store.ios.ts` from `apps/expo-app`.
- Validation limitation: full Expo lint and full TypeScript no-emit checks still fail on unrelated existing project issues outside this slice.

### Prevent Audio Detail From Stealing Current Playback
- Status: Done.
- Source changed: `apps/expo-app/src/screens/audio-blog-screen.tsx`, `apps/expo-app/src/components/audio-blog-view/karaoke-transcript.tsx`.
- Brain changed: `brain/plans/2026-07-01-bug-fix-audio-detail-does-not-steal-playback.md`, `brain/tasks/roadmap.md`, `brain/tasks/done.md`, `brain/intake/2026-07-01-album-search-audio-ai-followups.md`, `brain/features/audio.md`.
- Validation passed: `bunx eslint src/screens/audio-blog-screen.tsx src/components/audio-blog-view/karaoke-transcript.tsx` from `apps/expo-app`.
- Validation limitation: full `bun --cwd apps/expo-app lint` still fails on unrelated existing lint errors outside this slice.
## 2026-08-15

### Simplify Audio Header Actions And Suppress Footer Under Sheets
- Status: Done.
- Source changed: `apps/expo-app/src/components/audio-blog-view/audio-player-header.tsx`, `apps/expo-app/src/components/audio-blog-view/audio-options-sheet.tsx`, `apps/expo-app/src/components/audio-blog-view/audio-options-actions.tsx`, `apps/expo-app/src/components/ui/floating-bottom-sheet.tsx`, `apps/expo-app/src/components/ui/floating-bottom-sheet-store.ts`, `apps/expo-app/src/components/global-audio-bar/index.tsx`, `apps/expo-app/src/screens/audio-blog-screen.tsx`.
- Architecture changed: `brain/decisions/2026-08-15-floating-sheets-suppress-persistent-footers.md`, `brain/engineering/design-language.md`.
- Behavior: the player header now keeps only navigation/context/menu; transcript, transcription, and Local Services live in Audio options; every shared floating bottom sheet hides the global audio footer until all presented sheets finish dismissing.
- Validation: focused store/UI tests, targeted Expo ESLint, relevant Expo test suite, and Android production export.
