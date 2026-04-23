# AI Rules

## Purpose
Repository-specific guardrails for AI contributors working on code, docs, and reviews.

## How To Use
- Update after discovering recurring AI failure modes.
- Keep this file short and actionable.
- Reference this before large AI-assisted changes.

## Template

### Rules
- Read the touched code paths before changing them.
- Avoid introducing new abstractions when an existing package or helper already solves the problem.
- Preserve project-specific UX choices such as RTL or Arabic-first considerations where relevant.
- Do not overwrite user-authored files or docs unless explicitly requested.
- Reflect architecture/API/database changes back into the Brain.
- In React Native code, avoid combining `className` and `style` on the same component unless the exception is intentional and explained inline.

### Recommended Inputs For AI Tasks
- Goal
- Scope
- Affected files or domains
- Verification expectations
- Documentation follow-up requirements
