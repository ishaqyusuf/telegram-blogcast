# Database Migrations

## Purpose
Tracks how schema changes are applied and what migration workflows are expected in this repository.

## How To Use
- Update when the DB workflow or deployment expectations change.
- Record noteworthy migration pitfalls or environment-specific steps.
- Keep commands aligned with `package.json` scripts.

## Template

### Current Commands
- Root: `bun db:push`
- Root: `bun db:migrate`
- Root: `bun db:generate`
- Package-local: `packages/db` scripts for `push`, `db-migrate`, `prisma-generate`, `pull`, and `studio`

### Operational Notes
- `packages/db` uses Prisma and environment-driven commands.
- This project does not have a local database workflow, so Prisma database updates should be applied with `bun db:push` only after schema changes.
- Do not run `bun db:migrate` unless the project gains a local DB setup or the user explicitly asks for it.
- Do not manually create migration files; let Prisma and the repository scripts generate/apply the required migration state.

### Migration Checklist
- Update Prisma schema.
- Run `bun db:push`.
- Regenerate client if needed.
- Verify app and API queries against schema changes.
- Update Brain docs when domain shapes change.
