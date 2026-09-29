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
- 2026-09-29: `Media.titleOverride` was pushed as one additive nullable `TEXT` column. Read-only Prisma diffs for the default and `.env.production` targets each contained only that column. `bun db:migrate` stopped on pre-existing migration drift because Prisma requested a destructive reset; no reset or migration file was created. The root `bun db:push` Turbo wrapper could not run without its interactive UI, so `bun run push` in `packages/db` applied the production change and `bunx prisma db push` verified the default target was already in sync.
- 2026-09-08: inspected additive production diffs and pushed BookChapterImport plus its nullable ownerHash column using `bun --env-file=../../.env.prod x prisma db push` from packages/db. Existing book/page/annotation data was not rewritten. Prisma 7.7.0 client regenerated. Isolated localhost PostgreSQL was used only for synthetic transaction tests and stopped afterward; no migration files were created.
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
