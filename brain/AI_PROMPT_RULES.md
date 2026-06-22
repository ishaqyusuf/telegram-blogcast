# AI Prompt Rules

## Purpose
Provides prompt hygiene rules for AI agents working in this repository so output stays accurate, scoped, and maintainable.

## How To Use
- Reference before asking an AI agent to implement or review repository changes.
- Update when repeated failure modes appear in AI-assisted work.
- Keep rules concrete and enforceable.

## Template

### Required Context
- State the user-facing goal first.
- Name the exact files, routes, packages, or domains involved when known.
- Mention any constraints: no regressions, preserve existing patterns, avoid destructive edits, update Brain docs if needed.

### Working Rules
- Prefer reading existing code and docs before proposing new abstractions.
- Reuse workspace packages and utilities before copying logic.
- Preserve user-authored changes unless explicitly asked to overwrite them.
- For Prisma database schema updates in this project, run `bun db:push` only because there is no local database workflow; do not run `bun db:migrate` unless the project gains a local DB setup or the user explicitly asks. Do not manually create migration files.
- When repo context is ambiguous, call out assumptions in the final summary.
- For reviews, prioritize bugs, regressions, and missing tests over broad commentary.

### Output Expectations
- Make changes end-to-end when feasible.
- Summarize what changed, what was verified, and any residual risk.
- Reference Brain files when documentation needs follow-up.
