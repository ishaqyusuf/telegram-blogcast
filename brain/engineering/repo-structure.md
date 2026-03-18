# Repo Structure

## Purpose
Explains how the repository is organized so contributors know where to add new code.

## How To Use
- Update when folders are added, removed, or repurposed.
- Keep descriptions practical and implementation-oriented.
- Reference `brain/PROJECT_INDEX.md` for the quick inventory.

## Template

### Top-Level Structure
- `apps/`: deployable products and services.
- `packages/`: shared libraries and infrastructure code.
- `brain/`: project documentation and operating memory.

### Placement Rules
- Put UI specific to a single app inside that app.
- Put shared business logic and helpers into `packages/` when multiple apps depend on them.
- Keep database schema and generated client concerns inside `packages/db`.
- Put background processing in `packages/trigger` or `packages/jobs` rather than clients.

### Existing Special Cases
- `CLAUDE.md` should remain a lightweight redirect to Brain rather than a second source of truth.
- `brain/tasks/legacy-tasks.md` preserves the old single-file task list.
