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
- Never combine `className` and `style` on the same React Native component. Use one styling mechanism per element.
- Never put text-align classes (`text-right`/`text-left`/`text-center`) on a `TextInput` className: NativeWind 5's interop crashes at render. Use the `textAlign` prop instead.

### Recommended Inputs For AI Tasks
- Goal
- Scope
- Affected files or domains
- Verification expectations
- Documentation follow-up requirements

### Android QA Emulator Ownership
- Use the dedicated `AlGhurobaa_API34` AVD for this project's Android QA. Resolve the current ADB serial from the AVD name before testing.
- `GreenTill_API34` belongs to the other app workflow. Preserve its open app and screen. Its EwaTrade task was restored after the 2026-11-05 correction.
