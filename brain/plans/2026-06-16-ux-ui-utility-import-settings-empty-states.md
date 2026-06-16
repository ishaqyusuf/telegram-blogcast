# Plan: Utility Import Settings And Empty-State Screen Polish

## Type
UX/UI

## Status
Proposed

## Created Date
2026-06-16

## Last Updated
2026-06-16

## Intake
- Intake File: brain/intake/2026-06-16-app-redesign-cleanup-dark-mode.md
- Intake Item: make all screens dark mode support

## Goal Or Problem
Bring secondary Expo screens up to the same dark-mode and polish standard as the core media surfaces, so compose, import, settings, image viewing, not-found, unavailable, update, and error states no longer feel unfinished.

## Current Context
The route inventory includes many non-primary screens: blog compose/form, local blog import, book fetch/browser/preview, settings, updates, blog image viewer, blog options sheet, unavailable, modal, and not-found. These screens are essential to the app feeling complete, but they are also common places for hard-coded colors, light-only empty states, and inconsistent forms.

## Proposed Approach
After the main media screens have a stable direction, apply the shared theme primitives and premium interaction style to utility screens. Keep utility screens quieter and more task-focused than the home/audio/book surfaces while matching typography, spacing, icons, buttons, sheets, toasts, and empty/error treatments.

## Implementation Steps
- Audit utility routes for route containers, headers, forms, action bars, sheets, loading states, empty states, failure states, keyboard behavior, and hard-coded colors.
- Redesign compose/form screens with consistent input, media picker, upload, validation, and submit/cancel affordances.
- Redesign local blog import and book fetch flows with clear connection/provider/status states, progress feedback, and retry controls.
- Redesign settings and updates using grouped settings rows, theme controls, transcription preferences, account/actions, and clear destructive states.
- Redesign image viewer, blog options sheet, modal, unavailable, and not-found screens for dark-mode-safe backgrounds and actions.
- Remove in-app instructional prose that exists only to explain UI mechanics, while keeping necessary status/error content.
- Ensure keyboard-safe controls remain accessible on small screens.

## Affected Files Or Areas
- `apps/expo-app/src/screens/blog-compose-screen.tsx`
- `apps/expo-app/src/screens/blog-form.tsx`
- `apps/expo-app/src/screens/blog-import-screen.tsx`
- `apps/expo-app/src/screens/book-fetch-screen.tsx`
- `apps/expo-app/src/screens/book-fetch-browser-screen.tsx`
- `apps/expo-app/src/screens/book-fetch-preview-screen.tsx`
- `apps/expo-app/src/screens/settings-screen.tsx`
- `apps/expo-app/src/screens/updates-screen.tsx`
- `apps/expo-app/src/screens/not-found.tsx`
- `apps/expo-app/src/app/blog-image-view.tsx`
- `apps/expo-app/src/app/blog-options/[blogId]/index.tsx`
- `apps/expo-app/src/app/modal.tsx`
- `apps/expo-app/src/app/unavailable.tsx`
- `apps/expo-app/src/components/ui/`
- `brain/features/blog.md`
- `brain/features/books.md`

## Acceptance Criteria
- Utility screens use the same semantic theme system and shared UI primitives as the redesigned core screens.
- Forms, import progress, settings rows, sheets, image viewer, unavailable, not-found, loading, empty, and error states are legible in both light and dark modes.
- Blog compose/form and import/fetch workflows preserve existing submission, upload, provider, and retry behavior.
- Keyboard-safe behavior remains intact for forms and comment/import inputs.
- Secondary screens feel task-focused and coherent, without oversized marketing-style sections.

## Test Plan
- Run `bun run --cwd apps/expo-app lint`.
- Run `bun run typecheck` from the repo root if the workspace typecheck is healthy.
- Manually test compose/form, blog import, book fetch, book fetch browser, book fetch preview, settings, updates, image viewer, blog options sheet, unavailable, and not-found in light and dark modes.
- Manually test keyboard interaction on form-heavy screens.

## Brain Update Requirements
- Update `brain/features/blog.md` and `brain/features/books.md` only if import/compose/fetch presentation or behavior changes materially.
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
- Some utility screens depend on local LAN API availability; test offline/unreachable states.
- Forms may rely on keyboard-controller behavior; avoid layout regressions on small Android devices.
- Blog options uses sheet presentation and transparent content style; verify modal background contrast carefully.

## Open Questions
- None for Expo utility-screen polish.

## Linked Task
- Task Title: Utility Import Settings And Empty-State Screen Polish
- Task File: brain/tasks/roadmap.md
