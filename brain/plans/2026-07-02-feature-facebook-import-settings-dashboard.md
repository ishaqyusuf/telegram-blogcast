# Plan: Facebook Import Settings Dashboard And Status Flow

## Type
Feature

## Status
Proposed

## Created Date
2026-07-02

## Last Updated
2026-07-02

## Intake
- Intake File: brain/intake/2026-07-02-facebook-import-settings.md
- Intake Item: Settings > Facebook Import shows all Facebook blogs, import status, and a Start Import action.

## Goal Or Problem
Expose Facebook saved blog import as a first-class mobile workflow from Settings so the user can see available Facebook blog items, understand which are already imported, and start the import without running the script manually.

## Current Context
The existing Telegram/channel import control is implemented separately through `/blog-import` and local API tRPC procedures. Facebook saved import currently exists as `scripts/facebook-saved/import-to-db.ts`; it reads an export JSON file, creates `Blog` rows with `source = "facebook"` and unique `sourceId`, writes `sourceUrl/sourceSyncedAt/meta`, creates collection channels named like `facebook-saved-*`, tags imported rows, and writes `blogId` back into the export file. There is no Expo Settings entry, API status surface, durable import run/status contract, or mobile start button for Facebook import yet.

## Proposed Approach
Move the reusable Facebook import logic behind an API-owned service and expose a Settings-driven Expo screen. The API should be the owner of import execution and status, mirroring the existing local import architecture: the mobile app starts and observes the job, while the server reads the configured export source, imports missing rows, and reports progress/results. The screen should reconcile export items against existing `Blog.source = "facebook"` rows so each item can show `imported`, `existing`, `pending`, `invalid`, or `failed` status.

## Implementation Steps
- Extract reusable parsing/import helpers from `scripts/facebook-saved/import-to-db.ts` into an API-safe service, leaving the script as a thin CLI wrapper if still needed.
- Add API procedures for Facebook import status, item listing, and start import. Prefer a dedicated router namespace such as `facebookImport.*` unless an existing import router is introduced.
- Decide the status source: latest export JSON, a configured export file path, persisted import run records, DB `Blog.source = "facebook"` rows, or a combination. Document the choice in Brain.
- Implement a server-owned import runner that processes items in batches, skips existing blogs by `(source, sourceId)`, records imported/existing/invalid/failed counts, and exposes current progress.
- Add an Expo route/screen opened from Settings as `Facebook Import`.
- The screen should show summary counts, import state, last run details, and a searchable/scrollable list of Facebook blog items with status badges.
- Add a Start Import action that is disabled while an import is running and refreshes status when the job completes.
- Surface actionable errors, including missing export file, invalid export shape, database failure, or API unreachable state.
- Keep Telegram `/blog-import` behavior unchanged; only link or mention it if useful in Settings grouping.
- Update Brain docs after implementation.

## Affected Files Or Areas
- `scripts/facebook-saved/import-to-db.ts`
- `scripts/facebook-saved/export-utils.mjs`
- `apps/api/src/services`
- `apps/api/src/trpc/routers`
- `apps/expo-app/src/screens/settings-screen.tsx`
- `apps/expo-app/src/app/_layout.tsx`
- `apps/expo-app/src/app`
- `apps/expo-app/src/screens`
- `apps/expo-app/src/lib/base-url.ts` if local API targeting is reused
- `packages/db/src/schema/blogs.schema.prisma`
- `packages/db/src/schema/channels.schema.prisma`
- `exports/facebook-saved-*.json`
- `brain/features/blog.md`
- `brain/api/contracts.md`
- `brain/system/architecture.md`

## Acceptance Criteria
- Settings includes a `Facebook Import` entry.
- Opening Facebook Import shows available Facebook blog items and their import status.
- Existing imported items are detected from persisted Facebook blog data and are not duplicated.
- Start Import begins a server-owned import run from the configured Facebook saved source.
- While import is running, the screen shows progress and disables duplicate start actions.
- On completion, summary counts and row statuses refresh.
- Invalid or missing Facebook export data is shown as a recoverable error state.
- Existing Telegram/channel import behavior remains unchanged.

## Test Plan
- Run focused API lint/typecheck for changed service/router files.
- Run focused Expo lint/typecheck for the Settings route/screen files.
- Run the Facebook import service against a small fixture/export in dry-run or test mode.
- Verify imported/existing/invalid status mapping against rows with `Blog.source = "facebook"`.
- Manually open Settings > Facebook Import, start an import, leave and return to the screen, and confirm status refreshes.

## Brain Update Requirements
- Update `brain/features/blog.md` with the Facebook import Settings workflow.
- Update `brain/api/contracts.md` with Facebook import list/status/start procedure contracts.
- Update `brain/system/architecture.md` if import remains local API-owned and server-executed.
- Update `brain/database/schema.md` only if new import-run/status persistence is added.

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
- The Facebook export JSON may not exist on the deployed/local API machine.
- Browser export and DB import are separate concerns; combining them may require local browser automation and should not be assumed without approval.
- Large exports need pagination or virtualized lists in Expo.
- Import must preserve the existing unique `(source, sourceId)` duplicate guard.
- The app should not expose arbitrary filesystem paths unless the project already has a safe local-only pattern.

## Open Questions
- TODO: Should the import source be the latest `exports/facebook-saved-*.json`, a saved setting, or an explicit file picker/server config?
- TODO: Should this screen include a "Run Facebook export" action, or only import an already-created export file?
- TODO: Should import run history be persisted in new DB tables, or is in-memory/local API state enough for now?

## Linked Task
- Task Title: Facebook Import Settings Dashboard And Status Flow
- Task File: brain/tasks/roadmap.md
