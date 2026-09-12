# Agent Instructions

## Brain Protocol

`.brain/` is the project memory and source of truth for architecture, product state, and Brain-owned tasks. An explicitly linked repository-local `.scratch/` ticket may instead be the source of truth for that task's execution progress; its dedicated Brain task must remain a minimal status pointer. Treat Brain documentation as part of the definition of done for every meaningful change.

Before starting work:

- Read the relevant Brain files for the task. Start with `.brain/BRAIN.md`, `.brain/SYSTEM_OVERVIEW.md`, `.brain/system/overview.md`, `.brain/system/architecture.md`, `.brain/engineering/ai-rules.md`, `.brain/engineering/coding-standards.md`, and `.brain/tasks/in-progress.md`; then follow its pointer to the dedicated task and any canonical Scratch ticket.
- For feature work, also read the matching file in `.brain/features/` and any related ADR in `.brain/decisions/`.
- For API, auth, permission, database, or migration work, read the matching files under `.brain/api/` and `.brain/database/`.
- If the repository root defines both `db:migrate` and `db:push` scripts and Prisma schema/database files are changed, run both commands after the Prisma update. Do not manually create migration files.

After code changes:

- Run a Brain documentation impact check before finishing.
- Update `.brain/database/schema.md`, `.brain/database/relationships.md`, or `.brain/database/migrations.md` for database changes.
- For Prisma database updates, if root scripts `db:migrate` and `db:push` exist, run `bun db:migrate` and `bun db:push` after changing the schema. Do not manually create migration files.
- Update `.brain/api/endpoints.md`, `.brain/api/contracts.md`, or `.brain/api/permissions.md` for API, contract, auth, or permission changes.
- Update or create `.brain/features/<feature>.md` for feature behavior changes.
- Add an ADR under `.brain/decisions/` for durable architecture, product, integration, or implementation decisions.
- Update the dedicated `.brain/tasks/YYYY-MM-DD-<slug>.md` file and move its pointer among `.brain/tasks/backlog.md`, `.brain/tasks/in-progress.md`, `.brain/tasks/done.md`, and `.brain/tasks/roadmap.md` when task state changes. Keep ledgers pointer-only. For Scratch-backed tasks, keep detailed execution progress in Scratch and only status/link/dates in Brain.
- If no Brain update is needed, state that explicitly in the final response with the reason.

Final responses must include the Brain files updated, or `No Brain documentation updates required` with a short rationale.
