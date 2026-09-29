# Channel Background Updates

- Baseline: [Settings screenshot](baseline-settings.png), captured before implementation and before the user's UI-testing pause.
- Early design comparison: [board](index.html); implementation uses the dedicated focused list so channel selection can scroll independently of general Settings.
- [Selected concept](focused-list.html) · [preview](focused-list.svg)
- Other concepts: [inline](inline-settings.html) / [preview](inline-settings.svg), [selection first](selection-first.html) / [preview](selection-first.svg), [summary/editor](summary-detail.html) / [preview](summary-detail.svg).
- Code checks: 10 focused Bun tests pass. Production changes have no TypeScript diagnostics; full Expo typecheck is blocked by unrelated existing errors and missing Bun test types.
- Native UI testing and final screenshots: **pending; paused by explicit user request**. Do not infer visual verification from the baseline or concept previews.
- Detailed scope and pending checks: [Brain task](../../.brain/tasks/2026-09-28-background-channel-updates.md).
