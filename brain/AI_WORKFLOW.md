# AI Workflow

## Purpose
Defines the expected workflow for AI-assisted changes so repository context stays synchronized with implementation work.

## How To Use
- Follow this before and after meaningful code changes.
- Update when team expectations for AI collaboration change.
- Pair with `brain/AI_PROMPT_RULES.md` and `brain/engineering/ai-rules.md`.

## Template

### Standard Flow
1. Read `brain/BRAIN.md` and the most relevant section docs before editing code.
2. Inspect the actual code paths that will be changed instead of relying on memory.
3. Reuse existing utilities, patterns, and shared modules before introducing new abstractions.
4. Implement the change with the smallest coherent scope.
5. Run the most relevant verification available for the touched area.
6. Update Brain docs if architecture, API, database, feature scope, or task status changed.

### Minimum Documentation Updates
- Feature work: update or create a file in `brain/features/`.
- Architecture or pattern changes: add an ADR in `brain/decisions/`.
- Bug fixes with reusable lessons: add a note in `brain/bugs/`.
- New or completed workstreams: update `brain/tasks/`.

### Current Repo Notes
- This repo mixes mobile, web, API, and shared packages, so context should be gathered from both app and package boundaries.
- Existing project summaries in `CLAUDE.md` and `README.md` may diverge; reconcile them when clarifying product direction.
