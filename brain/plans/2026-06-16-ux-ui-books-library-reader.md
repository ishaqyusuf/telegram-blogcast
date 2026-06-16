# Plan: Premium Books Library And Reader Redesign

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
- Intake Item: redesign entire app to spotify-ui level

## Goal Or Problem
Redesign the Expo books experience so the library, book detail, reader, search, annotations, footnotes, and import-adjacent reading flows feel premium, readable, and fully dark-mode ready.

## Current Context
Books are a core product pillar. `brain/features/books.md` identifies active screens for `/books`, `/books/[bookId]`, `/books/[bookId]/reader/[pageId]`, `/books/[bookId]/search`, and `/book-fetch`. It also emphasizes Arabic-first reading, RTL support, highlights, comments, footnotes, offline plans, and semantic theme tokens. Some book components already use `useColors()` and semantic classes, but hard-coded colors and one-off layouts remain in card, editor, rich-content, and fetch/import areas.

## Proposed Approach
Treat books as the app's long-form learning mode. Build a calm premium library and reader system with high-contrast typography, clear shelf/chapter state, refined annotations, accessible footnotes, and dark-mode-safe generated covers. Preserve Arabic readability over decorative media-app styling.

## Implementation Steps
- Audit book list, detail, reader, search, fetch preview, footnotes, highlights, rich content, and editor surfaces for theme and layout gaps.
- Redesign library cards with consistent generated cover treatment, shelf labels, author metadata, progress/fetched-page cues, and dark-mode contrast.
- Redesign book detail around metadata, chapter tree, fetch state, primary read action, search action, and offline/download affordances where currently available.
- Redesign reader chrome, paragraph spacing, footnote presentation, highlight toolbar, comment affordances, and page navigation with Arabic RTL readability as the main constraint.
- Ensure search results use readable snippets, matched text emphasis, empty states, and route-safe back navigation.
- Replace avoidable hard-coded colors in book card, book page view, rich content, editor, footnotes, and toolbar with theme-aware values.
- Document any changes to books visual system and reader behavior in the feature doc.

## Affected Files Or Areas
- `apps/expo-app/src/screens/books-screen.tsx`
- `apps/expo-app/src/screens/book-detail-screen.tsx`
- `apps/expo-app/src/screens/book-reader-screen.tsx`
- `apps/expo-app/src/screens/book-search-screen.tsx`
- `apps/expo-app/src/screens/book-fetch-preview-screen.tsx`
- `apps/expo-app/src/components/book/`
- `apps/expo-app/src/components/rich-content/rich-content.tsx`
- `apps/expo-app/src/hooks/use-book-page-draft.ts`
- `apps/expo-app/src/hooks/use-book-offline.ts`
- `brain/features/books.md`

## Acceptance Criteria
- Books list, detail, reader, search, and fetch preview surfaces share a coherent premium visual language.
- Arabic/RTL page content remains easier to read than before, with no decorative treatment that reduces long-form readability.
- Highlight, comment, footnote, and chapter-tree UI remains functional and legible in both light and dark modes.
- Generated book covers and shelf/status badges meet contrast expectations in both themes.
- Existing navigation from library/home to first fetched page or book detail still works.

## Test Plan
- Run `bun run --cwd apps/expo-app lint`.
- Run `bun run typecheck` from the repo root if the workspace typecheck is healthy.
- Manually test `/books`, `/books/[bookId]`, `/books/[bookId]/reader/[pageId]`, `/books/[bookId]/search`, and `/book-fetch-preview` in light and dark modes.
- Manually test Arabic paragraph rendering, long titles, footnotes, highlight toolbar, empty search results, and missing/unfetched page states.

## Brain Update Requirements
- Update `brain/features/books.md` with the redesigned books visual system and any changed reader interactions.
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
- Reader typography and RTL behavior are more important than visual density.
- Some rich-content HTML/editor styles may require inline style bridging instead of NativeWind-only fixes.
- Book import/fetch flows may be slow or API-dependent; include loading and failure states.

## Open Questions
- None for the Expo books redesign.

## Linked Task
- Task Title: Premium Books Library And Reader Redesign
- Task File: brain/tasks/roadmap.md
