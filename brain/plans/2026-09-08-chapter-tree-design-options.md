# Chapter Tree Design Options

Status: Option A implemented and emulator-reviewed, with bottom search and all chapters expanded on entry.

## Request
Replace the large chapter cards/drill-down presentation with a compact inline tree like the supplied Shamela screenshot. User requested five options using gstack design-html.

## Artifacts
- Canonical HTML: /Users/M1PRO/.gstack/projects/ishaqyusuf-telegram-blogcast/designs/chapter-tree-20260908/finalized.html
- Interactive board: http://127.0.0.1:8768/finalized.html
- Data: tree.json alongside HTML, extracted from the retained 2,405-node book 23833 fixture without accessing production data.
- Responsive screenshots: tree-desktop.png, tree-tablet.png and tree-mobile.png alongside HTML.

## Options
- A: Reference compact. Grey header, dotted branches, small plus/minus controls.
- B: Clean green. App-aligned green accents, chevrons and light hierarchy lines.
- C: Paper index. Warm paper colors and Amiri typography.
- D: Precise outline. Monochrome, aligned page-number column and compact controls.
- E: Night reader. Muted dark green with the same inline tree behavior.

## Validation
Gstack browser verified five rendered options, Pretext loaded, expansion/collapse, source-page search 106, no-result state, and no horizontal document overflow at 375, 768 and 1440 widths. Heading-spacing refinement applied after screenshot review. Page title selection is a mock active state, not a working reader integration. Google Fonts and Pretext use CDN assets because the gstack vendored bundle is absent; native text wrapping remains the fallback.

## Pending
Finish repeated swipe/import acceptance and release. Native screen verified on Android: 2,405/2,405 expanded, inline collapse, reopen resets expansion, virtualized scroll, bottom search above keyboard, 106 search with ancestors, saved chapter opens reader with colors intact, unsaved chapter opens Shamela page 18 with Fetch Book Data. No style plus className on a React Native component. Screenshots are in the book-android visualization folder linked by the acceptance task.
