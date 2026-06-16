# Plan: Expo Unused Code And Asset Cleanup

## Type
Cleanup

## Status
Proposed

## Created Date
2026-06-16

## Last Updated
2026-06-16

## Intake
- Intake File: brain/intake/2026-06-16-app-redesign-cleanup-dark-mode.md
- Intake Item: clean up unused codes

## Goal Or Problem
Remove unused Expo code, duplicated hooks, stale example screens, demo commerce/job domains, copied assets, and dead dependencies so the app is easier to redesign, maintain, typecheck, and ship.

## Current Context
The Expo tree contains obvious cleanup candidates: `src/screens.example`, `src/example`, copied image assets, e-shop product assets and data, `cartStore`, job-oriented stores/context, duplicate theme hooks (`useThemeColor.ts`, `use-theme-color copy.ts`, `use-theme-color.ts`), and active routes that still import example screens. The root package already has `knip`, which can help identify unused files and dependencies, but active route imports must be resolved before deleting example code.

## Proposed Approach
Run a conservative cleanup pass after the theme foundation inventory. Use static search, `knip`, route inspection, and app lint/typecheck to distinguish truly unused code from legacy code still mounted by active routes. Replace active example imports with real screens first, then delete dead files and assets in small groups.

## Implementation Steps
- Run `bun run knip` and capture unused files, exports, and dependencies relevant to `apps/expo-app`.
- Search active route imports from `apps/expo-app/src/app/` and identify any route still importing `src/screens.example` or `src/example`.
- Replace active example route imports with maintained screen implementations before deleting example screens.
- Audit and remove stale e-shop demo data/assets if no active app route imports them.
- Audit and remove demo job stores/context/hooks if no active app route or package imports them.
- Deduplicate theme hooks and remove copied hook files after all imports are migrated to the canonical hook.
- Remove copied image assets only after app config, splash/icon references, and source imports are verified.
- Remove dead dependencies from `apps/expo-app/package.json` or root `package.json` only when static audit and import search agree they are unused.
- Update documentation if the app route map or project structure changes.

## Affected Files Or Areas
- `apps/expo-app/src/screens.example/`
- `apps/expo-app/src/example/`
- `apps/expo-app/src/app/home2.tsx`
- `apps/expo-app/src/app/blog-search.tsx`
- `apps/expo-app/src/app/blog-view/[blogId]/index.tsx`
- `apps/expo-app/src/app/blog-view-2/[blogId]/transcribe-audio.tsx`
- `apps/expo-app/src/data/`
- `apps/expo-app/src/store/cartStore.ts`
- `apps/expo-app/src/stores/`
- `apps/expo-app/src/context/jobs-context.tsx`
- `apps/expo-app/src/context/home-context.tsx`
- `apps/expo-app/src/hooks/useThemeColor.ts`
- `apps/expo-app/src/hooks/use-theme-color copy.ts`
- `apps/expo-app/assets/images/`
- `apps/expo-app/package.json`
- `package.json`
- `brain/engineering/repo-structure.md`

## Acceptance Criteria
- No active route imports `apps/expo-app/src/screens.example` or `apps/expo-app/src/example` unless a deliberate exception is documented.
- Dead e-shop demo, cart, job, copied hook, and copied image files are removed or explicitly documented as still used.
- `knip` findings for Expo app code are triaged, with resolved findings removed and false positives documented.
- Package manifests no longer include dependencies that are provably unused by the workspace.
- Lint/typecheck pass after cleanup, and app startup route still resolves to `/home`.

## Test Plan
- Run `bun run knip` before and after cleanup.
- Run `bun run --cwd apps/expo-app lint`.
- Run `bun run typecheck` from the repo root if the workspace typecheck is healthy.
- Manually launch the Expo app and verify `/home`, `/blog-search`, `/blog-view-2/[blogId]`, `/blog-view-text/[blogId]`, `/books`, `/albums`, `/playlists`, and `/settings` route imports are intact.

## Brain Update Requirements
- Update `brain/engineering/repo-structure.md` if folders, demo surfaces, or route structure change materially.
- Update `brain/tasks/done.md` after implementation.

## Lower-Agent Readiness
- Implementation scope is clear: Yes
- File boundaries are clear: Yes
- Acceptance criteria are observable: Yes
- Required checks are listed: Yes
- Brain update requirements are listed: Yes
- Ready for handoff: Yes

## Completion Report Requirements
Lower agent must report:
- Changed files
- Checks run
- Brain docs updated
- Unresolved issues
- Any skipped acceptance criteria

## Risks / Edge Cases
- Some example screens are still imported by active routes; delete only after replacement.
- Some copied app icons/splash images may be referenced by `app.config.ts`; verify before removal.
- `knip` can produce false positives in Expo Router and dynamic imports; confirm with `rg` and route tests.

## Open Questions
- None for the Expo cleanup audit.

## Linked Task
- Task Title: Expo Unused Code And Asset Cleanup
- Task File: brain/tasks/roadmap.md
