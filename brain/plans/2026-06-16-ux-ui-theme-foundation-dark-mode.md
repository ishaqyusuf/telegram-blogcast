# Plan: Theme Foundation And Dark Mode Audit

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
Make the Expo app's theme foundation robust enough for a premium media redesign, with consistent light/dark behavior across navigation, shared primitives, status bar, sheets, modals, toasts, icons, and route backgrounds.

## Current Context
The Expo app already has `THEME` and `NAV_THEME` in `apps/expo-app/src/lib/theme.ts`, NativeWind tokens in `apps/expo-app/src/styles/global.css`, a persisted theme override in `apps/expo-app/src/lib/theme-preference.ts`, and root wiring in `apps/expo-app/src/app/_layout.tsx`. Existing Brain design language requires semantic tokens such as `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, and `bg-primary`, and explicitly avoids hard-coded Spotify green/black. A quick scan found hard-coded colors and route-level exceptions across screens and components that need audit before redesign.

## Proposed Approach
Create a theme-readiness pass before screen redesign. Standardize how components read colors, replace avoidable hard-coded foreground/background colors with semantic tokens or `useColors()`, document approved exceptions for overlays and media art, and verify every registered Expo Router screen renders correctly in both light and dark modes.

## Implementation Steps
- Inventory every route registered in `apps/expo-app/src/app/_layout.tsx` and create a checklist of route backgrounds, status bar behavior, modal/sheet backgrounds, and empty/error/loading states.
- Consolidate theme access around `apps/expo-app/src/lib/theme.ts`, `apps/expo-app/src/hooks/use-color.ts`, `apps/expo-app/src/hooks/use-theme-color.ts`, and NativeWind semantic classes.
- Replace legacy or duplicate color sources where practical, including `apps/expo-app/src/constants/Colors.ts`, `apps/expo-app/src/hooks/useThemeColor.ts`, and `apps/expo-app/src/hooks/use-theme-color copy.ts` if still unused after import checks.
- Update shared primitives in `apps/expo-app/src/components/ui/` so button, input, textarea, modal, alert, toast, tabs, icon, text, view, and pressable states are visually coherent in both themes.
- Normalize route containers to use `bg-background` or `colors.background` and ensure navigation theme, status bar, and bottom-sheet backgrounds match the current color scheme.
- Replace hard-coded text colors and one-off class colors in active screens/components with semantic tokens unless they are intentional media overlays, generated cover colors, or approved status colors.
- Ensure the theme toggle exposes and persists light/dark/system behavior clearly and updates the app without stale navigation colors.
- Update `brain/engineering/design-language.md` if the token system, accent palette, or approved color exceptions change.

## Affected Files Or Areas
- `apps/expo-app/src/app/_layout.tsx`
- `apps/expo-app/src/app/+html.tsx`
- `apps/expo-app/src/lib/theme.ts`
- `apps/expo-app/src/lib/theme-preference.ts`
- `apps/expo-app/src/hooks/use-color.ts`
- `apps/expo-app/src/hooks/use-theme-color.ts`
- `apps/expo-app/src/constants/Colors.ts`
- `apps/expo-app/src/styles/global.css`
- `apps/expo-app/tailwind.config.ts`
- `apps/expo-app/src/components/ui/`
- `apps/expo-app/src/components/theme-toggle.tsx`
- `apps/expo-app/src/components/app-status-bar.tsx`
- All active route screens under `apps/expo-app/src/screens/` and `apps/expo-app/src/app/`
- `brain/engineering/design-language.md`

## Acceptance Criteria
- Every route registered in `_layout.tsx` has an audited light and dark state for background, foreground text, status bar, header/sheet/modal surface, loading state, empty state, and error state.
- Shared UI primitives render legibly in both themes without hard-coded light-only foreground or background colors.
- Active screens no longer use avoidable hard-coded white/black/gray/blue/red text or background values when a semantic token exists.
- Approved exceptions for media scrims, generated cover colors, destructive/status colors, and shadows are documented in code comments or `brain/engineering/design-language.md`.
- Theme override persists across reloads and the current navigation theme follows the resolved scheme.

## Test Plan
- Run `bun run --cwd apps/expo-app lint`.
- Run `bun run typecheck` from the repo root if the workspace typecheck is healthy.
- Manually inspect each registered Expo route in light mode and dark mode.
- Manually verify bottom sheets, modals, toast messages, image viewer, global audio bar, and theme toggle behavior.

## Brain Update Requirements
- Update `brain/engineering/design-language.md` with any changed token rules, approved hard-coded color exceptions, or route-audit expectations.
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
- Some hard-coded colors may be intentional for image scrims, generated covers, or status chips; do not remove those blindly.
- Theme behavior currently mixes NativeWind `useColorScheme`, React Native `Appearance`, and persisted overrides; changes must avoid flicker and stale navigation colors.
- Existing user changes are present in this worktree, so implementation must avoid reverting unrelated edits.

## Open Questions
- None for the Expo mobile dark-mode foundation.

## Linked Task
- Task Title: Theme Foundation And Dark Mode Audit
- Task File: brain/tasks/roadmap.md
